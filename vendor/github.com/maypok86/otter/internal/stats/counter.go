// Copyright (c) 2023 Alexey Mayshev. All rights reserved.
// Copyright (c) 2021 Andrey Pechkurov
//
// Copyright notice. This code is a fork of xsync.Counter from this file with some changes:
// https://github.com/puzpuzpuz/xsync/blob/main/counter.go
//
// Use of this source code is governed by a MIT license that can be found
// at https://github.com/puzpuzpuz/xsync/blob/main/LICENSE

package stats

import (
	"sync"
	"sync/atomic"

	"github.com/maypok86/otter/internal/xmath"
	"github.com/maypok86/otter/internal/xruntime"
)

// pool for P tokens.
var tokenPool sync.Pool

// a P token is used to point at the current OS thread (P)
// on which the goroutine is run; exact identity of the thread,
// as well as P migration tolerance, is not important since
// it's used to as a best effort mechanism for assigning
// concurrent operations (goroutines) to different stripes of
// the counter.
type token struct {
	idx     uint32
	padding [xruntime.CacheLineSize - 4]byte
}

// A counter is a striped int64 counter.
//
// Should be preferred over a single atomically updated int64
// counter in high contention scenarios.
//
// A counter must not be copied after first use.
type counter struct {
	shards []cshard
	mask   uint32
}

type cshard struct {
	c       int64
	padding [xruntime.CacheLineSize - 8]byte
}

// newCounter creates a new counter instance.
func newCounter() *counter {
	nshards := xmath.RoundUpPowerOf2(xruntime.Parallelism())
	return &counter{
		shards: make([]cshard, nshards),
		mask:   nshards - 1,
	}
}

// increment increments the counter by 1.
func (c *counter) increment() {
	c.add(1)
}

// decrement decrements the counter by 1.
func (c *counter) decrement() {
	c.add(-1)
}

// add adds the delta to the counter.
func (c *counter) add(delta int64) {
	t, ok := tokenPool.Get().(*token)
	if !ok {
		t = &token{}
		t.idx = xruntime.Fastrand()
	}
	for {
		shard := &c.shards[t.idx&c.mask]
		cnt := atomic.LoadInt64(&shard.c)
		if atomic.CompareAndSwapInt64(&shard.c, cnt, cnt+delta) {
			break
		}
		// Give a try with another randomly selected shard.
		t.idx = xruntime.Fastrand()
	}
	tokenPool.Put(t)
}

// value returns the current counter value.
// The returned value may not include all of the latest operations in
// presence of concurrent modifications of the counter.
func (c *counter) value() int64 {
	v := int64(0)
	for i := 0; i < len(c.shards); i++ {
		shard := &c.shards[i]
		v += atomic.LoadInt64(&shard.c)
	}
	return v
}

// reset resets the counter to zero.
// This method should only be used when it is known that there are
// no concurrent modifications of the counter.
func (c *counter) reset() {
	for i := 0; i < len(c.shards); i++ {
		shard := &c.shards[i]
		atomic.StoreInt64(&shard.c, 0)
	}
}
