// Provenance-includes-location: https://github.com/grafana/loki/blob/7c78d7ea44afb420847255f9f5a4f677ad0f47bf/pkg/util/log/line_buffer.go
// Provenance-includes-location: https://github.com/grafana/mimir/blob/c8b24a462f7e224950409e7e0a4e0a58f3a79599/pkg/util/log/line_buffer.go
// Provenance-includes-copyright: Grafana Labs
package log

import (
	"bytes"
	"io"
	"sync"
	"time"

	"go.uber.org/atomic"
)

// BufferedLogger buffers log lines to be flushed periodically. Without a line buffer, Log() will call the write
// syscall for every log line which is expensive if logging thousands of lines per second.
type BufferedLogger struct {
	buf     *threadsafeBuffer
	entries atomic.Uint32
	cap     uint32
	w       io.Writer

	onFlush func(entries uint32)
}

// Size returns the number of entries in the buffer.
func (l *BufferedLogger) Size() uint32 {
	return l.entries.Load()
}

// Write writes the given bytes to the line buffer, and increments the entries counter.
// If the buffer is full (entries == cap), it will be flushed, and the entries counter reset.
func (l *BufferedLogger) Write(p []byte) (n int, err error) {
	// when we've filled the buffer, flush it
	if l.Size() >= l.cap {
		// Flush resets the size to 0
		if err := l.Flush(); err != nil {
			l.buf.Reset()
			return 0, err
		}
	}

	l.entries.Inc()

	return l.buf.Write(p)
}

// Flush forces the buffer to be written to the underlying writer.
func (l *BufferedLogger) Flush() error {
	// reset the counter
	sz := l.entries.Swap(0)
	if sz <= 0 {
		return nil
	}

	// WriteTo() calls Reset() on the underlying buffer, so it's not needed here
	_, err := l.buf.WriteTo(l.w)

	// only call OnFlush callback if write was successful
	if err == nil && l.onFlush != nil {
		l.onFlush(sz)
	}

	return err
}

type BufferedLoggerOption func(*BufferedLogger)

// WithFlushPeriod creates a new BufferedLoggerOption that sets the flush period for the BufferedLogger.
func WithFlushPeriod(d time.Duration) BufferedLoggerOption {
	return func(l *BufferedLogger) {
		go func() {
			tick := time.NewTicker(d)
			defer tick.Stop()

			for range tick.C {
				l.Flush()
			}
		}()
	}
}

// WithFlushCallback allows for a callback function to be executed when Flush() is called.
// The length of the buffer at the time of the Flush() will be passed to the function.
func WithFlushCallback(fn func(entries uint32)) BufferedLoggerOption {
	return func(l *BufferedLogger) {
		l.onFlush = fn
	}
}

// WithPrellocatedBuffer preallocates a buffer to reduce GC cycles and slice resizing.
func WithPrellocatedBuffer(size uint32) BufferedLoggerOption {
	return func(l *BufferedLogger) {
		l.buf = newThreadsafeBuffer(bytes.NewBuffer(make([]byte, 0, size)))
	}
}

// NewBufferedLogger creates a new BufferedLogger with a configured capacity.
// Lines are flushed when the context is done, the buffer is full, or the flush period is reached.
func NewBufferedLogger(w io.Writer, cap uint32, opts ...BufferedLoggerOption) *BufferedLogger {
	l := &BufferedLogger{
		w:   w,
		buf: newThreadsafeBuffer(bytes.NewBuffer([]byte{})),
		cap: cap,
	}

	for _, opt := range opts {
		opt(l)
	}

	return l
}

// threadsafeBuffer wraps the non-threadsafe bytes.Buffer.
type threadsafeBuffer struct {
	mx  sync.Mutex
	buf *bytes.Buffer
}

// Read reads up to len(p) bytes into p. It returns the number of bytes read (0 <= n <= len(p)) and any error encountered.
func (t *threadsafeBuffer) Read(p []byte) (n int, err error) {
	t.mx.Lock()
	defer t.mx.Unlock()

	return t.buf.Read(p)
}

// Write writes the given bytes to the underlying writer.
func (t *threadsafeBuffer) Write(p []byte) (n int, err error) {
	t.mx.Lock()
	defer t.mx.Unlock()

	return t.buf.Write(p)
}

// WriteTo writes the buffered lines to the given writer.
func (t *threadsafeBuffer) WriteTo(w io.Writer) (n int64, err error) {
	t.mx.Lock()
	defer t.mx.Unlock()

	return t.buf.WriteTo(w)
}

// Reset resets the buffer to be empty,
// but it retains the underlying storage for use by future writes.
// Reset is the same as Truncate(0).
func (t *threadsafeBuffer) Reset() {
	t.mx.Lock()
	defer t.mx.Unlock()

	t.buf.Reset()
}

// newThreadsafeBuffer returns a new threadsafeBuffer wrapping the given bytes.Buffer.
func newThreadsafeBuffer(buf *bytes.Buffer) *threadsafeBuffer {
	return &threadsafeBuffer{
		buf: buf,
	}
}
