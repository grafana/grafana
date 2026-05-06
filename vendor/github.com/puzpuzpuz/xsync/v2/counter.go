package xsync

import (
	"sync"
	"sync/atomic"
)

// pool for P tokens
var ptokenPool sync.Pool

// a P token is used to point at the current OS thread (P)
// on which the goroutine is run; exact identity of the thread,
// as well as P migration tolerance, is not important since
// it's used to as a best effort mechanism for assigning
// concurrent operations (goroutines) to different stripes of
// the counter
type ptoken struct {
	idx uint32
	//lint:ignore U1000 prevents false sharing
	pad [cacheLineSize - 4]byte
}

// A Counter is a striped int64 counter.
//
// Should be preferred over a single atomically updated int64
// counter in high contention scenarios.
//
// A Counter must not be copied after first use.
type Counter struct {
	stripes []cstripe
	mask    uint32
}

type cstripe struct {
	c int64
	//lint:ignore U1000 prevents false sharing
	pad [cacheLineSize - 8]byte
}

// NewCounter creates a new Counter instance.
func NewCounter() *Counter {
	nstripes := nextPowOf2(parallelism())
	c := Counter{
		stripes: make([]cstripe, nstripes),
		mask:    nstripes - 1,
	}
	return &c
}

// Inc increments the counter by 1.
func (c *Counter) Inc() {
	c.Add(1)
}

// Dec decrements the counter by 1.
func (c *Counter) Dec() {
	c.Add(-1)
}

// Add adds the delta to the counter.
func (c *Counter) Add(delta int64) {
	t, ok := ptokenPool.Get().(*ptoken)
	if !ok {
		t = new(ptoken)
		t.idx = fastrand()
	}
	for {
		stripe := &c.stripes[t.idx&c.mask]
		cnt := atomic.LoadInt64(&stripe.c)
		if atomic.CompareAndSwapInt64(&stripe.c, cnt, cnt+delta) {
			break
		}
		// Give a try with another randomly selected stripe.
		t.idx = fastrand()
	}
	ptokenPool.Put(t)
}

// Value returns the current counter value.
// The returned value may not include all of the latest operations in
// presence of concurrent modifications of the counter.
func (c *Counter) Value() int64 {
	v := int64(0)
	for i := 0; i < len(c.stripes); i++ {
		stripe := &c.stripes[i]
		v += atomic.LoadInt64(&stripe.c)
	}
	return v
}

// Reset resets the counter to zero.
// This method should only be used when it is known that there are
// no concurrent modifications of the counter.
func (c *Counter) Reset() {
	for i := 0; i < len(c.stripes); i++ {
		stripe := &c.stripes[i]
		atomic.StoreInt64(&stripe.c, 0)
	}
}
