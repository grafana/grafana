package kubeconfig

import (
	"sync"
)

// Initializer is a function that initializes some value T that depends on a Config.
type Initializer[T any] func(cfg NamespacedConfig) (T, error)

// CachingInitializer returns an Initializer that caches values returned from ini.
//
// Caching is based on the Config passed to ini,
// i.e. calling a CachingInitializer multiple times with the same Config
// will only call ini once and return cached value for all calls but the first one.
//
// Only one value is cached at any given time. Passing a different Config will replace cached value,
// i.e. with calls like `ini(config1), ini(config2), ini(config1)` the third call will not be cached.
func CachingInitializer[T any](ini Initializer[T]) Initializer[T] {
	var (
		// TODO: we could cache multiple values with a map and CRC of the config.
		// Is it worth it?
		hasCached bool
		cachedCfg NamespacedConfig
		cachedVal T
		cacheLock sync.RWMutex
	)

	return func(cfg NamespacedConfig) (T, error) {
		cacheLock.RLock()
		if hasCached && cachedCfg.Equals(cfg) {
			defer cacheLock.RUnlock()
			// If we've already initialized the value
			// AND the config hasn't changed,
			// just return cached value.
			return cachedVal, nil
		}
		cacheLock.RUnlock()

		val, err := ini(cfg)
		if err != nil {
			return cachedVal, err
		}

		cacheLock.Lock()
		hasCached = true
		cachedVal = val
		cachedCfg = cfg
		cacheLock.Unlock()

		return cachedVal, nil
	}
}
