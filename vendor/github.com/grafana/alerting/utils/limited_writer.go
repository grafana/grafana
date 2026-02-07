package utils

import (
	"errors"
	"io"
)

var ErrWriteLimitExceeded = errors.New("write limit exceeded")

// LimitedWriter wraps an io.Writer and limits the total bytes written.
type LimitedWriter struct {
	w       io.Writer // underlying writer
	limit   int64     // max bytes allowed
	written int64     // bytes written so far
}

// Write implements io.Writer.
func (lw *LimitedWriter) Write(p []byte) (n int, err error) {
	// If already at limit, reject immediately.
	if lw.written >= lw.limit {
		return 0, ErrWriteLimitExceeded
	}

	// Calculate how much we can write without exceeding the limit.
	remaining := lw.limit - lw.written
	exceeded := false
	if int64(len(p)) > remaining {
		// Only write up to the limit.
		p = p[:remaining]
		exceeded = true
	}

	// Perform the write.
	n, writeErr := lw.w.Write(p)
	lw.written += int64(n)

	// If underlying write failed, return that error.
	if writeErr != nil {
		return n, writeErr
	}

	// If this write filled to the limit, return error to prevent further writes.
	if exceeded {
		return n, ErrWriteLimitExceeded
	}

	return n, nil
}

// NewLimitedWriter creates a new LimitedWriter.
func NewLimitedWriter(w io.Writer, limit int64) io.Writer {
	if limit <= 0 {
		return w
	}
	return &LimitedWriter{w: w, limit: limit}
}
