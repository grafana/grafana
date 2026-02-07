package centrifuge

import (
	"sync"
	"time"

	"github.com/centrifugal/centrifuge/internal/queue"
	"github.com/centrifugal/centrifuge/internal/timers"
)

type writerConfig struct {
	WriteManyFn  func(...queue.Item) error
	WriteFn      func(item queue.Item) error
	MaxQueueSize int
}

// writer helps to manage per-connection message byte queue.
type writer struct {
	mu       sync.Mutex
	config   writerConfig
	messages *queue.Queue
	closed   bool
	closeCh  chan struct{}
}

func newWriter(config writerConfig, queueInitialCap int) *writer {
	if queueInitialCap == 0 {
		queueInitialCap = 2
	}
	w := &writer{
		config:   config,
		messages: queue.New(queueInitialCap),
		closeCh:  make(chan struct{}),
	}
	return w
}

const (
	defaultMaxMessagesInFrame = 16
)

func (w *writer) waitSendMessage(maxMessagesInFrame int, writeDelay time.Duration) bool {
	// Wait for message from the queue.
	if !w.messages.Wait() {
		return false
	}

	if writeDelay > 0 {
		tm := timers.AcquireTimer(writeDelay)
		if writeDelay > 0 {
			select {
			case <-tm.C:
			case <-w.closeCh:
				timers.ReleaseTimer(tm)
				return false
			}
		}
		timers.ReleaseTimer(tm)
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	items, ok := w.messages.RemoveMany(maxMessagesInFrame)
	if !ok {
		return !w.messages.Closed()
	}
	var writeErr error
	if len(items) == 1 {
		writeErr = w.config.WriteFn(items[0])
	} else {
		writeErr = w.config.WriteManyFn(items...)
	}
	if writeErr != nil {
		// Write failed, transport must close itself, here we just return from routine.
		return false
	}
	return true
}

// run supposed to be run in goroutine, this goroutine will be closed as
// soon as queue is closed.
func (w *writer) run(writeDelay time.Duration, maxMessagesInFrame int) {
	if maxMessagesInFrame == 0 {
		maxMessagesInFrame = defaultMaxMessagesInFrame
	}
	for {
		if ok := w.waitSendMessage(maxMessagesInFrame, writeDelay); !ok {
			return
		}
	}
}

func (w *writer) enqueue(item queue.Item) *Disconnect {
	ok := w.messages.Add(item)
	if !ok {
		return &DisconnectConnectionClosed
	}
	if w.config.MaxQueueSize > 0 && w.messages.Size() > w.config.MaxQueueSize {
		return &DisconnectSlow
	}
	return nil
}

func (w *writer) enqueueMany(item ...queue.Item) *Disconnect {
	ok := w.messages.AddMany(item...)
	if !ok {
		return &DisconnectConnectionClosed
	}
	if w.config.MaxQueueSize > 0 && w.messages.Size() > w.config.MaxQueueSize {
		return &DisconnectSlow
	}
	return nil
}

func (w *writer) close(flushRemaining bool) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed {
		return nil
	}
	w.closed = true

	if flushRemaining {
		remaining := w.messages.CloseRemaining()
		if len(remaining) > 0 {
			_ = w.config.WriteManyFn(remaining...)
		}
	} else {
		w.messages.Close()
	}
	close(w.closeCh)
	return nil
}
