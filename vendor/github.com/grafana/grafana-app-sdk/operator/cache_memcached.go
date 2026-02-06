package operator

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/bradfitz/gomemcache/memcache"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/resource"
)

var _ cache.Store = &MemcachedStore{}

const (
	// MemcachedStoreDefaultPageSize is the default page size for MemcachedStore.List() operations
	MemcachedStoreDefaultPageSize = 500

	keysCacheKey = "%s-keys"
)

// MemcachedServerSelector enhances memcache.ServerSelector with a method to refresh the server list used.
type MemcachedServerSelector interface {
	memcache.ServerSelector
	// RefreshServers refreshes the underlying list of servers, re-resolving any hostnames.
	// This is used by the MemcachedStore when an operation results in an EOF or timeout error to ensure that
	// the resolved addresses are still valid.
	RefreshServers() error
}

// MemcachedStore implements cache.Store using memcached as the store for objects.
// It should be instantiated with NewMemcachedStore.
type MemcachedStore struct {
	client          *memcache.Client
	keyFunc         func(any) (string, error)
	kind            resource.Kind
	readLatency     *prometheus.HistogramVec
	writeLatency    *prometheus.HistogramVec
	keys            sync.Map
	trackKeys       bool
	syncTicker      *time.Ticker
	pageSize        int
	cacheKeysKey    string
	serverRefresher *memcachedServerRefresher
}

// MemcachedStoreConfig is a collection of config values for a MemcachedStore
type MemcachedStoreConfig struct {
	// KeyFunc is the function used to determine the key for an object
	KeyFunc func(any) (string, error)
	// Addrs is a list of addresses (including ports) to connect to
	Addrs []string
	// ServerSelector is a server selector for the memcached client.
	// If present, it overrides Addrs and is used to determine the memcached servers to connect to.
	ServerSelector MemcachedServerSelector
	// Metrics is metrics configuration
	Metrics metrics.Config
	// KeySyncInterval is the interval at which keys stored in the in-memory map will be pushed to memcached.
	// Set to 0 to disable key tracking. It is advisable to disable this functionality unless you need ListKeys() and/or
	// List() functionality in MemcachedStore (this is required by an informer if you set the CacheResyncInterval).
	// If disabled (0), ListKeys() and List() will return nil.
	// Since a key list cannot be exported from memcached, the keys are tracked in-memory (from Add, Delete, and successful
	// Get operations), and periodically written to a known key in memcached. NewMemcachedStore loads the existing
	// value from the "known keys" key in memcached into the in-memory key tracking, and then will run a process
	// to push this list of keys to memcached every KeySyncInterval. If the data in memcached is cleared,
	// The in-memory list of keys will also be cleared, though this can result in some state synchronization errors,
	// as any Add operations that happen between the time the memcached was cleared and the next sync run will not
	// be known by the key tracker anymore.
	KeySyncInterval time.Duration
	// Timeout is the timeout on memcached connections. Leave 0 to default.
	Timeout time.Duration
	// MaxIdleConns is the max number of idle memcached connections. Leave 0 to default.
	MaxIdleConns int
	// PageSize is the page size to use for List requests on the store. If 0, it defaults to MemcachedStoreDefaultPageSize.
	PageSize int
	// ShardKey is a unique identifier for this MemcachedStore instance if you are using multiple.
	// If present, each shard will track the keys they manage in the underlying memcached separately.
	// To take advantage of this behavior, a shard key should be non-random and identical each run.
	ShardKey string
}

// NewMemcachedStore returns a new MemcachedStore for the specified Kind using the provided config.
func NewMemcachedStore(kind resource.Kind, cfg MemcachedStoreConfig) (*MemcachedStore, error) {
	keyFunc := cache.DeletionHandlingMetaNamespaceKeyFunc
	if cfg.KeyFunc != nil {
		keyFunc = cfg.KeyFunc
	}
	var client *memcache.Client
	if cfg.ServerSelector != nil {
		client = memcache.NewFromSelector(cfg.ServerSelector)
	} else {
		client = memcache.New(cfg.Addrs...)
	}
	client.Timeout = cfg.Timeout
	client.MaxIdleConns = cfg.MaxIdleConns
	store := &MemcachedStore{
		client:  client,
		keyFunc: keyFunc,
		kind:    kind,
		readLatency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       cfg.Metrics.Namespace,
			Subsystem:                       "informer",
			Name:                            "cache_read_duration_seconds",
			Help:                            "Time (in seconds) spent on cache read operations",
			Buckets:                         metrics.LatencyBuckets,
			NativeHistogramBucketFactor:     cfg.Metrics.NativeHistogramBucketFactor,
			NativeHistogramMaxBucketNumber:  cfg.Metrics.NativeHistogramMaxBucketNumber,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"kind"}),
		writeLatency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       cfg.Metrics.Namespace,
			Subsystem:                       "informer",
			Name:                            "cache_write_duration_seconds",
			Help:                            "Time (in seconds) spent on cache write operations",
			Buckets:                         metrics.LatencyBuckets,
			NativeHistogramBucketFactor:     cfg.Metrics.NativeHistogramBucketFactor,
			NativeHistogramMaxBucketNumber:  cfg.Metrics.NativeHistogramMaxBucketNumber,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"kind"}),
		trackKeys:    cfg.KeySyncInterval != 0,
		keys:         sync.Map{},
		pageSize:     MemcachedStoreDefaultPageSize,
		cacheKeysKey: fmt.Sprintf(keysCacheKey, kind.Plural()),
	}
	if cfg.ServerSelector != nil {
		store.serverRefresher = &memcachedServerRefresher{
			refresher: cfg.ServerSelector,
		}
	}
	if cfg.PageSize > 0 {
		store.pageSize = cfg.PageSize
	}
	if store.trackKeys {
		err := store.setKeysFromCache()
		if err != nil {
			return nil, err
		}
		store.syncTicker = time.NewTicker(cfg.KeySyncInterval)
		go func() {
			for range store.syncTicker.C {
				err := store.syncKeys()
				if err != nil {
					// TODO: better logging?
					logging.DefaultLogger.Error("error syncing memcached keys", "error", err.Error())
				}
			}
		}()
	}
	if cfg.ShardKey != "" {
		store.cacheKeysKey = fmt.Sprintf("%s-%s", store.cacheKeysKey, cfg.ShardKey)
	}
	return store, nil
}

// PrometheusCollectors returns a list of prometheus collectors used by the MemcachedStore
func (m *MemcachedStore) PrometheusCollectors() []prometheus.Collector {
	return []prometheus.Collector{
		m.readLatency, m.writeLatency,
	}
}

func (m *MemcachedStore) Add(obj any) error {
	key, trackKey, err := m.getKey(obj)
	if err != nil {
		return err
	}
	o, err := json.Marshal(obj)
	if err != nil {
		return err
	}
	start := time.Now()
	err = m.client.Add(&memcache.Item{
		Key:   key,
		Value: o,
	})
	m.writeLatency.WithLabelValues(m.kind.Kind()).Observe(time.Since(start).Seconds())
	if m.trackKeys && err == nil {
		m.keys.Store(trackKey, struct{}{})
	}
	return err
}
func (m *MemcachedStore) Update(obj any) error {
	key, _, err := m.getKey(obj)
	if err != nil {
		return err
	}
	o, err := json.Marshal(obj)
	if err != nil {
		return err
	}
	start := time.Now()
	err = m.attemptWithRefreshOnTimeout(func() error {
		return m.client.Replace(&memcache.Item{
			Key:   key,
			Value: o,
		})
	})
	m.writeLatency.WithLabelValues(m.kind.Kind()).Observe(time.Since(start).Seconds())
	return err
}
func (m *MemcachedStore) Delete(obj any) error {
	key, trackKey, err := m.getKey(obj)
	if err != nil {
		return err
	}
	start := time.Now()
	err = m.attemptWithRefreshOnTimeout(func() error {
		return m.client.Delete(key)
	})
	m.writeLatency.WithLabelValues(m.kind.Kind()).Observe(time.Since(start).Seconds())
	if err == nil && m.trackKeys {
		m.keys.Delete(trackKey)
	}
	return err
}
func (m *MemcachedStore) List() []any {
	if !m.trackKeys {
		return nil
	}
	keys := m.ListKeys()
	items := make([]any, len(keys))
	for i := 0; i < len(keys); i += m.pageSize {
		var fetchKeys []string
		if i+m.pageSize > len(keys) {
			fetchKeys = keys[i:]
		} else {
			fetchKeys = keys[i : i+m.pageSize]
		}
		for j := 0; j < len(fetchKeys); j++ {
			fetchKeys[j] = fmt.Sprintf("%s/%s", m.kind.Plural(), fetchKeys[j])
		}
		var res map[string]*memcache.Item
		err := m.attemptWithRefreshOnTimeout(func() error {
			var err error
			res, err = m.client.GetMulti(fetchKeys)
			return err
		})
		if err != nil {
			// TODO: ???
			return nil
		}
		for resKey := range res {
			items[i] = res[resKey]
		}
	}
	return items
}
func (m *MemcachedStore) ListKeys() []string {
	if !m.trackKeys {
		// Not natively supported by memcached, so if the user didn't configure in-mem key tracking, we can't return a list of keys
		return nil
	}
	keys := make([]string, 0)
	m.keys.Range(func(key, _ any) bool {
		keys = append(keys, key.(string))
		return true
	})
	return keys
}
func (m *MemcachedStore) Get(obj any) (item any, exists bool, err error) {
	key, trackKey, err := m.getKey(obj)
	if err != nil {
		return nil, false, err
	}
	item, exists, err = m.getByKey(key)
	if m.trackKeys && err == nil && exists {
		m.keys.LoadOrStore(trackKey, struct{}{})
	}
	return item, exists, err
}
func (m *MemcachedStore) GetByKey(key string) (item any, exists bool, err error) {
	item, exists, err = m.getByKey(fmt.Sprintf("%s/%s", m.kind.Plural(), key))
	if m.trackKeys && exists && err == nil {
		m.keys.LoadOrStore(key, struct{}{})
	}
	return item, exists, err
}

func (m *MemcachedStore) getByKey(key string) (item any, exists bool, err error) {
	start := time.Now()
	var fromCache *memcache.Item
	err = m.attemptWithRefreshOnTimeout(func() error {
		fromCache, err = m.client.Get(key)
		return err
	})
	m.readLatency.WithLabelValues(m.kind.Kind()).Observe(time.Since(start).Seconds())
	if err != nil && !errors.Is(err, memcache.ErrCacheMiss) {
		return nil, false, err
	}
	if fromCache == nil {
		return nil, false, nil
	}
	item, err = m.kind.Read(bytes.NewReader(fromCache.Value), resource.KindEncodingJSON)
	if err != nil {
		return nil, true, err
	}
	return item, true, nil
}

func (*MemcachedStore) Replace([]any, string) error {
	return nil
}
func (*MemcachedStore) Resync() error {
	return nil
}

func (m *MemcachedStore) getKey(obj any) (prefixedKey string, externalKey string, err error) {
	if m.keyFunc == nil {
		return "", "", errors.New("no KeyFunc defined")
	}
	externalKey, err = m.keyFunc(obj)
	if err != nil {
		return "", externalKey, err
	}
	return fmt.Sprintf("%s/%s", m.kind.Plural(), externalKey), externalKey, nil
}

func (m *MemcachedStore) setKeysFromCache() error {
	var item *memcache.Item
	err := m.attemptWithRefreshOnTimeout(func() error {
		var err error
		item, err = m.client.Get(m.cacheKeysKey)
		return err
	})
	if err != nil {
		if errors.Is(err, memcache.ErrCacheMiss) {
			return nil
		}
		return err
	}
	keys := make([]string, 0)
	err = json.Unmarshal(item.Value, &keys)
	if err != nil {
		return err
	}
	for _, key := range keys {
		m.keys.Store(key, struct{}{})
	}
	return nil
}

func (m *MemcachedStore) syncKeys() error {
	err := m.attemptWithRefreshOnTimeout(func() error {
		_, err := m.client.Get(m.cacheKeysKey)
		if err != nil {
			if !errors.Is(err, memcache.ErrCacheMiss) {
				return err
			}
			item := &memcache.Item{
				Key:   m.cacheKeysKey,
				Value: []byte("[]"),
			}
			return m.client.Add(item)
		}
		return nil
	})
	if err != nil {
		return err
	}
	externalKeys := make([]string, 0)
	m.keys.Range(func(key, _ any) bool {
		externalKeys = append(externalKeys, key.(string))
		return true
	})
	externalKeysJSON, err := json.Marshal(externalKeys)
	if err != nil {
		return err
	}
	return m.attemptWithRefreshOnTimeout(func() error {
		return m.client.Replace(&memcache.Item{
			Key:   m.cacheKeysKey,
			Value: externalKeysJSON,
		})
	})
}

func (m *MemcachedStore) attemptWithRefreshOnTimeout(f func() error) error {
	if err := f(); err != nil {
		if m.serverRefresher != nil {
			var e *memcache.ConnectTimeoutError
			if errors.As(err, &e) || err.Error() == "EOF" {
				refreshErr := m.serverRefresher.refresh()
				if refreshErr != nil {
					return fmt.Errorf("%w: could not refresh server list: %w", err, refreshErr)
				}
				return f()
			}
		}
		return err
	}
	return nil
}

type memcachedServerRefresher struct {
	refresher  MemcachedServerSelector
	mux        sync.Mutex
	inProgress atomic.Bool
}

func (m *memcachedServerRefresher) refresh() error {
	if !m.inProgress.CompareAndSwap(false, true) {
		// Block until the ongoing refresh is finished,
		// just attempt to lock the mutex so we wait until it's freed by the existing process
		m.mux.Lock()
		defer m.mux.Unlock()
		return nil
	}
	if logging.DefaultLogger != nil {
		logging.DefaultLogger.Info("Refreshing memcached servers")
	}
	m.mux.Lock()
	defer m.mux.Unlock()
	defer m.inProgress.Store(false)

	return m.refresher.RefreshServers()
}
