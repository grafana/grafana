package sync

import "sync"

// OnceErr wraps the behavior of recording an error
// once and signal on a channel when this has occurred.
// Signaling is done by closing of the channel.
//
// Type is safe for concurrent usage.
type OnceErr struct {
	mu  sync.RWMutex
	err error
	ch  chan struct{}
}

// NewOnceErr return a new OnceErr
func NewOnceErr() *OnceErr {
	return &OnceErr{
		ch: make(chan struct{}, 1),
	}
}

// Err acquires a read-lock and returns an
// error if one has been set.
func (e *OnceErr) Err() error {
	e.mu.RLock()
	err := e.err
	e.mu.RUnlock()

	return err
}

// SetError acquires a write-lock and will set
// the underlying error value if one has not been set.
func (e *OnceErr) SetError(err error) {
	if err == nil {
		return
	}

	e.mu.Lock()
	if e.err == nil {
		e.err = err
		close(e.ch)
	}
	e.mu.Unlock()
}

// ErrorSet returns a channel that will be used to signal
// that an error has been set. This channel will be closed
// when the error value has been set for OnceErr.
func (e *OnceErr) ErrorSet() <-chan struct{} {
	return e.ch
}
