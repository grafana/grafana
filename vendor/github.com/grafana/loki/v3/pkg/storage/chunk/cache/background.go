package cache

import (
	"context"
	"flag"
	"sync"

	"github.com/go-kit/log/level"
	opentracing "github.com/opentracing/opentracing-go"
	otlog "github.com/opentracing/opentracing-go/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.uber.org/atomic"

	"github.com/grafana/loki/v3/pkg/util/constants"
	"github.com/grafana/loki/v3/pkg/util/flagext"
	util_log "github.com/grafana/loki/v3/pkg/util/log"
)

// BackgroundConfig is config for a Background Cache.
type BackgroundConfig struct {
	WriteBackGoroutines int              `yaml:"writeback_goroutines"`
	WriteBackBuffer     int              `yaml:"writeback_buffer"`
	WriteBackSizeLimit  flagext.ByteSize `yaml:"writeback_size_limit"`
}

// RegisterFlagsWithPrefix adds the flags required to config this to the given FlagSet
func (cfg *BackgroundConfig) RegisterFlagsWithPrefix(prefix string, description string, f *flag.FlagSet) {
	f.IntVar(&cfg.WriteBackGoroutines, prefix+"background.write-back-concurrency", 1, description+"At what concurrency to write back to cache.")
	f.IntVar(&cfg.WriteBackBuffer, prefix+"background.write-back-buffer", 500000, description+"How many key batches to buffer for background write-back. Default is large to prefer size based limiting.")
	_ = cfg.WriteBackSizeLimit.Set("500MB")
	f.Var(&cfg.WriteBackSizeLimit, prefix+"background.write-back-size-limit", description+"Size limit in bytes for background write-back.")
}

type backgroundCache struct {
	Cache

	wg        sync.WaitGroup
	quit      chan struct{}
	bgWrites  chan backgroundWrite
	name      string
	size      atomic.Int64
	sizeLimit int

	droppedWriteBack      prometheus.Counter
	droppedWriteBackBytes prometheus.Counter
	queueLength           prometheus.Gauge
	queueBytes            prometheus.Gauge
	enqueuedBytes         prometheus.Counter
	dequeuedBytes         prometheus.Counter
}

type backgroundWrite struct {
	keys []string
	bufs [][]byte
}

func (b *backgroundWrite) size() int {
	var sz int

	for _, buf := range b.bufs {
		sz += len(buf)
	}

	return sz
}

// NewBackground returns a new Cache that does stores on background goroutines.
func NewBackground(name string, cfg BackgroundConfig, cache Cache, reg prometheus.Registerer) Cache {
	c := &backgroundCache{
		Cache:     cache,
		quit:      make(chan struct{}),
		bgWrites:  make(chan backgroundWrite, cfg.WriteBackBuffer),
		name:      name,
		sizeLimit: cfg.WriteBackSizeLimit.Val(),

		droppedWriteBack: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Namespace:   constants.Loki,
			Name:        "cache_dropped_background_writes_total",
			Help:        "Total count of dropped write backs to cache.",
			ConstLabels: prometheus.Labels{"name": name},
		}),
		droppedWriteBackBytes: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Namespace:   constants.Loki,
			Name:        "cache_dropped_background_writes_bytes_total",
			Help:        "Amount of data dropped in write backs to cache.",
			ConstLabels: prometheus.Labels{"name": name},
		}),

		queueLength: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace:   constants.Loki,
			Name:        "cache_background_queue_length",
			Help:        "Length of the cache background writeback queue.",
			ConstLabels: prometheus.Labels{"name": name},
		}),

		queueBytes: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace:   constants.Loki,
			Name:        "cache_background_queue_bytes",
			Help:        "Amount of data in the background writeback queue.",
			ConstLabels: prometheus.Labels{"name": name},
		}),

		enqueuedBytes: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace:   constants.Loki,
			Name:        "cache_background_enqueued_bytes_total",
			Help:        "Counter of bytes enqueued over time to the background writeback queue.",
			ConstLabels: prometheus.Labels{"name": name},
		}),

		dequeuedBytes: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace:   constants.Loki,
			Name:        "cache_background_dequeued_bytes_total",
			Help:        "Counter of bytes dequeued over time from the background writeback queue.",
			ConstLabels: prometheus.Labels{"name": name},
		}),
	}

	c.wg.Add(cfg.WriteBackGoroutines)
	for i := 0; i < cfg.WriteBackGoroutines; i++ {
		go c.writeBackLoop()
	}

	return c
}

// Stop the background flushing goroutines.
func (c *backgroundCache) Stop() {
	close(c.quit)
	c.wg.Wait()

	c.Cache.Stop()
}

const keysPerBatch = 100

// Store writes keys for the cache in the background.
func (c *backgroundCache) Store(ctx context.Context, keys []string, bufs [][]byte) error {
	for len(keys) > 0 {
		num := keysPerBatch
		if num > len(keys) {
			num = len(keys)
		}

		bgWrite := backgroundWrite{
			keys: keys[:num],
			bufs: bufs[:num],
		}

		size := bgWrite.size()
		// prospectively add new size
		newSize := c.size.Add(int64(size))
		if newSize > int64(c.sizeLimit) {
			// subtract it since we've exceeded the limit
			c.size.Sub(int64(size))
			c.failStore(ctx, size, num, "queue at byte size limit")
			return nil
		}

		select {
		case c.bgWrites <- bgWrite:
			c.queueBytes.Set(float64(c.size.Load()))
			c.queueLength.Add(float64(num))
			c.enqueuedBytes.Add(float64(size))
		default:
			c.failStore(ctx, size, num, "queue at full capacity")
			return nil // queue is full; give up
		}
		keys = keys[num:]
		bufs = bufs[num:]
	}
	return nil
}

func (c *backgroundCache) failStore(ctx context.Context, size int, num int, reason string) {
	c.droppedWriteBackBytes.Add(float64(size))
	c.droppedWriteBack.Add(float64(num))
	sp := opentracing.SpanFromContext(ctx)
	if sp != nil {
		sp.LogFields(otlog.String("reason", reason), otlog.Int("dropped", num), otlog.Int("dropped_bytes", size))
	}
}

func (c *backgroundCache) writeBackLoop() {
	defer c.wg.Done()

	for {
		select {
		case bgWrite, ok := <-c.bgWrites:
			if !ok {
				return
			}
			c.size.Sub(int64(bgWrite.size()))

			c.queueLength.Sub(float64(len(bgWrite.keys)))
			c.queueBytes.Set(float64(c.size.Load()))
			c.dequeuedBytes.Add(float64(bgWrite.size()))
			err := c.Cache.Store(context.Background(), bgWrite.keys, bgWrite.bufs)
			if err != nil {
				level.Warn(util_log.Logger).Log("msg", "backgroundCache writeBackLoop Cache.Store fail", "err", err)
				continue
			}

		case <-c.quit:
			return
		}
	}
}
