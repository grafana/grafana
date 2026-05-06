package operator

import (
	"context"
	"sync"
)

var _ Informer = &ConcurrentInformer{}

// ConcurrentInformer implements the Informer interface, wrapping another Informer implementation
// to provide concurrent handling of events.
// Events will still be emitted sequentially, but the event handler methods on added ResourceWatchers
// (ie the business logic) will be processed by concurrent workers. Events for an object will be assigned
// to the same worker to preserve the per-object in-order guarantee provided by K8s client tooling.
type ConcurrentInformer struct {
	errorHandler func(context.Context, error)

	informer             Informer
	watchers             []*concurrentWatcher
	maxConcurrentWorkers uint64

	mtx sync.RWMutex
}

type ConcurrentInformerOptions struct {
	// ErrorHandler is a user-specified error handling function. If left nil, DefaultErrorHandler will be used.
	ErrorHandler func(context.Context, error)
	// MaxConcurrentWorkers is a limit on the number of workers to run concurrently for each ResourceWatcher. Each
	// worker maintains a queue of events which are processed sequentially. Events for a particular object are assigned
	// to the same worker, as to maintain the guarantee of in-order delivery of events per object.
	// By default, a single worker is run to process all events sequentially.
	MaxConcurrentWorkers uint64
}

// NewConcurrentInformer creates a new ConcurrentInformer wrapping the provided Informer.
func NewConcurrentInformer(inf Informer, opts ConcurrentInformerOptions) (
	*ConcurrentInformer, error) {
	ci := &ConcurrentInformer{
		errorHandler:         DefaultErrorHandler,
		informer:             inf,
		watchers:             make([]*concurrentWatcher, 0),
		maxConcurrentWorkers: 1,
	}
	if opts.ErrorHandler != nil {
		ci.errorHandler = opts.ErrorHandler
	}
	if opts.MaxConcurrentWorkers > 1 {
		ci.maxConcurrentWorkers = opts.MaxConcurrentWorkers
	}

	return ci, nil
}

// AddEventHandler adds a ResourceWatcher as an event handler for watch events from the informer.
// The ResourceWatcher is wrapped before adding it to the underlying Informer, to allow concurrent
// handling of the events.
// Event handlers are not guaranteed to be executed in parallel or in any particular order by the underlying
// Informer. If you want to coordinate between ResourceWatchers, use an InformerController.
// nolint:dupl
func (ci *ConcurrentInformer) AddEventHandler(handler ResourceWatcher) error {
	cw, err := newConcurrentWatcher(handler, ci.maxConcurrentWorkers, ci.errorHandler)
	if err != nil {
		return err
	}

	{
		ci.mtx.Lock()
		ci.watchers = append(ci.watchers, cw)
		ci.mtx.Unlock()
	}

	return ci.informer.AddEventHandler(cw)
}

// Run starts the informer and blocks until stopCh receives a message
func (ci *ConcurrentInformer) Run(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	ci.mtx.RLock()
	for _, cw := range ci.watchers {
		go cw.Run(ctx)
	}
	ci.mtx.RUnlock()

	return ci.informer.Run(ctx)
}
