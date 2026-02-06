package xsync

import (
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

// slow-down guard
const nslowdown = 7

// pool for reader tokens
var rtokenPool sync.Pool

// RToken is a reader lock token.
type RToken struct {
	slot uint32
	//lint:ignore U1000 prevents false sharing
	pad [cacheLineSize - 4]byte
}

// A RBMutex is a reader biased reader/writer mutual exclusion lock.
// The lock can be held by an many readers or a single writer.
// The zero value for a RBMutex is an unlocked mutex.
//
// A RBMutex must not be copied after first use.
//
// RBMutex is based on a modified version of BRAVO
// (Biased Locking for Reader-Writer Locks) algorithm:
// https://arxiv.org/pdf/1810.01553.pdf
//
// RBMutex is a specialized mutex for scenarios, such as caches,
// where the vast majority of locks are acquired by readers and write
// lock acquire attempts are infrequent. In such scenarios, RBMutex
// performs better than sync.RWMutex on large multicore machines.
//
// RBMutex extends sync.RWMutex internally and uses it as the "reader
// bias disabled" fallback, so the same semantics apply. The only
// noticeable difference is in reader tokens returned from the
// RLock/RUnlock methods.
type RBMutex struct {
	rslots       []rslot
	rmask        uint32
	rbias        int32
	inhibitUntil time.Time
	rw           sync.RWMutex
}

type rslot struct {
	mu int32
	//lint:ignore U1000 prevents false sharing
	pad [cacheLineSize - 4]byte
}

// NewRBMutex creates a new RBMutex instance.
func NewRBMutex() *RBMutex {
	nslots := nextPowOf2(parallelism())
	mu := RBMutex{
		rslots: make([]rslot, nslots),
		rmask:  nslots - 1,
		rbias:  1,
	}
	return &mu
}

// RLock locks m for reading and returns a reader token. The
// token must be used in the later RUnlock call.
//
// Should not be used for recursive read locking; a blocked Lock
// call excludes new readers from acquiring the lock.
func (mu *RBMutex) RLock() *RToken {
	if atomic.LoadInt32(&mu.rbias) == 1 {
		t, ok := rtokenPool.Get().(*RToken)
		if !ok {
			t = new(RToken)
			t.slot = fastrand()
		}
		// Try all available slots to distribute reader threads to slots.
		for i := 0; i < len(mu.rslots); i++ {
			slot := t.slot + uint32(i)
			rslot := &mu.rslots[slot&mu.rmask]
			rslotmu := atomic.LoadInt32(&rslot.mu)
			if atomic.CompareAndSwapInt32(&rslot.mu, rslotmu, rslotmu+1) {
				if atomic.LoadInt32(&mu.rbias) == 1 {
					// Hot path succeeded.
					t.slot = slot
					return t
				}
				// The mutex is no longer reader biased. Go to the slow path.
				atomic.AddInt32(&rslot.mu, -1)
				rtokenPool.Put(t)
				break
			}
			// Contention detected. Give a try with the next slot.
		}
	}
	// Slow path.
	mu.rw.RLock()
	if atomic.LoadInt32(&mu.rbias) == 0 && time.Now().After(mu.inhibitUntil) {
		atomic.StoreInt32(&mu.rbias, 1)
	}
	return nil
}

// RUnlock undoes a single RLock call. A reader token obtained from
// the RLock call must be provided. RUnlock does not affect other
// simultaneous readers. A panic is raised if m is not locked for
// reading on entry to RUnlock.
func (mu *RBMutex) RUnlock(t *RToken) {
	if t == nil {
		mu.rw.RUnlock()
		return
	}
	if atomic.AddInt32(&mu.rslots[t.slot&mu.rmask].mu, -1) < 0 {
		panic("invalid reader state detected")
	}
	rtokenPool.Put(t)
}

// Lock locks m for writing. If the lock is already locked for
// reading or writing, Lock blocks until the lock is available.
func (mu *RBMutex) Lock() {
	mu.rw.Lock()
	if atomic.LoadInt32(&mu.rbias) == 1 {
		atomic.StoreInt32(&mu.rbias, 0)
		start := time.Now()
		for i := 0; i < len(mu.rslots); i++ {
			for atomic.LoadInt32(&mu.rslots[i].mu) > 0 {
				runtime.Gosched()
			}
		}
		mu.inhibitUntil = time.Now().Add(time.Since(start) * nslowdown)
	}
}

// Unlock unlocks m for writing. A panic is raised if m is not locked
// for writing on entry to Unlock.
//
// As with RWMutex, a locked RBMutex is not associated with a
// particular goroutine. One goroutine may RLock (Lock) a RBMutex and
// then arrange for another goroutine to RUnlock (Unlock) it.
func (mu *RBMutex) Unlock() {
	mu.rw.Unlock()
}
