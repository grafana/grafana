// Package bgreader provides a io.Reader that can optionally buffer reads in the background.
package bgreader

import (
	"io"
	"sync"

	"github.com/jackc/pgx/v5/internal/iobufpool"
)

const (
	StatusStopped = iota
	StatusRunning
	StatusStopping
)

// BGReader is an io.Reader that can optionally buffer reads in the background. It is safe for concurrent use.
type BGReader struct {
	r io.Reader

	cond        *sync.Cond
	status      int32
	readResults []readResult
}

type readResult struct {
	buf *[]byte
	err error
}

// Start starts the backgrounder reader. If the background reader is already running this is a no-op. The background
// reader will stop automatically when the underlying reader returns an error.
func (r *BGReader) Start() {
	r.cond.L.Lock()
	defer r.cond.L.Unlock()

	switch r.status {
	case StatusStopped:
		r.status = StatusRunning
		go r.bgRead()
	case StatusRunning:
		// no-op
	case StatusStopping:
		r.status = StatusRunning
	}
}

// Stop tells the background reader to stop after the in progress Read returns. It is safe to call Stop when the
// background reader is not running.
func (r *BGReader) Stop() {
	r.cond.L.Lock()
	defer r.cond.L.Unlock()

	switch r.status {
	case StatusStopped:
		// no-op
	case StatusRunning:
		r.status = StatusStopping
	case StatusStopping:
		// no-op
	}
}

// Status returns the current status of the background reader.
func (r *BGReader) Status() int32 {
	r.cond.L.Lock()
	defer r.cond.L.Unlock()
	return r.status
}

func (r *BGReader) bgRead() {
	keepReading := true
	for keepReading {
		buf := iobufpool.Get(8192)
		n, err := r.r.Read(*buf)
		*buf = (*buf)[:n]

		r.cond.L.Lock()
		r.readResults = append(r.readResults, readResult{buf: buf, err: err})
		if r.status == StatusStopping || err != nil {
			r.status = StatusStopped
			keepReading = false
		}
		r.cond.L.Unlock()
		r.cond.Broadcast()
	}
}

// Read implements the io.Reader interface.
func (r *BGReader) Read(p []byte) (int, error) {
	r.cond.L.Lock()
	defer r.cond.L.Unlock()

	if len(r.readResults) > 0 {
		return r.readFromReadResults(p)
	}

	// There are no unread background read results and the background reader is stopped.
	if r.status == StatusStopped {
		return r.r.Read(p)
	}

	// Wait for results from the background reader
	for len(r.readResults) == 0 {
		r.cond.Wait()
	}
	return r.readFromReadResults(p)
}

// readBackgroundResults reads a result previously read by the background reader. r.cond.L must be held.
func (r *BGReader) readFromReadResults(p []byte) (int, error) {
	buf := r.readResults[0].buf
	var err error

	n := copy(p, *buf)
	if n == len(*buf) {
		err = r.readResults[0].err
		iobufpool.Put(buf)
		if len(r.readResults) == 1 {
			r.readResults = nil
		} else {
			r.readResults = r.readResults[1:]
		}
	} else {
		*buf = (*buf)[n:]
		r.readResults[0].buf = buf
	}

	return n, err
}

func New(r io.Reader) *BGReader {
	return &BGReader{
		r: r,
		cond: &sync.Cond{
			L: &sync.Mutex{},
		},
	}
}
