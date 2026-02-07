package operator

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/cespare/xxhash/v2"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
)

var (
	initialBufferSize = 1024
)

type eventInfo struct {
	ctx    context.Context
	action ResourceAction
	target resource.Object
	source resource.Object
}

var _ ResourceWatcher = &concurrentWatcher{}

// concurrentWatcher is a struct that implements ResourceWatcher, but takes no action on its own.
// For each method in (Add, Update, Delete) the event is added in a buffered queue and the corresponding
// methods of the underlying ResourceWatcher are called concurrently.
// The events are processed by a fixed number of workers running concurrently. Each worker processing
// the events one-by-one. The events are sharded using hash mod algorithm, ensuring events for same object
// end up in the same worker. This is to uphold the guarantee of in-order delivery of events for an object.
type concurrentWatcher struct {
	watcher      ResourceWatcher
	size         uint64
	workers      map[uint64]*bufferedQueue
	errorHandler func(context.Context, error)
}

// newConcurrentWatcher returns a properly initialized ConcurrentWatcher. The consumer **must**
// call the `concurrentWatcher.Run()` method afterwards to start the underlying workers. If not, the
// wrapped ResourceWatcher methods will not be called.
func newConcurrentWatcher(
	watcher ResourceWatcher, initialPoolSize uint64, errorHandler func(context.Context, error),
) (*concurrentWatcher, error) {
	if watcher == nil {
		return nil, errors.New("resource watcher cannot be nil")
	}
	if initialPoolSize <= 0 {
		return nil, errors.New("initial worker pool size needs to be greater than 0")
	}

	cw := &concurrentWatcher{
		watcher:      watcher,
		size:         initialPoolSize,
		workers:      make(map[uint64]*bufferedQueue, initialBufferSize),
		errorHandler: DefaultErrorHandler,
	}
	if errorHandler != nil {
		cw.errorHandler = errorHandler
	}

	var i uint64
	for i < initialPoolSize {
		cw.workers[i] = newBufferedQueue(initialBufferSize)
		i++
	}

	return cw, nil
}

func (w *concurrentWatcher) Add(ctx context.Context, object resource.Object) error {
	worker := w.workers[w.hashMod(object)]
	worker.push(eventInfo{
		ctx:    ctx,
		action: ResourceActionCreate,
		target: object,
	})
	return nil
}

func (w *concurrentWatcher) Update(ctx context.Context, src resource.Object, tgt resource.Object) error {
	worker := w.workers[w.hashMod(src)]
	worker.push(eventInfo{
		ctx:    ctx,
		action: ResourceActionUpdate,
		target: tgt,
		source: src,
	})
	return nil
}

func (w *concurrentWatcher) Delete(ctx context.Context, object resource.Object) error {
	worker := w.workers[w.hashMod(object)]
	worker.push(eventInfo{
		ctx:    ctx,
		action: ResourceActionDelete,
		target: object,
	})
	return nil
}

// Run starts a number of workers, processing the events concurrently by triggering the
// methods of underlying watcher as per the event type.
// Run will clean up and exit once the provided context is canceled.
func (w *concurrentWatcher) Run(ctx context.Context) {
	var wg sync.WaitGroup
	for _, queue := range w.workers {
		wg.Add(1)
		go func() {
			defer wg.Done()

			// Start the background process responsible for emitting the events from queue.
			go queue.run()
			defer queue.stop()

			ctx, cancel := context.WithCancel(ctx)
			defer cancel()

			events := queue.events()
			wait.Until(func() {
				for {
					select {
					case <-ctx.Done():
						return

					case next, ok := <-events:
						if !ok {
							cancel()
							return
						}

						event, ok := next.(eventInfo)
						if !ok {
							utilruntime.HandleError(fmt.Errorf("unrecognized notification: %T", next))
						}

						w.handleEvent(ctx, event)
					}
				}
			}, 1*time.Second, ctx.Done())
		}()
	}

	wg.Wait()
}

func (w *concurrentWatcher) handleEvent(ctx context.Context, event eventInfo) {
	var err error
	switch event.action {
	case ResourceActionCreate:
		err = w.watcher.Add(event.ctx, event.target)
	case ResourceActionUpdate:
		err = w.watcher.Update(event.ctx, event.source, event.target)
	case ResourceActionDelete:
		err = w.watcher.Delete(event.ctx, event.target)
	default:
		utilruntime.HandleError(fmt.Errorf("invalid event type: %T", event.action))
	}
	if err != nil && w.errorHandler != nil {
		w.errorHandler(ctx, err)
	}
}

func (w *concurrentWatcher) hashMod(obj resource.Object) uint64 {
	id := obj.GroupVersionKind().String() + "/" + obj.GetNamespace() + "/" + obj.GetName()
	digest := xxhash.Sum64([]byte(id))

	return digest % w.size
}
