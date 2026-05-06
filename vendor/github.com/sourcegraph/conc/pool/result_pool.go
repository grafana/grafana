package pool

import (
	"context"
	"sync"
)

// NewWithResults creates a new ResultPool for tasks with a result of type T.
//
// The configuration methods (With*) will panic if they are used after calling
// Go() for the first time.
func NewWithResults[T any]() *ResultPool[T] {
	return &ResultPool[T]{
		pool: *New(),
	}
}

// ResultPool is a pool that executes tasks that return a generic result type.
// Tasks are executed in the pool with Go(), then the results of the tasks are
// returned by Wait().
//
// The order of the results is not guaranteed to be the same as the order the
// tasks were submitted. If your use case requires consistent ordering,
// consider using the `stream` package or `Map` from the `iter` package.
type ResultPool[T any] struct {
	pool Pool
	agg  resultAggregator[T]
}

// Go submits a task to the pool. If all goroutines in the pool
// are busy, a call to Go() will block until the task can be started.
func (p *ResultPool[T]) Go(f func() T) {
	p.pool.Go(func() {
		p.agg.add(f())
	})
}

// Wait cleans up all spawned goroutines, propagating any panics, and returning
// a slice of results from tasks that did not panic.
func (p *ResultPool[T]) Wait() []T {
	p.pool.Wait()
	return p.agg.results
}

// MaxGoroutines returns the maximum size of the pool.
func (p *ResultPool[T]) MaxGoroutines() int {
	return p.pool.MaxGoroutines()
}

// WithErrors converts the pool to an ResultErrorPool so the submitted tasks
// can return errors.
func (p *ResultPool[T]) WithErrors() *ResultErrorPool[T] {
	p.panicIfInitialized()
	return &ResultErrorPool[T]{
		errorPool: *p.pool.WithErrors(),
	}
}

// WithContext converts the pool to a ResultContextPool for tasks that should
// run under the same context, such that they each respect shared cancellation.
// For example, WithCancelOnError can be configured on the returned pool to
// signal that all goroutines should be cancelled upon the first error.
func (p *ResultPool[T]) WithContext(ctx context.Context) *ResultContextPool[T] {
	p.panicIfInitialized()
	return &ResultContextPool[T]{
		contextPool: *p.pool.WithContext(ctx),
	}
}

// WithMaxGoroutines limits the number of goroutines in a pool.
// Defaults to unlimited. Panics if n < 1.
func (p *ResultPool[T]) WithMaxGoroutines(n int) *ResultPool[T] {
	p.panicIfInitialized()
	p.pool.WithMaxGoroutines(n)
	return p
}

func (p *ResultPool[T]) panicIfInitialized() {
	p.pool.panicIfInitialized()
}

// resultAggregator is a utility type that lets us safely append from multiple
// goroutines. The zero value is valid and ready to use.
type resultAggregator[T any] struct {
	mu      sync.Mutex
	results []T
}

func (r *resultAggregator[T]) add(res T) {
	r.mu.Lock()
	r.results = append(r.results, res)
	r.mu.Unlock()
}
