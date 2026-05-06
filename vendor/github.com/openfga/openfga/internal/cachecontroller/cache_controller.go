package cachecontroller

import (
	"context"
	"math"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/build"
	"github.com/openfga/openfga/internal/concurrency"
	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/telemetry"
	"github.com/openfga/openfga/pkg/tuple"
)

var (
	tracer = otel.Tracer("internal/cachecontroller")

	cacheTotalCounter = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: build.ProjectName,
		Name:      "cachecontroller_cache_total_count",
		Help:      "The total number of cachecontroller requests.",
	})

	cacheHitCounter = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: build.ProjectName,
		Name:      "cachecontroller_cache_hit_count",
		Help:      "The total number of cache hits from cachecontroller requests within the TTL.",
	})

	cacheInvalidationCounter = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: build.ProjectName,
		Name:      "cachecontroller_cache_invalidation_count",
		Help:      "The total number of invalidations performed by the cache controller.",
	})

	findChangesAndInvalidateHistogram = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace:                       build.ProjectName,
		Name:                            "cachecontroller_invalidation_duration_ms",
		Help:                            "The duration (in ms) required for cache controller to find changes and invalidate labeled by whether invalidation is required and buckets of changes size.",
		Buckets:                         []float64{5, 10, 25, 50, 100, 200, 500, 1000, 5000},
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  100,
		NativeHistogramMinResetDuration: time.Hour,
	}, []string{"invalidation_type"})
)

type CacheController interface {
	// DetermineInvalidationTime returns the timestamp of the last write for the
	// specified store if it was in cache, else it returns the Zero time and
	// triggers InvalidateIfNeeded(). The last write time can be used to determine
	// whether a cached entry is still valid - if it was cached before the last
	// write to the store, it can't be trusted anymore.
	DetermineInvalidationTime(context.Context, string) time.Time

	// InvalidateIfNeeded checks to see if an invalidation is currently in progress for a store,
	// and if not it will spawn a goroutine to invalidate cached records conditionally
	// based on timestamp. It may invalidate all cache records, some, or none.
	InvalidateIfNeeded(context.Context, string)
}

type NoopCacheController struct{}

func (c *NoopCacheController) DetermineInvalidationTime(_ context.Context, _ string) time.Time {
	return time.Time{}
}

func (c *NoopCacheController) InvalidateIfNeeded(_ context.Context, _ string) {
}

func NewNoopCacheController() CacheController {
	return &NoopCacheController{}
}

// InMemoryCacheControllerOpt defines an option that can be used to change the behavior of InMemoryCacheController
// instance.
type InMemoryCacheControllerOpt func(*InMemoryCacheController)

// WithLogger sets the logger for InMemoryCacheController.
func WithLogger(logger logger.Logger) InMemoryCacheControllerOpt {
	return func(inm *InMemoryCacheController) {
		inm.logger = logger
	}
}

// InMemoryCacheController will invalidate cache iterator (InMemoryCache) and sub problem cache (CachedCheckResolver) entries
// that are more recent than the last write for the specified store.
// Note that the invalidation is done asynchronously, triggered by Check requests,
// or List Objects requests when list objects iterator cache is enabled.
// It will be eventually consistent.
type InMemoryCacheController struct {
	ds    storage.OpenFGADatastore
	cache storage.InMemoryCache[any]

	// minInvalidationInterval is the minimum time interval for
	// DetermineInvalidationTime to trigger cache invalidation for a given store.
	// This is the cache controller "TTL".
	minInvalidationInterval time.Duration
	queryCacheTTL           time.Duration
	iteratorCacheTTL        time.Duration
	inflightInvalidations   sync.Map
	logger                  logger.Logger

	// for testing purposes
	wg sync.WaitGroup
}

func NewCacheController(
	ds storage.OpenFGADatastore,
	cache storage.InMemoryCache[any],
	ttl time.Duration,
	queryCacheTTL time.Duration,
	iteratorCacheTTL time.Duration,
	opts ...InMemoryCacheControllerOpt,
) CacheController {
	c := &InMemoryCacheController{
		ds:                      ds,
		cache:                   cache,
		minInvalidationInterval: ttl,
		queryCacheTTL:           queryCacheTTL,
		iteratorCacheTTL:        iteratorCacheTTL,
		inflightInvalidations:   sync.Map{},
		logger:                  logger.NewNoopLogger(),
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// DetermineInvalidationTime returns the timestamp of the last write for the
// specified store if it was in cache, else it returns the Zero time and
// triggers InvalidateIfNeeded(). The last write time can be used to determine
// whether a cached entry is still valid - if it was cached before the last
// write to the store, it can't be trusted anymore.
func (c *InMemoryCacheController) DetermineInvalidationTime(
	ctx context.Context,
	storeID string,
) time.Time {
	ctx, span := tracer.Start(ctx, "cacheController.DetermineInvalidationTime", trace.WithAttributes(attribute.Bool("cached", false)))
	defer span.End()
	cacheTotalCounter.Inc()

	// Changelog cache entry holds the last modified time for the store.
	cacheKey := storage.GetChangelogCacheKey(storeID)
	cacheResp := c.cache.Get(cacheKey)

	c.logger.Debug("InMemoryCacheController DetermineInvalidationTime cache attempt",
		zap.String("store_id", storeID),
		zap.Bool("hit", cacheResp != nil),
	)

	// entry is nil when cacheResp is nil (cache miss) or type assertion fails
	// (shouldn't happen since we used the unique changelog cache key prefix
	// when getting from cache).
	entry, _ := cacheResp.(*storage.ChangelogCacheEntry)
	if entry == nil {
		c.InvalidateIfNeeded(ctx, storeID) // async

		// Return zero time to allow caller to use cache while invalidation is
		// in progress (async). This may result in stale cache hits until
		// invalidation completes and updates the ChangelogCacheEntry, but this
		// is an acceptable trade-off for performance.
		return time.Time{}
	}

	// Ensure invalidation is triggered at most every c.minInvalidationInterval
	// duration per store.
	if time.Since(entry.LastChecked) > c.minInvalidationInterval {
		c.InvalidateIfNeeded(ctx, storeID) // async
	} else {
		// Cache hit within TTL
		cacheHitCounter.Inc()
		span.SetAttributes(attribute.Bool("cached_within_ttl", true))
	}

	// Return time of last known change to store. This is refreshed at most every
	// minInvalidationInterval, so recent writes may not be reflected immediately.
	return entry.LastModified
}

// findChangesDescending is a wrapper on ReadChanges. If there are 0 changes to be returned, ReadChanges will actually return an error.
func (c *InMemoryCacheController) findChangesDescending(ctx context.Context, storeID string) ([]*openfgav1.TupleChange, string, error) {
	opts := storage.ReadChangesOptions{
		SortDesc: true,
		Pagination: storage.PaginationOptions{
			PageSize: storage.DefaultPageSize,
			From:     "",
		}}
	return c.ds.ReadChanges(ctx, storeID, storage.ReadChangesFilter{}, opts)
}

// InvalidateIfNeeded checks to see if an invalidation is currently in progress for a store,
// and if not it will spawn a goroutine to invalidate cached records conditionally
// based on timestamp. It may invalidate all cache records, some, or none.
func (c *InMemoryCacheController) InvalidateIfNeeded(ctx context.Context, storeID string) {
	span := trace.SpanFromContext(ctx)
	_, present := c.inflightInvalidations.LoadOrStore(storeID, struct{}{})
	if present {
		span.SetAttributes(attribute.Bool("cache_controller_invalidation", false))
		// If invalidation is already in process, abort.
		return
	}

	span.SetAttributes(attribute.Bool("cache_controller_invalidation", true))

	c.wg.Add(1)
	go func() {
		// we do not want to propagate context to avoid early cancellation
		// and pollute span.
		c.findChangesAndInvalidateIfNecessary(ctx, storeID)
		c.inflightInvalidations.Delete(storeID)
		c.wg.Done()
	}()
}

type changelogResultMsg struct {
	err     error
	changes []*openfgav1.TupleChange
}

// findChangesAndInvalidateIfNecessary checks the most recent entry in this store's changelog against the most
// recent cached changelog entry. If the most recent changelog entry is older than the cached changelog timestamp,
// no invalidation is necessary and we return. If not, we locate changelog records that have been around for longer
// than the cache's TTL and invalidate them.
func (c *InMemoryCacheController) findChangesAndInvalidateIfNecessary(parentCtx context.Context, storeID string) {
	start := time.Now()
	ctx, span := tracer.Start(context.Background(), "cacheController.findChangesAndInvalidateIfNecessary")
	defer span.End()

	link := trace.LinkFromContext(ctx)
	trace.SpanFromContext(parentCtx).AddLink(link)

	changelogCacheKey := storage.GetChangelogCacheKey(storeID)
	lastCacheRecord := c.cache.Get(changelogCacheKey)
	lastChangeTimeCached := time.Time{}

	if lastCacheRecord != nil {
		if decodedRecord, ok := lastCacheRecord.(*storage.ChangelogCacheEntry); ok {
			// if the change log cache is available and valid, use the last modified
			// time to have better consistency. Otherwise, the lastChangeTimeCached will
			// be the beginning of time which imply the need to invalidate all records.
			lastChangeTimeCached = decodedRecord.LastModified
		} else {
			c.logger.Error("Unable to cast lastCacheRecord properly", zap.String("changelogCacheKey", changelogCacheKey))
		}
	}

	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()
	done := make(chan changelogResultMsg, 1)

	c.wg.Add(1)
	go func() {
		changes, _, err := c.findChangesDescending(ctx, storeID)
		concurrency.TrySendThroughChannel(ctx, changelogResultMsg{err: err, changes: changes}, done)
		c.wg.Done()
	}()

	var changes []*openfgav1.TupleChange
	select {
	case <-ctx.Done():
		// no need to modify changelogCacheKey as a new attempt will be done once the inflight validation is cleared
		return
	case msg := <-done:
		if msg.err != nil {
			telemetry.TraceError(span, msg.err)
			// do not allow any cache read until next refresh
			c.invalidateIteratorCache(storeID)
			return
		}
		changes = msg.changes
	}

	lastChangeTimeActual := changes[0].GetTimestamp().AsTime()
	entry := &storage.ChangelogCacheEntry{
		LastModified: lastChangeTimeActual,
		LastChecked:  time.Now(),
	}

	// The changelog cache entry is only used to compare against a cached Check
	// response. Therefore, we only need this entry for up to the TTL of the
	// cached Check response (queryCacheTTL).
	c.cache.Set(changelogCacheKey, entry, c.queryCacheTTL)
	invalidationType := "none"

	if !lastChangeTimeActual.After(lastChangeTimeCached) {
		// no new changes, no need to perform invalidations
		span.SetAttributes(attribute.String("invalidationType", invalidationType))
		c.logger.Debug("InMemoryCacheController findChangesAndInvalidateIfNecessary no invalidation as last actual change is not after last cached change",
			zap.String("store_id", storeID),
			zap.Time("lastChangeTimeActual", lastChangeTimeActual),
			zap.Time("lastChangeTimeCached", lastChangeTimeCached))
		findChangesAndInvalidateHistogram.WithLabelValues(invalidationType).Observe(float64(time.Since(start).Milliseconds()))
		return
	}

	lastIteratorInvalidation := time.Now().Add(-c.iteratorCacheTTL)

	// need to consider there might just be 1 change
	// iterate from the oldest to most recent to determine if the last change is part of the current batch
	// Remember that idx[0] is the most recent change while idx[len(changes)-1] is the oldest change because
	// changes is ordered from most recent to oldest.
	idx := len(changes) - 1
	for ; idx >= 0; idx-- {
		// idx marks the first change after the lastIteratorInvalidation.
		// therefore, we want to use the changes that happen at/after this time to invalidate cache.
		//
		// Note that we only want to add invalidation entries for changes with timestamp >= now - iterator cache's TTL
		// because anything older than that time would not live in the iterator cache anyway.
		if changes[idx].GetTimestamp().AsTime().After(lastIteratorInvalidation) {
			break
		}
	}

	if idx == len(changes)-1 {
		// all changes happened after the last invalidation, thus we should revoke all the cached iterators for the store.
		invalidationType = "full"
		c.invalidateIteratorCache(storeID)
	} else {
		// only a subset of changes are new, revoke the respective ones.
		lastModified := time.Now()
		if idx >= 0 {
			invalidationType = "partial"
		}
		for ; idx >= 0; idx-- {
			t := changes[idx].GetTupleKey()
			c.invalidateIteratorCacheByObjectRelation(storeID, t.GetObject(), t.GetRelation(), lastModified)
			// We invalidate all iterators for the tuple's user and object type, regardless of the relation.
			c.invalidateIteratorCacheByUserAndObjectType(storeID, t.GetUser(), tuple.GetType(t.GetObject()), lastModified)
		}
	}

	if invalidationType != "none" {
		cacheInvalidationCounter.Inc()
	}
	c.logger.Debug("InMemoryCacheController findChangesAndInvalidateIfNecessary invalidation",
		zap.String("store_id", storeID),
		zap.Time("lastChangeTime", lastChangeTimeActual),
		zap.Time("lastIteratorInvalidationTime", lastIteratorInvalidation),
		zap.String("invalidationType", invalidationType))
	span.SetAttributes(attribute.String("invalidationType", invalidationType))
	findChangesAndInvalidateHistogram.WithLabelValues(invalidationType).Observe(float64(time.Since(start).Milliseconds()))
}

// invalidateIteratorCache writes a new key to the cache with a very long TTL.
// An alternative implementation could delete invalid keys, but this approach is faster (see storagewrappers.findInCache).
func (c *InMemoryCacheController) invalidateIteratorCache(storeID string) {
	c.cache.Set(storage.GetInvalidIteratorCacheKey(storeID), &storage.InvalidEntityCacheEntry{LastModified: time.Now()}, math.MaxInt)
}

// invalidateIteratorCacheByObjectRelation writes a new key to the cache.
// An alternative implementation could delete invalid keys, but this approach is faster (see storagewrappers.findInCache).
func (c *InMemoryCacheController) invalidateIteratorCacheByObjectRelation(storeID, object, relation string, ts time.Time) {
	c.cache.Set(storage.GetInvalidIteratorByObjectRelationCacheKey(storeID, object, relation), &storage.InvalidEntityCacheEntry{LastModified: ts}, c.iteratorCacheTTL)
}

// invalidateIteratorCacheByUserAndObjectType writes a new key to the cache.
// An alternative implementation could delete invalid keys, but this approach is faster (see storagewrappers.findInCache).
func (c *InMemoryCacheController) invalidateIteratorCacheByUserAndObjectType(storeID, user, objectType string, ts time.Time) {
	c.cache.Set(storage.GetInvalidIteratorByUserObjectTypeCacheKeys(storeID, []string{user}, objectType)[0], &storage.InvalidEntityCacheEntry{LastModified: ts}, c.iteratorCacheTTL)
}
