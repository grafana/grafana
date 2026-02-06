package reverseexpand

import (
	"sync"
	"sync/atomic"
)

type tracker interface {
	Add(int64) int64
	Load() int64
}

type echoTracker struct {
	local  atomic.Int64
	parent tracker
}

func (t *echoTracker) Add(i int64) int64 {
	value := t.local.Add(i)
	if t.parent != nil {
		t.parent.Add(i)
	}
	return value
}

func (t *echoTracker) Load() int64 {
	return t.local.Load()
}

func newEchoTracker(parent tracker) tracker {
	return &echoTracker{
		parent: parent,
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
	r.parent.mu.RLock()
	defer r.parent.mu.RUnlock()

	r.parent.pool[r.ndx] = status
}

// StatusPool is a struct that aggregates status values, as booleans, from multiple sources
// into a single boolean status value. Each source must register itself using the Register
// method update the source's status via the Reporter provided during registration.
// The default state of a StatusPool is `false` for all sources.
type StatusPool struct {
	mu   sync.RWMutex
	pool []bool
}

// Register is a function that creates a new entry in the StatusPool for a source and returns
// a Reporter that is unique within the context of the StatusPool instance. The returned Reporter
// instance must be used to update the status for this entry.
//
// The Register method is thread safe.
func (sp *StatusPool) Register() Reporter {
	sp.mu.Lock()
	defer sp.mu.Unlock()

	sp.pool = append(sp.pool, false)
	ndx := len(sp.pool) - 1

	return Reporter{
		ndx:    ndx,
		parent: sp,
	}
}

// Status is a function that returns the cumulative status of all sources registered within the pool.
// If any registered source's status is set to `true`, the return value of the Status function will
// be `true`. The default value is `false`.
//
// The Status method is thread safe.
func (sp *StatusPool) Status() bool {
	sp.mu.Lock()
	defer sp.mu.Unlock()

	for _, s := range sp.pool {
		if s {
			return true
		}
	}
	return false
}
