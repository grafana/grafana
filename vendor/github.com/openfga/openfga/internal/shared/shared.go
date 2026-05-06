package shared

import (
	"context"
	"sync"

	"golang.org/x/sync/singleflight"

	"github.com/openfga/openfga/internal/cachecontroller"
	"github.com/openfga/openfga/pkg/logger"
	serverconfig "github.com/openfga/openfga/pkg/server/config"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/storagewrappers/sharediterator"
)

// SharedDatastoreResourcesOpt defines an option that can be used to change the behavior of SharedDatastoreResources
// instance.
type SharedDatastoreResourcesOpt func(*SharedDatastoreResources)

// WithLogger sets the logger for SharedDatastoreResources.
func WithLogger(logger logger.Logger) SharedDatastoreResourcesOpt {
	return func(scr *SharedDatastoreResources) {
		scr.Logger = logger
	}
}

// WithCacheController allows overriding the default cacheController created in NewSharedDatastoreResources().
func WithCacheController(cacheController cachecontroller.CacheController) SharedDatastoreResourcesOpt {
	return func(scr *SharedDatastoreResources) {
		scr.CacheController = cacheController
	}
}

// WithShadowCacheController allows overriding the default shadow cacheController created in NewSharedDatastoreResources().
func WithShadowCacheController(cacheController cachecontroller.CacheController) SharedDatastoreResourcesOpt {
	return func(scr *SharedDatastoreResources) {
		scr.ShadowCacheController = cacheController
	}
}

// SharedDatastoreResources contains resources that can be shared across Check requests.
type SharedDatastoreResources struct {
	SingleflightGroup     *singleflight.Group
	WaitGroup             *sync.WaitGroup
	ServerCtx             context.Context
	CheckCache            storage.InMemoryCache[any]
	CacheController       cachecontroller.CacheController
	ShadowCheckCache      storage.InMemoryCache[any]
	ShadowCacheController cachecontroller.CacheController
	Logger                logger.Logger
	SharedIteratorStorage *sharediterator.Storage
}

func NewSharedDatastoreResources(
	sharedCtx context.Context,
	sharedSf *singleflight.Group,
	ds storage.OpenFGADatastore,
	settings serverconfig.CacheSettings,
	opts ...SharedDatastoreResourcesOpt,
) (*SharedDatastoreResources, error) {
	defaultCacheController := cachecontroller.NewNoopCacheController()

	s := &SharedDatastoreResources{
		WaitGroup:         &sync.WaitGroup{},
		SingleflightGroup: sharedSf,
		ServerCtx:         sharedCtx,
		CacheController:   defaultCacheController,
		Logger:            logger.NewNoopLogger(),
		SharedIteratorStorage: sharediterator.NewSharedIteratorDatastoreStorage(
			sharediterator.WithSharedIteratorDatastoreStorageLimit(
				int(settings.SharedIteratorLimit))),
	}

	// Apply opts now to get SharedDatastoresResources customizations for subsequent logic.
	for _, opt := range opts {
		opt(s)
	}

	if settings.ShouldCreateNewCache() {
		var err error
		s.CheckCache, err = storage.NewInMemoryLRUCache([]storage.InMemoryLRUCacheOpt[any]{
			storage.WithMaxCacheSize[any](int64(settings.CheckCacheLimit)),
		}...)
		if err != nil {
			return nil, err
		}
	}

	// Only create a cache controller if it wasn't already set via opts.
	if settings.ShouldCreateCacheController() && s.CacheController == defaultCacheController {
		s.CacheController = cachecontroller.NewCacheController(ds, s.CheckCache, settings.CacheControllerTTL, settings.CheckQueryCacheTTL, settings.CheckIteratorCacheTTL, cachecontroller.WithLogger(s.Logger))
	}

	// The default behavior is to use the same cache instance for both the
	// check cache and the shadow cache. However, if the user opts in to use a
	// separate cache instance for the shadow cache, we need to create new
	// instances.
	// Set shadow defaults only if opts didn't already customize them.
	if s.ShadowCheckCache == nil {
		s.ShadowCheckCache = s.CheckCache
	}
	if s.ShadowCacheController == nil {
		s.ShadowCacheController = s.CacheController
	}

	if settings.ShouldCreateShadowNewCache() {
		var err error
		s.ShadowCheckCache, err = storage.NewInMemoryLRUCache([]storage.InMemoryLRUCacheOpt[any]{
			storage.WithMaxCacheSize[any](int64(settings.CheckCacheLimit)),
		}...)
		if err != nil {
			return nil, err
		}
	}

	// Only create a shadow cache controller if it wasn't already set via opts.
	if settings.ShouldCreateShadowCacheController() && s.ShadowCacheController == s.CacheController {
		s.ShadowCacheController = cachecontroller.NewCacheController(ds, s.ShadowCheckCache, settings.CacheControllerTTL, settings.CheckQueryCacheTTL, settings.CheckIteratorCacheTTL, cachecontroller.WithLogger(s.Logger))
	}

	return s, nil
}

func (s *SharedDatastoreResources) Close() {
	// wait for any goroutines still in flight before
	// closing the cache instance to avoid data races
	s.WaitGroup.Wait()
	if s.CheckCache != nil {
		s.CheckCache.Stop()
	}
	if s.ShadowCheckCache != nil && s.CheckCache != s.ShadowCheckCache {
		s.ShadowCheckCache.Stop()
	}
}
