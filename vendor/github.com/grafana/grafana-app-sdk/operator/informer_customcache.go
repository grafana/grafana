package operator

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/tools/cache"

	customcache "github.com/grafana/grafana-app-sdk/k8s/cache"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/resource"
)

var _ Informer = &CustomCacheInformer{}

// MemcachedInformerOptions are the options for the MemcachedInformer.
type MemcachedInformerOptions struct {
	CustomCacheInformerOptions
	// ServerAddrs is a list of addresses for the memcached servers.
	ServerAddrs []string
	// ServerSelector is a server selector for the memcached client.
	// If present, it overrides Addrs and is used to determine the memcached servers to connect to.
	ServerSelector MemcachedServerSelector
}

// NewMemcachedInformer creates a new CustomCacheInformer which uses memcached as its custom cache.
// This is analogous to calling NewCustomCacheInformer with a MemcachedStore as the store, using the default memcached options.
// To set additional memcached options, use NewCustomCacheInformer and NewMemcachedStore.
func NewMemcachedInformer(
	kind resource.Kind, client ListWatchClient, opts MemcachedInformerOptions,
) (*CustomCacheInformer, error) {
	c, err := NewMemcachedStore(kind, MemcachedStoreConfig{
		Addrs:          opts.ServerAddrs,
		ServerSelector: opts.ServerSelector,
	})
	if err != nil {
		return nil, err
	}

	return NewCustomCacheInformer(
		c, NewListerWatcher(client, kind, opts.ListWatchOptions), kind, opts.CustomCacheInformerOptions,
	), nil
}

const (
	processorBufferSize        = 1024
	waitForSyncInitialInterval = time.Millisecond
	waitForSyncMaxInterval     = 100 * time.Millisecond
)

// CustomCacheInformerOptions are the options for the CustomCacheInformer.
type CustomCacheInformerOptions struct {
	InformerOptions
	// ProcessorBufferSize is the size of the buffer for the informer processor.
	// This is the number of events that can be buffered before the processor is blocked.
	// An empty value will use the default of 1024.
	ProcessorBufferSize int
	// WaitForSyncInitialInterval is the initial interval for the wait for sync.
	// This is the interval at which the wait for sync will check if the informer has synced.
	// An empty value will use the default of 1 millisecond.
	WaitForSyncInitialInterval time.Duration
	// WaitForSyncMaxInterval is the max interval for the wait for sync.
	// This is the max interval at which the wait for sync will check if the informer has synced.
	// An empty value will use the default of 100 milliseconds.
	WaitForSyncMaxInterval time.Duration
}

// CustomCacheInformer is an informer that uses a custom cache.Store to store the state of the resources.
type CustomCacheInformer struct {
	started        bool
	startedLock    sync.RWMutex
	controller     cache.Controller
	controllerLock sync.RWMutex
	store          cache.Store
	listerWatcher  cache.ListerWatcher
	opts           CustomCacheInformerOptions
	objectType     resource.Object
	processor      *informerProcessor
	schema         resource.Kind
	runContext     context.Context
}

// NewCustomCacheInformer returns a new CustomCacheInformer using the provided cache.Store and cache.ListerWatcher.
// To use ListWatchOptions, use NewListerWatcher to get a cache.ListerWatcher.
func NewCustomCacheInformer(
	store cache.Store, lw cache.ListerWatcher, kind resource.Kind, opts CustomCacheInformerOptions,
) *CustomCacheInformer {
	if opts.ProcessorBufferSize <= 0 {
		opts.ProcessorBufferSize = processorBufferSize
	}

	if opts.CacheResyncInterval < 0 {
		opts.CacheResyncInterval = 0
	}

	if opts.EventTimeout < 0 {
		opts.EventTimeout = 0
	}

	if opts.CacheResyncInterval > 0 && opts.EventTimeout > opts.CacheResyncInterval {
		opts.EventTimeout = opts.CacheResyncInterval
	}

	if opts.ErrorHandler == nil {
		opts.ErrorHandler = func(ctx context.Context, err error) {
			logging.FromContext(ctx).Error("error processing informer event", "component", "CustomCacheInformer", "error", err)
		}
	}

	return &CustomCacheInformer{
		store:         store,
		listerWatcher: lw,
		// TODO: objectType being set doesn't allow for a generic untyped object to be passed
		// We can enable the k8s.KindNegotiatedSerializer for this, but it would be used by all clients then
		// objectType:    kind.ZeroValue(),
		processor: newInformerProcessor(),
		schema:    kind,
		opts:      opts,
	}
}

// PrometheusCollectors returns a list of prometheus collectors used by the informer and its objects (such as the cache).
func (c *CustomCacheInformer) PrometheusCollectors() []prometheus.Collector {
	if cast, ok := c.store.(metrics.Provider); ok {
		return cast.PrometheusCollectors()
	}
	return nil
}

// AddEventHandler adds the provided ResourceWatcher to the list of handlers to have events reported to.
func (c *CustomCacheInformer) AddEventHandler(handler ResourceWatcher) error {
	c.processor.addListener(
		newInformerProcessorListener(
			toResourceEventHandlerFuncs(
				handler, c.toResourceObject, c.errorHandler, func() (context.Context, context.CancelFunc) {
					if c.runContext != nil {
						return c.runContext, func() {}
					}

					if c.opts.EventTimeout > 0 {
						return context.WithTimeout(context.Background(), c.opts.EventTimeout)
					}

					return context.WithCancel(context.Background())
				},
			),
			processorBufferSize,
		),
	)
	return nil
}

// Run runs the informer until stopCh is closed or receives a message.
// While running, events from the ListerWatcher will be propagated to all registered ResourceWatcher handlers,
// and current state of all resources will be stored in the custom cache.Store.
func (c *CustomCacheInformer) Run(ctx context.Context) error {
	defer utilruntime.HandleCrash()

	if c.HasStarted() {
		return errors.New("informer is already started")
	}

	c.runContext = ctx
	defer func() {
		c.runContext = nil
	}()

	// Initialize the controller
	c.controllerLock.Lock()
	c.controller = newInformer(
		c.listerWatcher,
		c.objectType,
		c.schema.GroupVersionKind().String(),
		c.opts.CacheResyncInterval,
		c,
		c.store,
		nil,
		c.opts.UseWatchList,
		c.opts.WatchListPageSize)
	c.controllerLock.Unlock()

	// Mark the informer as started
	c.startedLock.Lock()
	c.started = true
	c.startedLock.Unlock()

	// Separate stop channel because Processor should be stopped strictly after controller
	processorStopCh := make(chan struct{})
	var wg wait.Group
	defer wg.Wait()              // Wait for Processor to stop
	defer close(processorStopCh) // Tell Processor to stop
	c.processor.startedCh = make(chan struct{}, 1)
	wg.StartWithChannel(processorStopCh, c.processor.run)

	defer func() {
		c.startedLock.Lock()
		defer c.startedLock.Unlock()
		c.started = false
	}()

	// Wait for the processor to complete startup before running the controller (otherwise events may be dropped by distribution)
	<-c.processor.startedCh
	c.controller.Run(ctx.Done())
	return nil
}

// HasStarted returns true if the informer is already running
func (c *CustomCacheInformer) HasStarted() bool {
	c.startedLock.RLock()
	defer c.startedLock.RUnlock()

	return c.started
}

// HasSynced returns true if the informer has synced all events from the initial list request.
func (c *CustomCacheInformer) HasSynced() bool {
	c.controllerLock.RLock()
	defer c.controllerLock.RUnlock()

	if c.controller != nil {
		return c.controller.HasSynced()
	}
	return false
}

// LastSyncResourceVersion delegates to the underlying cache.Reflector's method,
// if the informer has started. Otherwise, it returns an empty string.
func (c *CustomCacheInformer) LastSyncResourceVersion() string {
	c.controllerLock.RLock()
	defer c.controllerLock.RUnlock()

	if c.controller == nil {
		return ""
	}

	return c.controller.LastSyncResourceVersion()
}

// OnAdd implements cache.ResourceEventHandler, and distributes the add event to all registered ResourceWatcher handlers.
func (c *CustomCacheInformer) OnAdd(obj any, isInInitialList bool) {
	c.processor.distribute(informerEventAdd{
		obj:             obj,
		isInInitialList: isInInitialList,
	})
}

// OnUpdate implements cache.ResourceEventHandler, and distributes the update event to all registered ResourceWatcher handlers.
func (c *CustomCacheInformer) OnUpdate(oldObj any, newObj any) {
	c.processor.distribute(informerEventUpdate{
		obj: newObj,
		old: oldObj,
	})
}

// OnDelete implements cache.ResourceEventHandler, and distributes the delete event to all registered ResourceWatcher handlers.
func (c *CustomCacheInformer) OnDelete(obj any) {
	c.processor.distribute(informerEventDelete{
		obj: obj,
	})
}

// WaitForSync waits for the informer to sync all events from the initial list request.
func (c *CustomCacheInformer) WaitForSync(ctx context.Context) error {
	interval := waitForSyncInitialInterval

	for {
		if c.HasSynced() {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(interval):
			// Exponential backoff up to max interval
			interval = min(interval*2, waitForSyncMaxInterval)
		}
	}
}

func (c *CustomCacheInformer) toResourceObject(obj any) (resource.Object, error) {
	return toResourceObject(obj, c.schema)
}

func (c *CustomCacheInformer) errorHandler(ctx context.Context, err error) {
	if c.opts.ErrorHandler == nil {
		return
	}

	c.opts.ErrorHandler(ctx, err)
}

// NewListerWatcher returns a cache.ListerWatcher for the provided resource.Schema that uses the given ListWatchClient.
// The List and Watch requests will always use the provided namespace and labelFilters.
func NewListerWatcher(client ListWatchClient, sch resource.Schema, filterOptions ListWatchOptions) cache.ListerWatcher {
	return &cache.ListWatch{
		ListWithContextFunc: func(ctx context.Context, options metav1.ListOptions) (runtime.Object, error) {
			ctx, span := GetTracer().Start(ctx, "informer-list")
			defer span.End()
			span.SetAttributes(
				attribute.String("kind.name", sch.Kind()),
				attribute.String("kind.group", sch.Group()),
				attribute.String("kind.version", sch.Version()),
				attribute.String("namespace", filterOptions.Namespace),
			)
			resp := resource.UntypedList{}
			err := client.ListInto(ctx, filterOptions.Namespace, resource.ListOptions{
				LabelFilters:    filterOptions.LabelFilters,
				FieldSelectors:  filterOptions.FieldSelectors,
				Continue:        options.Continue,
				Limit:           int(options.Limit),
				ResourceVersion: options.ResourceVersion,
			}, &resp)
			if err != nil {
				return nil, err
			}
			return &resp, nil
		},
		WatchFuncWithContext: func(ctx context.Context, options metav1.ListOptions) (watch.Interface, error) {
			ctx, span := GetTracer().Start(ctx, "informer-watch")
			defer span.End()
			span.SetAttributes(
				attribute.String("kind.name", sch.Kind()),
				attribute.String("kind.group", sch.Group()),
				attribute.String("kind.version", sch.Version()),
				attribute.String("namespace", filterOptions.Namespace),
			)
			opts := resource.WatchOptions{
				ResourceVersion:      options.ResourceVersion,
				ResourceVersionMatch: string(options.ResourceVersionMatch),
				LabelFilters:         filterOptions.LabelFilters,
				FieldSelectors:       filterOptions.FieldSelectors,
				AllowWatchBookmarks:  options.AllowWatchBookmarks,
				TimeoutSeconds:       options.TimeoutSeconds,
				SendInitialEvents:    options.SendInitialEvents,
			}
			watchResp, err := client.Watch(ctx, filterOptions.Namespace, opts)
			if err != nil {
				return nil, err
			}
			if cast, ok := watchResp.(KubernetesCompatibleWatch); ok {
				return cast.KubernetesWatch(), nil
			}
			// If we can't extract a pure watch.Interface from the watch response, we have to make one
			w := &watchWrapper{
				watch: watchResp,
				ch:    make(chan watch.Event),
			}
			go w.run(ctx)
			return w, nil
		},
	}
}

func toResourceEventHandlerFuncs(
	handler ResourceWatcher,
	transformer func(any) (resource.Object, error),
	errorHandler func(context.Context, error),
	ctxProvider func() (context.Context, context.CancelFunc),
) *cache.ResourceEventHandlerFuncs {
	return &cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj any) {
			ctx, cancel := ctxProvider()
			defer cancel()

			ctx, span := GetTracer().Start(ctx, "informer-event-add")
			defer span.End()
			cast, err := transformer(obj)
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
				errorHandler(ctx, err)
				return
			}
			gvk := cast.GroupVersionKind()
			span.SetAttributes(
				attribute.String("kind.name", gvk.Kind),
				attribute.String("kind.group", gvk.Group),
				attribute.String("kind.version", gvk.Version),
				attribute.String("namespace", cast.GetNamespace()),
				attribute.String("name", cast.GetName()),
			)
			err = handler.Add(ctx, cast)
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
				errorHandler(ctx, err)
			}
		},
		UpdateFunc: func(oldObj, newObj any) {
			ctx, cancel := ctxProvider()
			defer cancel()

			ctx, span := GetTracer().Start(ctx, "informer-event-update")
			defer span.End()
			cOld, err := transformer(oldObj)
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
				errorHandler(ctx, err)
				return
			}
			// None of these should change between old and new, so we can set them here with old's values
			gvk := cOld.GroupVersionKind()
			span.SetAttributes(
				attribute.String("kind.name", gvk.Kind),
				attribute.String("kind.group", gvk.Group),
				attribute.String("kind.version", gvk.Version),
				attribute.String("namespace", cOld.GetNamespace()),
				attribute.String("name", cOld.GetName()),
			)
			cNew, err := transformer(newObj)
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
				errorHandler(ctx, err)
				return
			}
			err = handler.Update(ctx, cOld, cNew)
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
				errorHandler(ctx, err)
			}
		},
		DeleteFunc: func(obj any) {
			ctx, cancel := ctxProvider()
			defer cancel()

			ctx, span := GetTracer().Start(ctx, "informer-event-delete")
			defer span.End()
			cast, err := transformer(obj)
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
				errorHandler(ctx, err)
				return
			}
			gvk := cast.GroupVersionKind()
			span.SetAttributes(
				attribute.String("kind.name", gvk.Kind),
				attribute.String("kind.group", gvk.Group),
				attribute.String("kind.version", gvk.Version),
				attribute.String("namespace", cast.GetNamespace()),
				attribute.String("name", cast.GetName()),
			)
			err = handler.Delete(ctx, cast)
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
				errorHandler(ctx, err)
			}
		},
	}
}

// newInformer is copied from the kubernetes unexported method of the same name in client-go/tools/cache/controller.go,
// to allow the CustomCacheInformer to create a new cache.Controller informer that specifies the KnownObjects cache.Store
// to use in the cache.DeltaFIFO used by the controller, as otherwise this cannot be specified in all exported methods.
func newInformer(
	lw cache.ListerWatcher,
	objType runtime.Object,
	objDesc string,
	resyncPeriod time.Duration,
	h cache.ResourceEventHandler,
	clientState cache.Store,
	transformer cache.TransformFunc,
	useWatchList bool,
	watchListPageSize int64,
) cache.Controller {
	// This will hold incoming changes. Note how we pass clientState in as a
	// KeyLister, that way resync operations will result in the correct set
	// of update/delete deltas.
	fifo := cache.NewDeltaFIFOWithOptions(cache.DeltaFIFOOptions{
		KnownObjects:          clientState,
		EmitDeltaTypeReplaced: true,
		Transformer:           transformer,
	})

	cfg := &cache.Config{
		Queue:             fifo,
		ListerWatcher:     lw,
		ObjectType:        objType,
		ObjectDescription: objDesc,
		FullResyncPeriod:  resyncPeriod,

		Process: func(obj any, isInInitialList bool) error {
			if deltas, ok := obj.(cache.Deltas); ok {
				return processDeltas(h, clientState, deltas, isInInitialList)
			}
			return errors.New("object given as Process argument is not Deltas")
		},
	}

	controller := customcache.NewController(cfg)
	controller.UseWatchList = useWatchList
	controller.WatchListPageSize = watchListPageSize
	return controller
}

// processDeltas is mostly copied from the kubernetes method of the same name in client-go/tools/cache/controller.go,
// as it is required by the newInformer call.
// Multiplexes updates in the form of a list of Deltas into a Store, and informs
// a given handler of events OnUpdate, OnAdd, OnDelete.
func processDeltas(
	// Object which receives event notifications from the given deltas
	handler cache.ResourceEventHandler,
	clientState cache.Store,
	deltas cache.Deltas,
	isInInitialList bool,
) error {
	// from oldest to newest
	for _, d := range deltas {
		obj := d.Object
		switch d.Type {
		case cache.Sync, cache.Replaced, cache.Added, cache.Updated:
			// TODO: it would be nice to treat cache.Sync events differently here,
			// so we could tell the difference between a cache sync (period re-emission of all items in the cache)
			// from an update sourced from the API server watch request.
			if old, exists, err := clientState.Get(obj); err == nil && exists {
				if err := clientState.Update(obj); err != nil {
					return err
				}
				handler.OnUpdate(old, obj)
			} else {
				if err := clientState.Add(obj); err != nil {
					return err
				}
				handler.OnAdd(obj, isInInitialList)
			}
		case cache.Deleted:
			if err := clientState.Delete(obj); err != nil {
				return err
			}
			handler.OnDelete(obj)
		default:
		}
	}
	return nil
}
