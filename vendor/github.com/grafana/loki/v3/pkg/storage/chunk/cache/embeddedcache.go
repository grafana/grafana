package cache

import (
	"container/list"
	"context"
	"flag"
	"sync"
	"time"
	"unsafe"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/loki/v3/pkg/logqlmodel/stats"
	"github.com/grafana/loki/v3/pkg/util/constants"
)

const (
	elementSize    = int(unsafe.Sizeof(list.Element{}))
	elementPrtSize = int(unsafe.Sizeof(&list.Element{}))

	defaultPurgeInterval = 1 * time.Minute

	expiredReason  = "expired"
	fullReason     = "full"
	tooBigReason   = "object too big"
	replacedReason = "replaced"
)

// Interface for EmbeddedCache
// Matches the interface from cache.Cache but has generics
type TypedCache[K comparable, V any] interface {
	Store(ctx context.Context, keys []K, values []V) error
	Fetch(ctx context.Context, keys []K) (found []K, values []V, missing []K, err error)
	Stop()
	// GetCacheType returns a string indicating the cache "type" for the purpose of grouping cache usage statistics
	GetCacheType() stats.CacheType
}

// EmbeddedCache is a simple (comparable -> any) cache which uses a fifo slide to
// manage evictions.  O(1) inserts and updates, O(1) gets.
//
// This embedded cache implementation supports two eviction methods - based on number of items in the cache, and based on memory usage.
// For the memory-based eviction, set EmbeddedCacheConfig.MaxSizeMB to a positive integer, indicating upper limit of memory allocated by items in the cache.
// Alternatively, set EmbeddedCacheConfig.MaxSizeItems to a positive integer, indicating maximum number of items in the cache.
// If both parameters are set, both methods are enforced, whichever hits first.
type EmbeddedCache[K comparable, V any] struct {
	cacheType stats.CacheType

	lock          sync.RWMutex
	maxSizeItems  int
	maxSizeBytes  uint64
	currSizeBytes uint64

	entries map[K]*list.Element
	cacheEntrySizeCalculator[K, V]
	lru *list.List

	onEntryRemoved func(key K, value V)

	done chan struct{}

	entriesAddedNew prometheus.Counter
	entriesEvicted  *prometheus.CounterVec
	entriesCurrent  prometheus.Gauge
	memoryBytes     prometheus.Gauge
}

type Entry[K comparable, V any] struct {
	updated time.Time
	Key     K
	Value   V
}

// EmbeddedCacheConfig represents in-process embedded cache config.
type EmbeddedCacheConfig struct {
	Enabled      bool          `yaml:"enabled,omitempty"`
	MaxSizeMB    int64         `yaml:"max_size_mb"`
	MaxSizeItems int           `yaml:"max_size_items"`
	TTL          time.Duration `yaml:"ttl"`

	// PurgeInterval tell how often should we remove keys that are expired.
	// by default it takes `defaultPurgeInterval`
	PurgeInterval time.Duration `yaml:"-"`
}

func (cfg *EmbeddedCacheConfig) RegisterFlagsWithPrefix(prefix, description string, f *flag.FlagSet) {
	cfg.RegisterFlagsWithPrefixAndDefaults(prefix, description, f, time.Hour)
}

func (cfg *EmbeddedCacheConfig) RegisterFlagsWithPrefixAndDefaults(prefix, description string, f *flag.FlagSet, defaultTTL time.Duration) {
	f.BoolVar(&cfg.Enabled, prefix+"enabled", false, description+"Whether embedded cache is enabled.")
	f.Int64Var(&cfg.MaxSizeMB, prefix+"max-size-mb", 100, description+"Maximum memory size of the cache in MB.")
	f.IntVar(&cfg.MaxSizeItems, prefix+"max-size-items", 0, description+"Maximum number of entries in the cache.")
	f.DurationVar(&cfg.TTL, prefix+"ttl", defaultTTL, description+"The time to live for items in the cache before they get purged.")
}

func (cfg *EmbeddedCacheConfig) IsEnabled() bool {
	return cfg.Enabled
}

type cacheEntrySizeCalculator[K comparable, V any] func(entry *Entry[K, V]) uint64

// NewEmbeddedCache returns a new initialised EmbeddedCache where the key is a string and the value is a slice of bytes.
func NewEmbeddedCache(name string, cfg EmbeddedCacheConfig, reg prometheus.Registerer, logger log.Logger, cacheType stats.CacheType) *EmbeddedCache[string, []byte] {
	return NewTypedEmbeddedCache[string, []byte](name, cfg, reg, logger, cacheType, sizeOf, nil)
}

// NewTypedEmbeddedCache returns a new initialised EmbeddedCache with the key and value of requested types.
// To limit the memory allocated by items in the cache, it's necessary to pass cacheEntrySizeCalculator
// that calculates the size of an entry in bytes.
// Also, this constructor allows passing the callback that will be called for the entry whenever it is removed from the cache.
func NewTypedEmbeddedCache[K comparable, V any](
	name string,
	cfg EmbeddedCacheConfig,
	reg prometheus.Registerer,
	logger log.Logger,
	cacheType stats.CacheType,
	entrySizeCalculator cacheEntrySizeCalculator[K, V],
	onEntryRemoved func(key K, value V),
) *EmbeddedCache[K, V] {
	if cfg.MaxSizeMB == 0 && cfg.MaxSizeItems == 0 {
		// zero cache capacity - no need to create cache
		level.Warn(logger).Log("msg", "neither embedded-cache.max-size-mb nor embedded-cache.max-size-items is set", "cache", name)
		return nil
	}

	// Set a default interval for the ticker
	// This can be overwritten to a smaller value in tests
	if cfg.PurgeInterval == 0 {
		cfg.PurgeInterval = defaultPurgeInterval
	}

	cache := &EmbeddedCache[K, V]{
		cacheType: cacheType,

		maxSizeItems:             cfg.MaxSizeItems,
		maxSizeBytes:             uint64(cfg.MaxSizeMB * 1e6),
		entries:                  make(map[K]*list.Element),
		lru:                      list.New(),
		cacheEntrySizeCalculator: entrySizeCalculator,
		onEntryRemoved:           onEntryRemoved,

		done: make(chan struct{}),

		entriesAddedNew: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Namespace:   constants.Loki,
			Subsystem:   "embeddedcache",
			Name:        "added_new_total",
			Help:        "The total number of new entries added to the cache",
			ConstLabels: prometheus.Labels{"cache": name},
		}),

		entriesEvicted: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Namespace:   constants.Loki,
			Subsystem:   "embeddedcache",
			Name:        "evicted_total",
			Help:        "The total number of evicted entries",
			ConstLabels: prometheus.Labels{"cache": name},
		}, []string{"reason"}),

		entriesCurrent: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace:   constants.Loki,
			Subsystem:   "embeddedcache",
			Name:        "entries",
			Help:        "Current number of entries in the cache",
			ConstLabels: prometheus.Labels{"cache": name},
		}),

		memoryBytes: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace:   constants.Loki,
			Subsystem:   "embeddedcache",
			Name:        "memory_bytes",
			Help:        "The current cache size in bytes",
			ConstLabels: prometheus.Labels{"cache": name},
		}),
	}

	if cfg.TTL > 0 {
		go cache.runPruneJob(cfg.PurgeInterval, cfg.TTL)
	}

	return cache
}

func (c *EmbeddedCache[K, V]) runPruneJob(interval, ttl time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-c.done:
			return
		case <-ticker.C:
			c.pruneExpiredItems(ttl)
		}
	}
}

// pruneExpiredItems prunes items in the cache that exceeded their ttl
func (c *EmbeddedCache[K, V]) pruneExpiredItems(ttl time.Duration) {
	c.lock.Lock()
	defer c.lock.Unlock()

	for k, v := range c.entries {
		entry := v.Value.(*Entry[K, V])
		if time.Since(entry.updated) > ttl {
			c.remove(k, v, expiredReason)
		}
	}
}

// Fetch implements Cache.
func (c *EmbeddedCache[K, V]) Fetch(ctx context.Context, keys []K) (foundKeys []K, foundValues []V, missingKeys []K, err error) {
	foundKeys, missingKeys, foundValues = make([]K, 0, len(keys)), make([]K, 0, len(keys)), make([]V, 0, len(keys))
	for _, key := range keys {
		val, ok := c.Get(ctx, key)
		if !ok {
			missingKeys = append(missingKeys, key)
			continue
		}

		foundKeys = append(foundKeys, key)
		foundValues = append(foundValues, val)
	}
	return
}

// Store implements Cache.
func (c *EmbeddedCache[K, V]) Store(_ context.Context, keys []K, values []V) error {
	c.lock.Lock()
	defer c.lock.Unlock()

	for i := range keys {
		c.put(keys[i], values[i])
	}
	return nil
}

// Stop implements Cache.
func (c *EmbeddedCache[K, V]) Stop() {
	c.lock.Lock()
	defer c.lock.Unlock()

	close(c.done)
	c.entries = make(map[K]*list.Element)
	c.lru.Init()
	c.currSizeBytes = 0

	c.entriesCurrent.Set(float64(0))
	c.memoryBytes.Set(float64(0))
}

func (c *EmbeddedCache[K, V]) GetCacheType() stats.CacheType {
	return c.cacheType
}

func (c *EmbeddedCache[K, V]) remove(key K, element *list.Element, reason string) {
	entry := c.lru.Remove(element).(*Entry[K, V])
	sz := c.cacheEntrySizeCalculator(entry)
	delete(c.entries, key)
	if c.onEntryRemoved != nil {
		c.onEntryRemoved(entry.Key, entry.Value)
	}
	c.currSizeBytes -= sz
	c.entriesCurrent.Dec()
	c.entriesEvicted.WithLabelValues(reason).Inc()
}

func (c *EmbeddedCache[K, V]) put(key K, value V) {
	// See if we already have the item in the cache.
	element, ok := c.entries[key]
	if ok {
		// Remove the item from the cache.
		c.remove(key, element, replacedReason)
	}

	entry := &Entry[K, V]{
		updated: time.Now(),
		Key:     key,
		Value:   value,
	}
	entrySz := c.cacheEntrySizeCalculator(entry)

	if c.maxSizeBytes > 0 && entrySz > c.maxSizeBytes {
		// Cannot keep this item in the cache.
		if ok {
			// We do not replace this item.
			c.entriesEvicted.WithLabelValues(tooBigReason).Inc()
		}
		c.memoryBytes.Set(float64(c.currSizeBytes))
		return
	}

	// Otherwise, see if we need to evict item(s).
	for (c.maxSizeBytes > 0 && c.currSizeBytes+entrySz > c.maxSizeBytes) || (c.maxSizeItems > 0 && len(c.entries) >= c.maxSizeItems) {
		lastElement := c.lru.Back()
		if lastElement == nil {
			break
		}
		entryToRemove := lastElement.Value.(*Entry[K, V])
		c.remove(entryToRemove.Key, lastElement, fullReason)
	}

	// Finally, we have space to add the item.
	c.entries[key] = c.lru.PushFront(entry)
	c.currSizeBytes += entrySz
	if !ok {
		c.entriesAddedNew.Inc()
	}
	c.entriesCurrent.Inc()
	c.memoryBytes.Set(float64(c.currSizeBytes))
}

// Get returns the stored value against the key and when the key was last updated.
func (c *EmbeddedCache[K, V]) Get(_ context.Context, key K) (V, bool) {
	c.lock.RLock()
	defer c.lock.RUnlock()

	element, ok := c.entries[key]
	if ok {
		entry := element.Value.(*Entry[K, V])
		return entry.Value, true
	}
	var empty V
	return empty, false
}

func sizeOf(item *Entry[string, []byte]) uint64 {
	return uint64(int(unsafe.Sizeof(*item)) + // size of Entry
		len(item.Key) + // size of Key
		cap(item.Value) + // size of Value
		elementSize + // size of the element in linked list
		elementPrtSize) // size of the pointer to an element in the map
}

func NewNoopTypedCache[K comparable, V any]() TypedCache[K, V] {
	return &noopEmbeddedCache[K, V]{}
}

type noopEmbeddedCache[K comparable, V any] struct{}

func (noopEmbeddedCache[K, V]) Store(_ context.Context, _ []K, _ []V) error {
	return nil
}

func (noopEmbeddedCache[K, V]) Fetch(_ context.Context, keys []K) ([]K, []V, []K, error) {
	return []K{}, []V{}, keys, nil
}

func (noopEmbeddedCache[K, V]) Stop() {
}

func (noopEmbeddedCache[K, V]) GetCacheType() stats.CacheType {
	return "noop"
}
