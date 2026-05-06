// Forked with love from: https://github.com/prometheus/prometheus/tree/c954cd9d1d4e3530be2939d39d8633c38b70913f/util/pool
// This package was forked to provide better protection against putting byte slices back into the pool that
// did not originate from it.

package pool

import (
	"fmt"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var metricAllocOutPool = promauto.NewCounterVec(prometheus.CounterOpts{
	Namespace: "tempo",
	Name:      "buffer_pool_miss_bytes_total",
	Help:      "The total number of alloc'ed bytes that missed the sync pools.",
}, []string{"name", "direction"})

// Pool is a linearly bucketed pool for variably sized byte slices.
type Pool struct {
	buckets   []sync.Pool
	bktSize   int
	minBucket int

	metricMissOver  prometheus.Counter
	metricMissUnder prometheus.Counter
}

// New returns a new Pool with size buckets for minSize to maxSize
func New(name string, minBucket, numBuckets, bktSize int) *Pool {
	if minBucket < 0 {
		panic("invalid min bucket size")
	}
	if bktSize < 1 {
		panic("invalid bucket size")
	}
	if numBuckets < 1 {
		panic("invalid num buckets")
	}

	return &Pool{
		buckets:         make([]sync.Pool, numBuckets),
		bktSize:         bktSize,
		minBucket:       minBucket,
		metricMissOver:  metricAllocOutPool.WithLabelValues(name, "over"),
		metricMissUnder: metricAllocOutPool.WithLabelValues(name, "under"),
	}
}

// Get returns a new byte slices that fits the given size.
func (p *Pool) Get(sz int) []byte {
	if sz < 0 {
		panic(fmt.Sprintf("invalid buffer size %d", sz))
	}

	// Find the right bucket.
	bkt := p.bucketFor(sz)

	if bkt < 0 {
		p.metricMissUnder.Add(float64(sz))
		return make([]byte, 0, sz)
	}

	if bkt >= len(p.buckets) {
		p.metricMissOver.Add(float64(sz))
		return make([]byte, 0, sz)
	}

	b := p.buckets[bkt].Get()
	if b == nil {
		alignedSz := (bkt+1)*p.bktSize + p.minBucket
		b = make([]byte, 0, alignedSz)
	}
	return b.([]byte)
}

// Put adds a slice to the right bucket in the pool.
func (p *Pool) Put(s []byte) int {
	c := cap(s)

	// valid slice?
	if (c-p.minBucket)%p.bktSize != 0 {
		return -1
	}
	bkt := p.bucketFor(c) // -1 puts the slice in the pool below. it will be larger than all requested slices for this bucket
	if bkt < 0 {
		return -1
	}
	if bkt >= len(p.buckets) {
		return -1
	}

	p.buckets[bkt].Put(s) // nolint: staticcheck

	return bkt // for testing
}

func (p *Pool) bucketFor(sz int) int {
	if sz <= p.minBucket {
		return -1
	}

	return (sz - p.minBucket - 1) / p.bktSize
}
