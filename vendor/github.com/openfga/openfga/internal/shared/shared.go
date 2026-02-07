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

// WithLogger sets the logger for CachedDatastore.
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
	s := &SharedDatastoreResources{
		WaitGroup:         &sync.WaitGroup{},
		SingleflightGroup: sharedSf,
		ServerCtx:         sharedCtx,
		CacheController:   cachecontroller.NewNoopCacheController(),
		Logger:            logger.NewNoopLogger(),
		SharedIteratorStorage: sharediterator.NewSharedIteratorDatastoreStorage(
			sharediterator.WithSharedIteratorDatastoreStorageLimit(
				int(settings.SharedIteratorLimit))),
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

	if settings.ShouldCreateCacheController() {
		s.CacheController = cachecontroller.NewCacheController(ds, s.CheckCache, settings.CacheControllerTTL, settings.CheckIteratorCacheTTL, cachecontroller.WithLogger(s.Logger))
	}

	// The default behavior is to use the same cache instance for both the
	// check cache and the shadow cache. However, if the user opts in to use a
	// separate cache instance for the shadow cache, we need to create new
	// instances.
	s.ShadowCheckCache = s.CheckCache
	s.ShadowCacheController = s.CacheController

	if settings.ShouldCreateShadowNewCache() {
		var err error
		s.ShadowCheckCache, err = storage.NewInMemoryLRUCache([]storage.InMemoryLRUCacheOpt[any]{
			storage.WithMaxCacheSize[any](int64(settings.CheckCacheLimit)),
		}...)
		if err != nil {
			return nil, err
		}
	}

	if settings.ShouldCreateShadowCacheController() {
		s.ShadowCacheController = cachecontroller.NewCacheController(ds, s.ShadowCheckCache, settings.CacheControllerTTL, settings.CheckIteratorCacheTTL, cachecontroller.WithLogger(s.Logger))
	}

	for _, opt := range opts {
		opt(s)
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
