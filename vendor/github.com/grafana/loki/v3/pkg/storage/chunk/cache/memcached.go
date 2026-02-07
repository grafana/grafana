package cache

import (
	"context"
	"encoding/hex"
	"flag"
	"hash/fnv"
	"sync"
	"time"

	"github.com/go-kit/log"
	instr "github.com/grafana/dskit/instrument"
	"github.com/grafana/gomemcache/memcache"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/loki/v3/pkg/logqlmodel/stats"
	"github.com/grafana/loki/v3/pkg/util/constants"
	"github.com/grafana/loki/v3/pkg/util/math"
)

// MemcachedConfig is config to make a Memcached
type MemcachedConfig struct {
	Expiration time.Duration `yaml:"expiration"`

	BatchSize   int `yaml:"batch_size"`
	Parallelism int `yaml:"parallelism"`
}

// RegisterFlagsWithPrefix adds the flags required to config this to the given FlagSet
func (cfg *MemcachedConfig) RegisterFlagsWithPrefix(prefix, description string, f *flag.FlagSet) {
	f.DurationVar(&cfg.Expiration, prefix+"memcached.expiration", 0, description+"How long keys stay in the memcache.")
	f.IntVar(&cfg.BatchSize, prefix+"memcached.batchsize", 4, description+"How many keys to fetch in each batch.")
	f.IntVar(&cfg.Parallelism, prefix+"memcached.parallelism", 5, description+"Maximum active requests to memcache.")
}

// Memcached type caches chunks in memcached
type Memcached struct {
	cfg       MemcachedConfig
	memcache  MemcachedClient
	name      string
	cacheType stats.CacheType

	requestDuration *instr.HistogramCollector

	wg      sync.WaitGroup
	inputCh chan *work

	// `closed` tracks if `inputCh` is closed.
	// So that any writer goroutine wouldn't write to it after closing `intputCh`
	closed chan struct{}

	logger log.Logger
}

// NewMemcached makes a new Memcached.
func NewMemcached(cfg MemcachedConfig, client MemcachedClient, name string, reg prometheus.Registerer, logger log.Logger, cacheType stats.CacheType) *Memcached {
	c := &Memcached{
		cfg:       cfg,
		memcache:  client,
		name:      name,
		logger:    logger,
		cacheType: cacheType,
		requestDuration: instr.NewHistogramCollector(
			promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
				Namespace: constants.Loki,
				Name:      "memcache_request_duration_seconds",
				Help:      "Total time spent in seconds doing memcache requests.",
				// 16us, 64us, 256us, 1.024ms, 4.096ms, 16.384ms, 65.536ms, 150ms, 250ms, 500ms, 1s
				Buckets: append(prometheus.ExponentialBuckets(0.000016, 4, 7), []float64{
					(150 * time.Millisecond).Seconds(),
					(250 * time.Millisecond).Seconds(),
					(500 * time.Millisecond).Seconds(),
					(time.Second).Seconds(),
				}...),
				ConstLabels: prometheus.Labels{"name": name},
			}, []string{"method", "status_code"}),
		),
		closed: make(chan struct{}),
	}

	if cfg.BatchSize == 0 || cfg.Parallelism == 0 {
		return c
	}

	c.inputCh = make(chan *work)
	c.wg.Add(cfg.Parallelism)

	for i := 0; i < cfg.Parallelism; i++ {
		go func() {
			defer c.wg.Done()
			for input := range c.inputCh {
				res := &result{
					batchID: input.batchID,
				}
				res.found, res.bufs, res.missed, res.err = c.fetch(input.ctx, input.keys)
				input.resultCh <- res
			}

		}()
	}

	return c
}

type work struct {
	keys     []string
	ctx      context.Context
	resultCh chan<- *result
	batchID  int // For ordering results.
}

type result struct {
	found   []string
	bufs    [][]byte
	missed  []string
	err     error
	batchID int // For ordering results.
}

func memcacheStatusCode(err error) string {
	// See https://godoc.org/github.com/grafana/gomemcache/memcache#pkg-variables
	switch err {
	case nil:
		return "200"
	case memcache.ErrCacheMiss:
		return "404"
	case memcache.ErrMalformedKey:
		return "400"
	default:
		return "500"
	}
}

// Fetch gets keys from the cache. The keys that are found must be in the order of the keys requested.
func (c *Memcached) Fetch(ctx context.Context, keys []string) (found []string, bufs [][]byte, missed []string, err error) {
	if c.cfg.BatchSize == 0 {
		found, bufs, missed, err = c.fetch(ctx, keys)
		return
	}

	start := time.Now()
	found, bufs, missed, err = c.fetchKeysBatched(ctx, keys)
	c.requestDuration.After(ctx, "Memcache.GetBatched", memcacheStatusCode(err), start)
	return
}

func (c *Memcached) fetch(ctx context.Context, keys []string) (found []string, bufs [][]byte, missed []string, err error) {
	var (
		start = time.Now()
		items map[string]*memcache.Item
	)
	items, err = c.memcache.GetMulti(keys)
	c.requestDuration.After(ctx, "Memcache.GetMulti", memcacheStatusCode(err), start)
	if err != nil {
		return found, bufs, keys, err
	}

	for _, key := range keys {
		item, ok := items[key]
		if ok {
			found = append(found, key)
			bufs = append(bufs, item.Value)
		} else {
			missed = append(missed, key)
		}
	}
	return
}

func (c *Memcached) fetchKeysBatched(ctx context.Context, keys []string) (found []string, bufs [][]byte, missed []string, err error) {
	resultsCh := make(chan *result)
	batchSize := c.cfg.BatchSize

	go func() {
		for i, j := 0, 0; i < len(keys); i += batchSize {
			batchKeys := keys[i:math.Min(i+batchSize, len(keys))]
			select {
			case <-c.closed:
				return
			default:
				c.inputCh <- &work{
					keys:     batchKeys,
					ctx:      ctx,
					resultCh: resultsCh,
					batchID:  j,
				}
				j++
			}
		}
	}()

	// Read all values from this channel to avoid blocking upstream.
	numResults := len(keys) / batchSize
	if len(keys)%batchSize != 0 {
		numResults++
	}

	// We need to order found by the input keys order.
	results := make([]*result, numResults)
	for i := 0; i < numResults; i++ {
		// NOTE: Without this check, <-resultCh may wait forever as work is
		// interrupted (by other goroutine by calling `Stop()`) and there may not be `numResults`
		// values to read from `resultsCh` in that case.
		// Also we do close(resultsCh) in the same goroutine so <-resultCh may never return.
		select {
		case <-c.closed:
			return
		default:
			result := <-resultsCh
			results[result.batchID] = result
		}
	}
	close(resultsCh)

	for _, result := range results {
		found = append(found, result.found...)
		bufs = append(bufs, result.bufs...)
		missed = append(missed, result.missed...)
		if result.err != nil {
			err = result.err
		}
	}

	return
}

// Store stores the key in the cache.
func (c *Memcached) Store(ctx context.Context, keys []string, bufs [][]byte) error {
	var err error
	for i := range keys {
		cacheErr := instr.CollectedRequest(ctx, "Memcache.Put", c.requestDuration, memcacheStatusCode, func(_ context.Context) error {
			item := memcache.Item{
				Key:        keys[i],
				Value:      bufs[i],
				Expiration: int32(c.cfg.Expiration.Seconds()),
			}
			return c.memcache.Set(&item)
		})
		if cacheErr != nil {
			err = cacheErr
		}
	}
	return err
}

func (c *Memcached) Stop() {
	if c.inputCh == nil {
		return
	}

	close(c.inputCh)
	close(c.closed)
	c.wg.Wait()
}

func (c *Memcached) GetCacheType() stats.CacheType {
	return c.cacheType
}

// HashKey hashes key into something you can store in memcached.
func HashKey(key string) string {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(key)) // This'll never error.

	// Hex because memcache errors for the bytes produced by the hash.
	return hex.EncodeToString(hasher.Sum(nil))
}
