package io

import (
	"io"
	"sync"
)

// NewSafeReadCloser returns a new safeReadCloser that wraps readCloser.
func NewSafeReadCloser(readCloser io.ReadCloser) io.ReadCloser {
	sr := &safeReadCloser{
		readCloser: readCloser,
	}

	if _, ok := readCloser.(io.WriterTo); ok {
		return &safeWriteToReadCloser{safeReadCloser: sr}
	}

	return sr
}

// safeWriteToReadCloser wraps a safeReadCloser but exposes a WriteTo interface implementation. This will panic
// if the underlying io.ReadClose does not support WriteTo. Use NewSafeReadCloser to ensure the proper handling of this
// type.
type safeWriteToReadCloser struct {
	*safeReadCloser
}

// WriteTo implements the io.WriteTo interface.
func (r *safeWriteToReadCloser) WriteTo(w io.Writer) (int64, error) {
	r.safeReadCloser.mtx.Lock()
	defer r.safeReadCloser.mtx.Unlock()

	if r.safeReadCloser.closed {
		return 0, io.EOF
	}

	return r.safeReadCloser.readCloser.(io.WriterTo).WriteTo(w)
}

// safeReadCloser wraps a io.ReadCloser and presents an io.ReadCloser interface. When Close is called on safeReadCloser
// the underlying Close method will be executed, and then the reference to the reader will be dropped. This type
// is meant to be used with the net/http library which will retain a reference to the request body for the lifetime
// of a goroutine connection. Wrapping in this manner will ensure that no data race conditions are falsely reported.
// This type is thread-safe.
type safeReadCloser struct {
	readCloser io.ReadCloser
	closed     bool
	mtx        sync.Mutex
}

// Read reads up to len(p) bytes into p from the underlying read. If the reader is closed io.EOF will be returned.
func (r *safeReadCloser) Read(p []byte) (n int, err error) {
	r.mtx.Lock()
	defer r.mtx.Unlock()
	if r.closed {
		return 0, io.EOF
	}

	return r.readCloser.Read(p)
}

// Close calls the underlying io.ReadCloser's Close method, removes the reference to the reader, and returns any error
// reported from Close. Subsequent calls to Close will always return a nil error.
func (r *safeReadCloser) Close() error {
	r.mtx.Lock()
	defer r.mtx.Unlock()
	if r.closed {
		return nil
	}

	r.closed = true
	rc := r.readCloser
	r.readCloser = nil
	return rc.Close()
}
