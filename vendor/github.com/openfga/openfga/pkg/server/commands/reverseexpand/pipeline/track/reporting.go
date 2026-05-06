package track

import (
	"sync"
)

// Tracker is a struct that keeps a concurrency-safe counter that may be incremented or decremented.
// A Tracker may also be forked to create child instances that report their value changes to the
// parent. A Tracker may also be awaited in a way that eliminates busy wait loops.
type Tracker struct {
	mu     sync.Mutex
	wait   *sync.Cond
	init   sync.Once
	value  int64
	parent *Tracker
}

// Fork is a function that creates a child Tracker instance that reports its value change to the
// parent instance.
func (t *Tracker) Fork() *Tracker {
	return &Tracker{
		parent: t,
	}
}

func (t *Tracker) initialize() {
	t.wait = sync.NewCond(&t.mu)
}

// Add is a function that adds the provided integer value to the current count. This value may be
// negative. Each call to Add wakes all goroutines currently awaiting the Tracker instance.
func (t *Tracker) Add(i int64) int64 {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.init.Do(t.initialize)

	t.value += i
	t.wait.Broadcast()

	if t.parent != nil {
		t.parent.Add(i)
	}

	return t.value
}

// Inc is a function that increments the tracker's count value by 1.
func (t *Tracker) Inc() {
	t.Add(1)
}

// Dec is a function that decrements the tracker's count value by 1.
func (t *Tracker) Dec() {
	t.Add(-1)
}

// Load is a function that returns the tracker's current count value.
func (t *Tracker) Load() int64 {
	t.mu.Lock()
	defer t.mu.Unlock()

	return t.value
}

// Wait is a function that allows a caller to wait for the tracker's count value to reach a
// given condition. Wait blocks until the given function fn returns true. Function fn is
// evaluated on each call to the tracker's Add, Inc, or Dec functions.
func (t *Tracker) Wait(fn func(int64) bool) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.init.Do(t.initialize)

	for !fn(t.value) {
		t.wait.Wait()
	}
}

// Reporter is a struct that holds a reference for a registered reference in a StatusPool.
// A Reporter is returned from a call to StatusPool.Register and should be used by only a
// single goroutine. Using a Reporter concurrently from multiple goroutines will cause
// data races.
type Reporter struct {
	ndx    int
	parent *StatusPool
}

// Report is a function that sets the status of a Reporter on its parent StatusPool.
func (r *Reporter) Report(status bool) {
	r.parent.set(r.ndx, status)
}

// Wait is a function that allows a caller to wait for the reporter's status value to reach a
// given condition. Wait blocks until the given function fn returns true. Function fn is
// evaluated on each mutation of the reporter's parent's state.
func (r *Reporter) Wait(fn func(status bool) bool) {
	r.parent.Wait(fn)
}

// StatusPool is a struct that aggregates status values, as booleans, from multiple sources
// into a single boolean status value. Each source must register itself using the Register
// method update the source's status via the Reporter provided during registration.
// The default state of a StatusPool is `false` for all sources.
type StatusPool struct {
	mu   sync.Mutex
	wait *sync.Cond
	init sync.Once
	pool []bool
}

func (sp *StatusPool) initialize() {
	sp.wait = sync.NewCond(&sp.mu)
}

// Register is a function that creates a new entry in the StatusPool for a source and returns
// a Reporter that is unique within the context of the StatusPool instance. The returned Reporter
// instance must be used to update the status for this entry.
//
// The Register method is thread safe.
func (sp *StatusPool) Register() *Reporter {
	sp.mu.Lock()
	defer sp.mu.Unlock()

	sp.pool = append(sp.pool, false)
	ndx := len(sp.pool) - 1

	return &Reporter{
		ndx:    ndx,
		parent: sp,
	}
}

func (sp *StatusPool) set(ndx int, value bool) {
	sp.mu.Lock()
	defer sp.mu.Unlock()

	sp.init.Do(sp.initialize)

	sp.pool[ndx] = value
	sp.wait.Broadcast()
}

func (sp *StatusPool) get() bool {
	for _, s := range sp.pool {
		if s {
			return true
		}
	}
	return false
}

// Status is a function that returns the cumulative status of all sources registered within the pool.
// If any registered source's status is set to `true`, the return value of the Status function will
// be `true`. The default value is `false`.
//
// The Status method is thread safe.
func (sp *StatusPool) Status() bool {
	sp.mu.Lock()
	defer sp.mu.Unlock()

	return sp.get()
}

// Wait is a function that allows a caller to wait for the pools's status value to reach a
// given condition. Wait blocks until the given function fn returns true. Function fn is
// evaluated on each mutation of the pool's state.
func (sp *StatusPool) Wait(fn func(status bool) bool) {
	sp.mu.Lock()
	defer sp.mu.Unlock()

	sp.init.Do(sp.initialize)

	for !fn(sp.get()) {
		sp.wait.Wait()
	}
}
