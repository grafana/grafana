package ctxwatch

import (
	"context"
	"sync"
)

// ContextWatcher watches a context and performs an action when the context is canceled. It can watch one context at a
// time.
type ContextWatcher struct {
	handler     Handler
	unwatchChan chan struct{}

	lock              sync.Mutex
	watchInProgress   bool
	onCancelWasCalled bool
}

// NewContextWatcher returns a ContextWatcher. onCancel will be called when a watched context is canceled.
// OnUnwatchAfterCancel will be called when Unwatch is called and the watched context had already been canceled and
// onCancel called.
func NewContextWatcher(handler Handler) *ContextWatcher {
	cw := &ContextWatcher{
		handler:     handler,
		unwatchChan: make(chan struct{}),
	}

	return cw
}

// Watch starts watching ctx. If ctx is canceled then the onCancel function passed to NewContextWatcher will be called.
func (cw *ContextWatcher) Watch(ctx context.Context) {
	cw.lock.Lock()
	defer cw.lock.Unlock()

	if cw.watchInProgress {
		panic("Watch already in progress")
	}

	cw.onCancelWasCalled = false

	if ctx.Done() != nil {
		cw.watchInProgress = true
		go func() {
			select {
			case <-ctx.Done():
				cw.handler.HandleCancel(ctx)
				cw.onCancelWasCalled = true
				<-cw.unwatchChan
			case <-cw.unwatchChan:
			}
		}()
	} else {
		cw.watchInProgress = false
	}
}

// Unwatch stops watching the previously watched context. If the onCancel function passed to NewContextWatcher was
// called then onUnwatchAfterCancel will also be called.
func (cw *ContextWatcher) Unwatch() {
	cw.lock.Lock()
	defer cw.lock.Unlock()

	if cw.watchInProgress {
		cw.unwatchChan <- struct{}{}
		if cw.onCancelWasCalled {
			cw.handler.HandleUnwatchAfterCancel()
		}
		cw.watchInProgress = false
	}
}

type Handler interface {
	// HandleCancel is called when the context that a ContextWatcher is currently watching is canceled. canceledCtx is the
	// context that was canceled.
	HandleCancel(canceledCtx context.Context)

	// HandleUnwatchAfterCancel is called when a ContextWatcher that called HandleCancel on this Handler is unwatched.
	HandleUnwatchAfterCancel()
}
