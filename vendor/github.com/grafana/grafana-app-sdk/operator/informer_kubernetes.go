package operator

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/health"
	"github.com/grafana/grafana-app-sdk/resource"
)

var (
	_ Informer     = &KubernetesBasedInformer{}
	_ health.Check = &KubernetesBasedInformer{}
)

// KubernetesBasedInformer is a k8s apimachinery-based informer. It wraps a k8s cache.SharedIndexInformer,
// and works most optimally with a client that has a Watch response that implements KubernetesCompatibleWatch.
type KubernetesBasedInformer struct {
	SharedIndexInformer cache.SharedIndexInformer
	// HealthCheckIgnoreSync will set the KubernetesBasedInformer HealthCheck to return ok once the informer is started,
	// rather than waiting for the informer to finish with its initial list sync.
	// You may want to set this to `true` if you have a particularly long initial sync period and don't want readiness checks failing.
	HealthCheckIgnoreSync bool
	schema                resource.Kind
	runContext            context.Context
	eventTimeout          time.Duration
	errorHandlerFn        func(context.Context, error)
	healthCheckName       string
}

// InformerOptions are generic options for all Informer implementations.
type InformerOptions struct {
	// ListWatchOptions are the options for filtering the watch based on namespace and other compatible filters.
	ListWatchOptions ListWatchOptions
	// CacheResyncInterval is the interval at which the informer will emit CacheResync events for all resources in the cache.
	// This is distinct from a full resync, as no information is fetched from the API server.
	// Changes to this value after run() is called will not take effect.
	// An empty value will disable cache resyncs.
	CacheResyncInterval time.Duration
	// EventTimeout is the timeout for an event to be processed.
	// If an event is not processed within this timeout, it will be dropped.
	// The timeout cannot be larger than the cache resync interval, if it is,
	// the cache resync interval will be used instead.
	// An empty value will disable event timeouts.
	EventTimeout time.Duration
	// ErrorHandler is called if the informer encounters an error which does not stop the informer from running,
	// but may stop it from processing a given event.
	ErrorHandler func(context.Context, error)
	// HealthCheckIgnoreSync will set the KubernetesBasedInformer HealthCheck to return ok once the informer is started,
	// rather than waiting for the informer to finish with its initial list sync.
	// You may want to set this to `true` if you have a particularly long initial sync period and don't want readiness checks failing.
	HealthCheckIgnoreSync bool
	// UseWatchList if turned on instructs the reflector to open a stream to bring data from the API server.
	// Streaming has the primary advantage of using fewer server's resources to fetch data.
	//
	// The old behavior establishes a LIST request which gets data in chunks.
	// Paginated list is less efficient and depending on the actual size of objects
	// might result in an increased memory consumption of the APIServer.
	//
	// Defaults to false. Requires Kubernetes 1.27+ when enabled.
	// See https://github.com/kubernetes/enhancements/tree/master/keps/sig-api-machinery/3157-watch-list#design-details
	UseWatchList bool
	// WatchListPageSize is the requested chunk size for paginated LIST operations.
	// This significantly reduces memory usage when watching large numbers of objects (>10K).
	// Recommended values: 5000-10000 for most use cases.
	// Note: This only affects traditional LIST operations. It does NOT apply to watch-list streaming (UseWatchList).
	// An empty value (0) will use client-go's default pagination behavior based on resource version.
	WatchListPageSize int64
	// MaxConcurrentWorkers is the maximum number of concurrent workers for event processing in ConcurrentInformer.
	// Each worker maintains a queue of events which are processed sequentially.
	// Events for a particular object are assigned to the same worker to maintain in-order delivery per object.
	// An empty value (0) will use the default of 10 workers.
	MaxConcurrentWorkers uint64
}

// NewKubernetesBasedInformer creates a new KubernetesBasedInformer for the provided kind and options,
// using the ListWatchClient provided to do its List and Watch requests applying provided labelFilters if it is not empty.
func NewKubernetesBasedInformer(
	sch resource.Kind, client ListWatchClient, options InformerOptions,
) (*KubernetesBasedInformer, error) {
	if client == nil {
		return nil, errors.New("client cannot be nil")
	}

	var timeout time.Duration
	if options.EventTimeout > 0 {
		timeout = options.EventTimeout
	}
	if options.CacheResyncInterval > 0 && options.CacheResyncInterval < timeout {
		timeout = options.CacheResyncInterval
	}

	var errorHandler func(context.Context, error)
	if options.ErrorHandler != nil {
		errorHandler = options.ErrorHandler
	} else {
		errorHandler = DefaultErrorHandler
	}
	// Compute a unique name for the health check based on what the informer is watching
	healthCheckName := fmt.Sprintf("informer-%s.%s/%s", sch.Plural(), sch.Group(), sch.Version())
	if options.ListWatchOptions.Namespace != "" {
		healthCheckName = fmt.Sprintf("%s/namespaces/%s", healthCheckName, options.ListWatchOptions.Namespace)
	}
	if len(options.ListWatchOptions.LabelFilters) > 0 || len(options.ListWatchOptions.FieldSelectors) > 0 {
		params := make([]string, 0)
		if len(options.ListWatchOptions.LabelFilters) > 0 {
			params = append(params, fmt.Sprintf("labelSelector=%s", strings.Join(options.ListWatchOptions.LabelFilters, ",")))
		}
		if len(options.ListWatchOptions.FieldSelectors) > 0 {
			params = append(params, fmt.Sprintf("fieldSelector=%s", strings.Join(options.ListWatchOptions.FieldSelectors, ",")))
		}
		healthCheckName = fmt.Sprintf("%s?%s", healthCheckName, strings.Join(params, "&"))
	}

	return &KubernetesBasedInformer{
		schema:         sch,
		eventTimeout:   timeout,
		errorHandlerFn: errorHandler,
		SharedIndexInformer: cache.NewSharedIndexInformer(
			NewListerWatcher(client, sch, options.ListWatchOptions),
			nil,
			options.CacheResyncInterval,
			cache.Indexers{
				cache.NamespaceIndex: cache.MetaNamespaceIndexFunc,
			}),
		HealthCheckIgnoreSync: options.HealthCheckIgnoreSync,
		healthCheckName:       healthCheckName,
	}, nil
}

// AddEventHandler adds a ResourceWatcher as an event handler for watch events from the informer.
// Event handlers are not guaranteed to be executed in parallel or in any particular order by the underlying
// kubernetes apimachinery code. If you want to coordinate ResourceWatchers, use am InformerController.
// nolint:dupl
func (k *KubernetesBasedInformer) AddEventHandler(handler ResourceWatcher) error {
	// TODO: AddEventHandler returns the registration handle which should be supplied to RemoveEventHandler
	// but we don't currently call the latter. We should add RemoveEventHandler to the informer API
	// and let controller call it when appropriate.
	_, err := k.SharedIndexInformer.AddEventHandler(
		toResourceEventHandlerFuncs(
			handler, k.toResourceObject, k.errorHandler,
			func() (context.Context, context.CancelFunc) {
				if k.runContext != nil {
					return k.runContext, func() {}
				}

				if k.eventTimeout > 0 {
					return context.WithTimeout(context.Background(), k.eventTimeout)
				}

				return context.WithCancel(context.Background())
			},
		),
	)

	return err
}

// Run starts the informer and blocks until stopCh receives a message
func (k *KubernetesBasedInformer) Run(ctx context.Context) error {
	k.runContext = ctx
	defer func() {
		k.runContext = nil
	}()
	k.SharedIndexInformer.Run(ctx.Done())
	return nil
}

// Schema returns the resource.Schema this informer is set up for
func (k *KubernetesBasedInformer) Schema() resource.Schema {
	return k.schema
}

func (k *KubernetesBasedInformer) HealthCheck(context.Context) error {
	if !k.SharedIndexInformer.HasSynced() && !k.HealthCheckIgnoreSync {
		return errors.New("informer has not synced")
	}

	if k.SharedIndexInformer.IsStopped() {
		return errors.New("informer is stopped")
	}

	return nil
}

func (k *KubernetesBasedInformer) HealthCheckName() string {
	return k.healthCheckName
}

// WaitForSync waits for the informer to sync.
// If the sync is not complete within the context deadline, it will return a timeout error.
func (k *KubernetesBasedInformer) WaitForSync(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			if k.SharedIndexInformer.HasSynced() {
				return nil
			}
		}
	}
}

func (k *KubernetesBasedInformer) toResourceObject(obj any) (resource.Object, error) {
	return toResourceObject(obj, k.schema)
}

func (k *KubernetesBasedInformer) errorHandler(ctx context.Context, err error) {
	if k.errorHandlerFn != nil {
		k.errorHandlerFn(ctx, err)
	}
}

func toResourceObject(obj any, kind resource.Kind) (resource.Object, error) {
	// Nil check
	if obj == nil {
		return nil, errors.New("object cannot be nil")
	}

	// First, check if it's already a resource.Object
	if cast, ok := obj.(resource.Object); ok {
		return cast, nil
	}

	// Is this an instance of ResourceObjectWrapper? Unwrap it if so
	if cast, ok := obj.(ResourceObjectWrapper); ok {
		return cast.ResourceObject(), nil
	}

	// Next, see if it has an `Into` method for casting to a resource.Object
	if cast, ok := obj.(ConvertableIntoResourceObject); ok {
		newObj := kind.ZeroValue()
		// TODO: better
		err := cast.Into(newObj, kind.Codec(resource.KindEncodingJSON))
		return newObj, err
	}
	// TODO: other methods...?

	return nil, fmt.Errorf("unable to cast %v into resource.Object", reflect.TypeOf(obj))
}

// ConvertableIntoResourceObject describes any object which can be marshaled into a resource.Object.
// This is specifically useful for objects which may wrap underlying data which can be marshaled into a resource.Object,
// but need the exact implementation provided to them (by `into`).
type ConvertableIntoResourceObject interface {
	Into(object resource.Object, codec resource.Codec) error
}

// ResourceObjectWrapper describes anything which wraps a resource.Object, such that it can be extracted.
type ResourceObjectWrapper interface {
	ResourceObject() resource.Object
}

// KubernetesCompatibleWatch describes a watch response that either is wrapping a kubernetes watch.Interface,
// or can return a compatibility layer that implements watch.Interface.
type KubernetesCompatibleWatch interface {
	KubernetesWatch() watch.Interface
}

// ListWatchClient describes a client which can do ListInto and Watch requests.
type ListWatchClient interface {
	ListInto(ctx context.Context, namespace string, options resource.ListOptions, into resource.ListObject) error
	Watch(ctx context.Context, namespace string, options resource.WatchOptions) (resource.WatchResponse, error)
}

type watchWrapper struct {
	watch resource.WatchResponse
	ch    chan watch.Event
}

func (w *watchWrapper) run(ctx context.Context) {
	defer close(w.ch)

	for {
		select {
		case <-ctx.Done():
			return
		case e := <-w.watch.WatchEvents():
			w.ch <- watch.Event{
				Type:   watch.EventType(e.EventType),
				Object: e.Object,
			}
		}
	}
}

func (w *watchWrapper) Stop() {
	w.watch.Stop()
}

func (w *watchWrapper) ResultChan() <-chan watch.Event {
	return w.ch
}
