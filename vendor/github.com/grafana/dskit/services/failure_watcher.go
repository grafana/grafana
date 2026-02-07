package services

import (
	"sync"

	"github.com/pkg/errors"
)

var (
	errFailureWatcherNotInitialized = errors.New("FailureWatcher has not been initialized")
	errFailureWatcherClosed         = errors.New("FailureWatcher has been stopped")
)

// FailureWatcher waits for service failures, and passed them to the channel.
type FailureWatcher struct {
	mu                  sync.Mutex
	ch                  chan error
	closed              bool
	unregisterListeners []func()
}

func NewFailureWatcher() *FailureWatcher {
	return &FailureWatcher{ch: make(chan error)}
}

// Chan returns channel for this watcher. If watcher is nil, returns nil channel.
// Errors returned on the channel include failure case and service description.
func (w *FailureWatcher) Chan() <-chan error {
	// Graceful handle the case FailureWatcher has not been initialized,
	// to simplify the code in the components using it.
	if w == nil {
		return nil
	}
	return w.ch
}

func (w *FailureWatcher) WatchService(service Service) {
	// Ensure that if the caller request to watch a service, then the FailureWatcher
	// has been initialized.
	if w == nil {
		panic(errFailureWatcherNotInitialized)
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	if w.closed {
		panic(errFailureWatcherClosed)
	}

	stop := service.AddListener(NewListener(nil, nil, nil, nil, func(_ State, failure error) {
		w.ch <- errors.Wrapf(failure, "service %s failed", DescribeService(service))
	}))
	w.unregisterListeners = append(w.unregisterListeners, stop)
}

func (w *FailureWatcher) WatchManager(manager *Manager) {
	// Ensure that if the caller request to watch services, then the FailureWatcher
	// has been initialized.
	if w == nil {
		panic(errFailureWatcherNotInitialized)
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	if w.closed {
		panic(errFailureWatcherClosed)
	}

	stop := manager.AddListener(NewManagerListener(nil, nil, func(service Service) {
		w.ch <- errors.Wrapf(service.FailureCase(), "service %s failed", DescribeService(service))
	}))
	w.unregisterListeners = append(w.unregisterListeners, stop)
}

// Close stops this failure watcher and closes channel returned by Chan() method. After closing failure watcher,
// it cannot be used to watch additional services or managers.
// Repeated calls to Close() do nothing.
func (w *FailureWatcher) Close() {
	// Graceful handle the case FailureWatcher has not been initialized,
	// to simplify the code in the components using it.
	if w == nil {
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	if w.closed {
		return
	}
	for _, stop := range w.unregisterListeners {
		stop()
	}

	// All listeners are now stopped, and can't receive more notifications. We can close the channel.
	close(w.ch)
	w.closed = true
}
