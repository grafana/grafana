package instancemgmt

import (
	"context"
	"reflect"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	activeInstances = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "plugins",
		Name:      "active_instances",
		Help:      "The number of active plugin instances",
	})
)

const defaultDisposeTTL = 5 * time.Second // Time to wait before disposing an instance

// Instance is a marker interface for an instance.
type Instance interface{}

// InstanceDisposer is implemented by an Instance that has a Dispose method,
// which defines that the instance is disposable.
//
// InstanceManager will call the Dispose method before an Instance is replaced
// with a new Instance. This allows an Instance to clean up resources in use,
// if any.
type InstanceDisposer interface {
	Dispose()
}

// InstanceCallbackFunc defines the callback function of the InstanceManager.Do method.
// The argument provided will of type Instance.
type InstanceCallbackFunc interface{}

// InstanceManager manages the lifecycle of instances.
type InstanceManager interface {
	// Get returns an Instance.
	//
	// If Instance is cached and not updated it's returned. If Instance is not cached or
	// updated, a new Instance is created and cached before returned.
	Get(ctx context.Context, pluginContext backend.PluginContext) (Instance, error)

	// Do provides an Instance as argument to fn.
	//
	// If Instance is cached and not updated provides as argument to fn. If Instance is not cached or
	// updated, a new Instance is created and cached before provided as argument to fn.
	Do(ctx context.Context, pluginContext backend.PluginContext, fn InstanceCallbackFunc) error
}

// CachedInstance a cached Instance.
type CachedInstance struct {
	PluginContext backend.PluginContext
	instance      Instance
}

// InstanceProvider defines an instance provider, providing instances.
type InstanceProvider interface {
	// GetKey returns a cache key to be used for caching an Instance.
	GetKey(ctx context.Context, pluginContext backend.PluginContext) (interface{}, error)

	// NeedsUpdate returns whether a cached Instance have been updated.
	NeedsUpdate(ctx context.Context, pluginContext backend.PluginContext, cachedInstance CachedInstance) bool

	// NewInstance creates a new Instance.
	NewInstance(ctx context.Context, pluginContext backend.PluginContext) (Instance, error)
}

// New create a new instance manager.
func New(provider InstanceProvider) InstanceManager {
	return newInstanceManager(provider, defaultDisposeTTL)
}

func newInstanceManager(provider InstanceProvider, disposeTTL time.Duration) *instanceManager {
	if provider == nil {
		panic("provider cannot be nil")
	}

	if disposeTTL <= 0 {
		disposeTTL = defaultDisposeTTL
	}

	return &instanceManager{
		provider:   provider,
		cache:      sync.Map{},
		locker:     newLocker(),
		disposeTTL: disposeTTL,
	}
}

type instanceManager struct {
	locker     *locker
	provider   InstanceProvider
	cache      sync.Map
	disposeTTL time.Duration
}

func (im *instanceManager) Get(ctx context.Context, pluginContext backend.PluginContext) (Instance, error) {
	cacheKey, err := im.provider.GetKey(ctx, pluginContext)
	if err != nil {
		return nil, err
	}
	// Double-checked locking for update/create criteria
	im.locker.RLock(cacheKey)
	item, ok := im.cache.Load(cacheKey)
	im.locker.RUnlock(cacheKey)

	if ok {
		ci := item.(CachedInstance)
		needsUpdate := im.provider.NeedsUpdate(ctx, pluginContext, ci)

		if !needsUpdate {
			return ci.instance, nil
		}
	}

	im.locker.Lock(cacheKey)
	defer im.locker.Unlock(cacheKey)

	if item, ok := im.cache.Load(cacheKey); ok {
		ci := item.(CachedInstance)
		needsUpdate := im.provider.NeedsUpdate(ctx, pluginContext, ci)

		if !needsUpdate {
			return ci.instance, nil
		}

		if disposer, valid := ci.instance.(InstanceDisposer); valid {
			time.AfterFunc(im.disposeTTL, func() {
				disposer.Dispose()
				activeInstances.Dec()
			})
		} else {
			activeInstances.Dec()
		}
	}

	instance, err := im.provider.NewInstance(ctx, pluginContext)
	if err != nil {
		return nil, err
	}
	im.cache.Store(cacheKey, CachedInstance{
		PluginContext: pluginContext,
		instance:      instance,
	})
	activeInstances.Inc()

	return instance, nil
}

func (im *instanceManager) Do(ctx context.Context, pluginContext backend.PluginContext, fn InstanceCallbackFunc) error {
	if fn == nil {
		panic("fn cannot be nil")
	}

	instance, err := im.Get(ctx, pluginContext)
	if err != nil {
		return err
	}

	callInstanceHandlerFunc(fn, instance)
	return nil
}

func callInstanceHandlerFunc(fn InstanceCallbackFunc, instance interface{}) {
	var params = []reflect.Value{}
	params = append(params, reflect.ValueOf(instance))
	reflect.ValueOf(fn).Call(params)
}
