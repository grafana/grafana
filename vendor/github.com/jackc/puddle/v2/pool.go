package puddle

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/puddle/v2/internal/genstack"
	"golang.org/x/sync/semaphore"
)

const (
	resourceStatusConstructing = 0
	resourceStatusIdle         = iota
	resourceStatusAcquired     = iota
	resourceStatusHijacked     = iota
)

// ErrClosedPool occurs on an attempt to acquire a connection from a closed pool
// or a pool that is closed while the acquire is waiting.
var ErrClosedPool = errors.New("closed pool")

// ErrNotAvailable occurs on an attempt to acquire a resource from a pool
// that is at maximum capacity and has no available resources.
var ErrNotAvailable = errors.New("resource not available")

// Constructor is a function called by the pool to construct a resource.
type Constructor[T any] func(ctx context.Context) (res T, err error)

// Destructor is a function called by the pool to destroy a resource.
type Destructor[T any] func(res T)

// Resource is the resource handle returned by acquiring from the pool.
type Resource[T any] struct {
	value          T
	pool           *Pool[T]
	creationTime   time.Time
	lastUsedNano   int64
	poolResetCount int
	status         byte
}

// Value returns the resource value.
func (res *Resource[T]) Value() T {
	if !(res.status == resourceStatusAcquired || res.status == resourceStatusHijacked) {
		panic("tried to access resource that is not acquired or hijacked")
	}
	return res.value
}

// Release returns the resource to the pool. res must not be subsequently used.
func (res *Resource[T]) Release() {
	if res.status != resourceStatusAcquired {
		panic("tried to release resource that is not acquired")
	}
	res.pool.releaseAcquiredResource(res, nanotime())
}

// ReleaseUnused returns the resource to the pool without updating when it was last used used. i.e. LastUsedNanotime
// will not change. res must not be subsequently used.
func (res *Resource[T]) ReleaseUnused() {
	if res.status != resourceStatusAcquired {
		panic("tried to release resource that is not acquired")
	}
	res.pool.releaseAcquiredResource(res, res.lastUsedNano)
}

// Destroy returns the resource to the pool for destruction. res must not be
// subsequently used.
func (res *Resource[T]) Destroy() {
	if res.status != resourceStatusAcquired {
		panic("tried to destroy resource that is not acquired")
	}
	go res.pool.destroyAcquiredResource(res)
}

// Hijack assumes ownership of the resource from the pool. Caller is responsible
// for cleanup of resource value.
func (res *Resource[T]) Hijack() {
	if res.status != resourceStatusAcquired {
		panic("tried to hijack resource that is not acquired")
	}
	res.pool.hijackAcquiredResource(res)
}

// CreationTime returns when the resource was created by the pool.
func (res *Resource[T]) CreationTime() time.Time {
	if !(res.status == resourceStatusAcquired || res.status == resourceStatusHijacked) {
		panic("tried to access resource that is not acquired or hijacked")
	}
	return res.creationTime
}

// LastUsedNanotime returns when Release was last called on the resource measured in nanoseconds from an arbitrary time
// (a monotonic time). Returns creation time if Release has never been called. This is only useful to compare with
// other calls to LastUsedNanotime. In almost all cases, IdleDuration should be used instead.
func (res *Resource[T]) LastUsedNanotime() int64 {
	if !(res.status == resourceStatusAcquired || res.status == resourceStatusHijacked) {
		panic("tried to access resource that is not acquired or hijacked")
	}

	return res.lastUsedNano
}

// IdleDuration returns the duration since Release was last called on the resource. This is equivalent to subtracting
// LastUsedNanotime to the current nanotime.
func (res *Resource[T]) IdleDuration() time.Duration {
	if !(res.status == resourceStatusAcquired || res.status == resourceStatusHijacked) {
		panic("tried to access resource that is not acquired or hijacked")
	}

	return time.Duration(nanotime() - res.lastUsedNano)
}

// Pool is a concurrency-safe resource pool.
type Pool[T any] struct {
	// mux is the pool internal lock. Any modification of shared state of
	// the pool (but Acquires of acquireSem) must be performed only by
	// holder of the lock. Long running operations are not allowed when mux
	// is held.
	mux sync.Mutex
	// acquireSem provides an allowance to acquire a resource.
	//
	// Releases are allowed only when caller holds mux. Acquires have to
	// happen before mux is locked (doesn't apply to semaphore.TryAcquire in
	// AcquireAllIdle).
	acquireSem *semaphore.Weighted
	destructWG sync.WaitGroup

	allResources  resList[T]
	idleResources *genstack.GenStack[*Resource[T]]

	constructor Constructor[T]
	destructor  Destructor[T]
	maxSize     int32

	acquireCount         int64
	acquireDuration      time.Duration
	emptyAcquireCount    int64
	emptyAcquireWaitTime time.Duration
	canceledAcquireCount atomic.Int64

	resetCount int

	baseAcquireCtx       context.Context
	cancelBaseAcquireCtx context.CancelFunc
	closed               bool
}

type Config[T any] struct {
	Constructor Constructor[T]
	Destructor  Destructor[T]
	MaxSize     int32
}

// NewPool creates a new pool. Returns an error iff MaxSize is less than 1.
func NewPool[T any](config *Config[T]) (*Pool[T], error) {
	if config.MaxSize < 1 {
		return nil, errors.New("MaxSize must be >= 1")
	}

	baseAcquireCtx, cancelBaseAcquireCtx := context.WithCancel(context.Background())

	return &Pool[T]{
		acquireSem:           semaphore.NewWeighted(int64(config.MaxSize)),
		idleResources:        genstack.NewGenStack[*Resource[T]](),
		maxSize:              config.MaxSize,
		constructor:          config.Constructor,
		destructor:           config.Destructor,
		baseAcquireCtx:       baseAcquireCtx,
		cancelBaseAcquireCtx: cancelBaseAcquireCtx,
	}, nil
}

// Close destroys all resources in the pool and rejects future Acquire calls.
// Blocks until all resources are returned to pool and destroyed.
func (p *Pool[T]) Close() {
	defer p.destructWG.Wait()

	p.mux.Lock()
	defer p.mux.Unlock()

	if p.closed {
		return
	}
	p.closed = true
	p.cancelBaseAcquireCtx()

	for res, ok := p.idleResources.Pop(); ok; res, ok = p.idleResources.Pop() {
		p.allResources.remove(res)
		go p.destructResourceValue(res.value)
	}
}

// Stat is a snapshot of Pool statistics.
type Stat struct {
	constructingResources int32
	acquiredResources     int32
	idleResources         int32
	maxResources          int32
	acquireCount          int64
	acquireDuration       time.Duration
	emptyAcquireCount     int64
	emptyAcquireWaitTime  time.Duration
	canceledAcquireCount  int64
}

// TotalResources returns the total number of resources currently in the pool.
// The value is the sum of ConstructingResources, AcquiredResources, and
// IdleResources.
func (s *Stat) TotalResources() int32 {
	return s.constructingResources + s.acquiredResources + s.idleResources
}

// ConstructingResources returns the number of resources with construction in progress in
// the pool.
func (s *Stat) ConstructingResources() int32 {
	return s.constructingResources
}

// AcquiredResources returns the number of currently acquired resources in the pool.
func (s *Stat) AcquiredResources() int32 {
	return s.acquiredResources
}

// IdleResources returns the number of currently idle resources in the pool.
func (s *Stat) IdleResources() int32 {
	return s.idleResources
}

// MaxResources returns the maximum size of the pool.
func (s *Stat) MaxResources() int32 {
	return s.maxResources
}

// AcquireCount returns the cumulative count of successful acquires from the pool.
func (s *Stat) AcquireCount() int64 {
	return s.acquireCount
}

// AcquireDuration returns the total duration of all successful acquires from
// the pool.
func (s *Stat) AcquireDuration() time.Duration {
	return s.acquireDuration
}

// EmptyAcquireCount returns the cumulative count of successful acquires from the pool
// that waited for a resource to be released or constructed because the pool was
// empty.
func (s *Stat) EmptyAcquireCount() int64 {
	return s.emptyAcquireCount
}

// EmptyAcquireWaitTime returns the cumulative time waited for successful acquires
// from the pool for a resource to be released or constructed because the pool was
// empty.
func (s *Stat) EmptyAcquireWaitTime() time.Duration {
	return s.emptyAcquireWaitTime
}

// CanceledAcquireCount returns the cumulative count of acquires from the pool
// that were canceled by a context.
func (s *Stat) CanceledAcquireCount() int64 {
	return s.canceledAcquireCount
}

// Stat returns the current pool statistics.
func (p *Pool[T]) Stat() *Stat {
	p.mux.Lock()
	defer p.mux.Unlock()

	s := &Stat{
		maxResources:         p.maxSize,
		acquireCount:         p.acquireCount,
		emptyAcquireCount:    p.emptyAcquireCount,
		emptyAcquireWaitTime: p.emptyAcquireWaitTime,
		canceledAcquireCount: p.canceledAcquireCount.Load(),
		acquireDuration:      p.acquireDuration,
	}

	for _, res := range p.allResources {
		switch res.status {
		case resourceStatusConstructing:
			s.constructingResources += 1
		case resourceStatusIdle:
			s.idleResources += 1
		case resourceStatusAcquired:
			s.acquiredResources += 1
		}
	}

	return s
}

// tryAcquireIdleResource checks if there is any idle resource. If there is
// some, this method removes it from idle list and returns it. If the idle pool
// is empty, this method returns nil and doesn't modify the idleResources slice.
//
// WARNING: Caller of this method must hold the pool mutex!
func (p *Pool[T]) tryAcquireIdleResource() *Resource[T] {
	res, ok := p.idleResources.Pop()
	if !ok {
		return nil
	}

	res.status = resourceStatusAcquired
	return res
}

// createNewResource creates a new resource and inserts it into list of pool
// resources.
//
// WARNING: Caller of this method must hold the pool mutex!
func (p *Pool[T]) createNewResource() *Resource[T] {
	res := &Resource[T]{
		pool:           p,
		creationTime:   time.Now(),
		lastUsedNano:   nanotime(),
		poolResetCount: p.resetCount,
		status:         resourceStatusConstructing,
	}

	p.allResources.append(res)
	p.destructWG.Add(1)

	return res
}

// Acquire gets a resource from the pool. If no resources are available and the pool is not at maximum capacity it will
// create a new resource. If the pool is at maximum capacity it will block until a resource is available. ctx can be
// used to cancel the Acquire.
//
// If Acquire creates a new resource the resource constructor function will receive a context that delegates Value() to
// ctx. Canceling ctx will cause Acquire to return immediately but it will not cancel the resource creation. This avoids
// the problem of it being impossible to create resources when the time to create a resource is greater than any one
// caller of Acquire is willing to wait.
func (p *Pool[T]) Acquire(ctx context.Context) (_ *Resource[T], err error) {
	select {
	case <-ctx.Done():
		p.canceledAcquireCount.Add(1)
		return nil, ctx.Err()
	default:
	}

	return p.acquire(ctx)
}

// acquire is a continuation of Acquire function that doesn't check context
// validity.
//
// This function exists solely only for benchmarking purposes.
func (p *Pool[T]) acquire(ctx context.Context) (*Resource[T], error) {
	startNano := nanotime()

	var waitedForLock bool
	if !p.acquireSem.TryAcquire(1) {
		waitedForLock = true
		err := p.acquireSem.Acquire(ctx, 1)
		if err != nil {
			p.canceledAcquireCount.Add(1)
			return nil, err
		}
	}

	p.mux.Lock()
	if p.closed {
		p.acquireSem.Release(1)
		p.mux.Unlock()
		return nil, ErrClosedPool
	}

	// If a resource is available in the pool.
	if res := p.tryAcquireIdleResource(); res != nil {
		waitTime := time.Duration(nanotime() - startNano)
		if waitedForLock {
			p.emptyAcquireCount += 1
			p.emptyAcquireWaitTime += waitTime
		}
		p.acquireCount += 1
		p.acquireDuration += waitTime
		p.mux.Unlock()
		return res, nil
	}

	if len(p.allResources) >= int(p.maxSize) {
		// Unreachable code.
		panic("bug: semaphore allowed more acquires than pool allows")
	}

	// The resource is not idle, but there is enough space to create one.
	res := p.createNewResource()
	p.mux.Unlock()

	res, err := p.initResourceValue(ctx, res)
	if err != nil {
		return nil, err
	}

	p.mux.Lock()
	defer p.mux.Unlock()

	p.emptyAcquireCount += 1
	p.acquireCount += 1
	waitTime := time.Duration(nanotime() - startNano)
	p.acquireDuration += waitTime
	p.emptyAcquireWaitTime += waitTime

	return res, nil
}

func (p *Pool[T]) initResourceValue(ctx context.Context, res *Resource[T]) (*Resource[T], error) {
	// Create the resource in a goroutine to immediately return from Acquire
	// if ctx is canceled without also canceling the constructor.
	//
	// See:
	// - https://github.com/jackc/pgx/issues/1287
	// - https://github.com/jackc/pgx/issues/1259
	constructErrChan := make(chan error)
	go func() {
		constructorCtx := newValueCancelCtx(ctx, p.baseAcquireCtx)
		value, err := p.constructor(constructorCtx)
		if err != nil {
			p.mux.Lock()
			p.allResources.remove(res)
			p.destructWG.Done()

			// The resource won't be acquired because its
			// construction failed. We have to allow someone else to
			// take that resouce.
			p.acquireSem.Release(1)
			p.mux.Unlock()

			select {
			case constructErrChan <- err:
			case <-ctx.Done():
				// The caller is cancelled, so no-one awaits the
				// error. This branch avoid goroutine leak.
			}
			return
		}

		// The resource is already in p.allResources where it might be read. So we need to acquire the lock to update its
		// status.
		p.mux.Lock()
		res.value = value
		res.status = resourceStatusAcquired
		p.mux.Unlock()

		// This select works because the channel is unbuffered.
		select {
		case constructErrChan <- nil:
		case <-ctx.Done():
			p.releaseAcquiredResource(res, res.lastUsedNano)
		}
	}()

	select {
	case <-ctx.Done():
		p.canceledAcquireCount.Add(1)
		return nil, ctx.Err()
	case err := <-constructErrChan:
		if err != nil {
			return nil, err
		}
		return res, nil
	}
}

// TryAcquire gets a resource from the pool if one is immediately available. If not, it returns ErrNotAvailable. If no
// resources are available but the pool has room to grow, a resource will be created in the background. ctx is only
// used to cancel the background creation.
func (p *Pool[T]) TryAcquire(ctx context.Context) (*Resource[T], error) {
	if !p.acquireSem.TryAcquire(1) {
		return nil, ErrNotAvailable
	}

	p.mux.Lock()
	defer p.mux.Unlock()

	if p.closed {
		p.acquireSem.Release(1)
		return nil, ErrClosedPool
	}

	// If a resource is available now
	if res := p.tryAcquireIdleResource(); res != nil {
		p.acquireCount += 1
		return res, nil
	}

	if len(p.allResources) >= int(p.maxSize) {
		// Unreachable code.
		panic("bug: semaphore allowed more acquires than pool allows")
	}

	res := p.createNewResource()
	go func() {
		value, err := p.constructor(ctx)

		p.mux.Lock()
		defer p.mux.Unlock()
		// We have to create the resource and only then release the
		// semaphore - For the time being there is no resource that
		// someone could acquire.
		defer p.acquireSem.Release(1)

		if err != nil {
			p.allResources.remove(res)
			p.destructWG.Done()
			return
		}

		res.value = value
		res.status = resourceStatusIdle
		p.idleResources.Push(res)
	}()

	return nil, ErrNotAvailable
}

// acquireSemAll tries to acquire num free tokens from sem. This function is
// guaranteed to acquire at least the lowest number of tokens that has been
// available in the semaphore during runtime of this function.
//
// For the time being, semaphore doesn't allow to acquire all tokens atomically
// (see https://github.com/golang/sync/pull/19). We simulate this by trying all
// powers of 2 that are less or equal to num.
//
// For example, let's immagine we have 19 free tokens in the semaphore which in
// total has 24 tokens (i.e. the maxSize of the pool is 24 resources). Then if
// num is 24, the log2Uint(24) is 4 and we try to acquire 16, 8, 4, 2 and 1
// tokens. Out of those, the acquire of 16, 2 and 1 tokens will succeed.
//
// Naturally, Acquires and Releases of the semaphore might take place
// concurrently. For this reason, it's not guaranteed that absolutely all free
// tokens in the semaphore will be acquired. But it's guaranteed that at least
// the minimal number of tokens that has been present over the whole process
// will be acquired. This is sufficient for the use-case we have in this
// package.
//
// TODO: Replace this with acquireSem.TryAcquireAll() if it gets to
// upstream. https://github.com/golang/sync/pull/19
func acquireSemAll(sem *semaphore.Weighted, num int) int {
	if sem.TryAcquire(int64(num)) {
		return num
	}

	var acquired int
	for i := int(log2Int(num)); i >= 0; i-- {
		val := 1 << i
		if sem.TryAcquire(int64(val)) {
			acquired += val
		}
	}

	return acquired
}

// AcquireAllIdle acquires all currently idle resources. Its intended use is for
// health check and keep-alive functionality. It does not update pool
// statistics.
func (p *Pool[T]) AcquireAllIdle() []*Resource[T] {
	p.mux.Lock()
	defer p.mux.Unlock()

	if p.closed {
		return nil
	}

	numIdle := p.idleResources.Len()
	if numIdle == 0 {
		return nil
	}

	// In acquireSemAll we use only TryAcquire and not Acquire. Because
	// TryAcquire cannot block, the fact that we hold mutex locked and try
	// to acquire semaphore cannot result in dead-lock.
	//
	// Because the mutex is locked, no parallel Release can run. This
	// implies that the number of tokens can only decrease because some
	// Acquire/TryAcquire call can consume the semaphore token. Consequently
	// acquired is always less or equal to numIdle. Moreover if acquired <
	// numIdle, then there are some parallel Acquire/TryAcquire calls that
	// will take the remaining idle connections.
	acquired := acquireSemAll(p.acquireSem, numIdle)

	idle := make([]*Resource[T], acquired)
	for i := range idle {
		res, _ := p.idleResources.Pop()
		res.status = resourceStatusAcquired
		idle[i] = res
	}

	// We have to bump the generation to ensure that Acquire/TryAcquire
	// calls running in parallel (those which caused acquired < numIdle)
	// will consume old connections and not freshly released connections
	// instead.
	p.idleResources.NextGen()

	return idle
}

// CreateResource constructs a new resource without acquiring it. It goes straight in the IdlePool. If the pool is full
// it returns an error. It can be useful to maintain warm resources under little load.
func (p *Pool[T]) CreateResource(ctx context.Context) error {
	if !p.acquireSem.TryAcquire(1) {
		return ErrNotAvailable
	}

	p.mux.Lock()
	if p.closed {
		p.acquireSem.Release(1)
		p.mux.Unlock()
		return ErrClosedPool
	}

	if len(p.allResources) >= int(p.maxSize) {
		p.acquireSem.Release(1)
		p.mux.Unlock()
		return ErrNotAvailable
	}

	res := p.createNewResource()
	p.mux.Unlock()

	value, err := p.constructor(ctx)
	p.mux.Lock()
	defer p.mux.Unlock()
	defer p.acquireSem.Release(1)
	if err != nil {
		p.allResources.remove(res)
		p.destructWG.Done()
		return err
	}

	res.value = value
	res.status = resourceStatusIdle

	// If closed while constructing resource then destroy it and return an error
	if p.closed {
		go p.destructResourceValue(res.value)
		return ErrClosedPool
	}

	p.idleResources.Push(res)

	return nil
}

// Reset destroys all resources, but leaves the pool open. It is intended for use when an error is detected that would
// disrupt all resources (such as a network interruption or a server state change).
//
// It is safe to reset a pool while resources are checked out. Those resources will be destroyed when they are returned
// to the pool.
func (p *Pool[T]) Reset() {
	p.mux.Lock()
	defer p.mux.Unlock()

	p.resetCount++

	for res, ok := p.idleResources.Pop(); ok; res, ok = p.idleResources.Pop() {
		p.allResources.remove(res)
		go p.destructResourceValue(res.value)
	}
}

// releaseAcquiredResource returns res to the the pool.
func (p *Pool[T]) releaseAcquiredResource(res *Resource[T], lastUsedNano int64) {
	p.mux.Lock()
	defer p.mux.Unlock()
	defer p.acquireSem.Release(1)

	if p.closed || res.poolResetCount != p.resetCount {
		p.allResources.remove(res)
		go p.destructResourceValue(res.value)
	} else {
		res.lastUsedNano = lastUsedNano
		res.status = resourceStatusIdle
		p.idleResources.Push(res)
	}
}

// Remove removes res from the pool and closes it. If res is not part of the
// pool Remove will panic.
func (p *Pool[T]) destroyAcquiredResource(res *Resource[T]) {
	p.destructResourceValue(res.value)

	p.mux.Lock()
	defer p.mux.Unlock()
	defer p.acquireSem.Release(1)

	p.allResources.remove(res)
}

func (p *Pool[T]) hijackAcquiredResource(res *Resource[T]) {
	p.mux.Lock()
	defer p.mux.Unlock()
	defer p.acquireSem.Release(1)

	p.allResources.remove(res)
	res.status = resourceStatusHijacked
	p.destructWG.Done() // not responsible for destructing hijacked resources
}

func (p *Pool[T]) destructResourceValue(value T) {
	p.destructor(value)
	p.destructWG.Done()
}
