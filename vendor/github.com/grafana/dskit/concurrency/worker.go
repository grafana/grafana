package concurrency

import (
	"math"

	"go.uber.org/atomic"
)

// NewReusableGoroutinesPool creates a new worker pool with the given size.
// Workers are created on demand as they're needed up to the specified size.
//
// These workers will run the workloads passed through Go() calls.
// If all workers are busy, Go() will spawn a new goroutine to run the workload.
func NewReusableGoroutinesPool(size int) *ReusableGoroutinesPool {
	p := &ReusableGoroutinesPool{
		jobs:    make(chan func()),
		closed:  make(chan struct{}),
		pending: atomic.NewInt64(int64(size)),
	}
	return p
}

type ReusableGoroutinesPool struct {
	jobs    chan func()
	closed  chan struct{}
	pending *atomic.Int64
}

// Go will run the given function in a worker of the pool.
// If all workers are busy, Go() will spawn a new goroutine to run the workload.
func (p *ReusableGoroutinesPool) Go(f func()) {
	select {
	case p.jobs <- f:
	default:
		if pending := p.pending.Dec(); pending >= 0 {
			p.newWorker(f)
			return
		} else if pending < math.MinInt64/2 {
			// Wow, that's a lot of goroutines created, make sure we don't overflow.
			p.pending.Store(0)
		}
		go f()
	}
}

func (p *ReusableGoroutinesPool) newWorker(f func()) {
	go func() {
		// First run the provided function.
		f()
		// Then listen for more jobs.
		for {
			select {
			case f := <-p.jobs:
				f()
			case <-p.closed:
				return
			}
		}
	}()
}

// Close stops the workers of the pool.
// No new Go() calls should be performed after calling Close().
// Close does NOT wait for all jobs to finish, it is the caller's responsibility to ensure that in the provided workloads.
// Close is intended to be used in tests to ensure that no goroutines are leaked.
func (p *ReusableGoroutinesPool) Close() {
	close(p.closed)
}
