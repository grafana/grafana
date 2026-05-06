package operator

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/resource"
)

var _ Informer = &KubernetesBasedInformer{}

// KubernetesBasedInformer is a k8s apimachinery-based informer. It wraps a k8s cache.SharedIndexInformer,
// and works most optimally with a client that has a Watch response that implements KubernetesCompatibleWatch.
type KubernetesBasedInformer struct {
	ErrorHandler        func(context.Context, error)
	SharedIndexInformer cache.SharedIndexInformer
	schema              resource.Kind
	runContext          context.Context
}

type KubernetesBasedInformerOptions struct {
	// ListWatchOptions are the options for filtering the watch based on namespace and other compatible filters.
	ListWatchOptions ListWatchOptions
	// CacheResyncInterval is the interval at which the informer will emit CacheResync events for all resources in the cache.
	// This is distinct from a full resync, as no information is fetched from the API server.
	// An empty value will disable cache resyncs.
	CacheResyncInterval time.Duration
}

// NewKubernetesBasedInformer creates a new KubernetesBasedInformer for the provided kind and options,
// using the ListWatchClient provided to do its List and Watch requests applying provided labelFilters if it is not empty.
func NewKubernetesBasedInformer(sch resource.Kind, client ListWatchClient, options KubernetesBasedInformerOptions) (
	*KubernetesBasedInformer, error) {
	if client == nil {
		return nil, fmt.Errorf("client cannot be nil")
	}

	return &KubernetesBasedInformer{
		schema:       sch,
		ErrorHandler: DefaultErrorHandler,
		SharedIndexInformer: cache.NewSharedIndexInformer(
			NewListerWatcher(client, sch, options.ListWatchOptions),
			nil,
			options.CacheResyncInterval,
			cache.Indexers{
				cache.NamespaceIndex: cache.MetaNamespaceIndexFunc,
			}),
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
	_, err := k.SharedIndexInformer.AddEventHandler(toResourceEventHandlerFuncs(handler, k.toResourceObject, k.errorHandler, func() context.Context {
		if k.runContext != nil {
			return k.runContext
		}
		return context.Background()
	}))

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

func (k *KubernetesBasedInformer) toResourceObject(obj any) (resource.Object, error) {
	return toResourceObject(obj, k.schema)
}

func (k *KubernetesBasedInformer) errorHandler(ctx context.Context, err error) {
	if k.ErrorHandler != nil {
		k.ErrorHandler(ctx, err)
	}
}

func toResourceObject(obj any, kind resource.Kind) (resource.Object, error) {
	// Nil check
	if obj == nil {
		return nil, fmt.Errorf("object cannot be nil")
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

func (w *watchWrapper) start() {
	for e := range w.watch.WatchEvents() {
		w.ch <- watch.Event{
			Type:   watch.EventType(e.EventType),
			Object: e.Object,
		}
	}
}

func (w *watchWrapper) Stop() {
	w.watch.Stop()
	close(w.ch)
}

func (w *watchWrapper) ResultChan() <-chan watch.Event {
	return w.ch
}
