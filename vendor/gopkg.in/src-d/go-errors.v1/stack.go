package errors

import (
	"runtime"

	"github.com/pkg/errors"
)

// StackTrace is stack of Frames from innermost (newest) to outermost (oldest).
type StackTrace struct {
	errors.StackTrace
}

// NewStackTrace returns a new StackTrace, skipping the given number of frames,
// to avoid including the caller
func NewStackTrace(skip int) StackTrace {
	const depth = 32

	var pcs [depth]uintptr
	n := runtime.Callers(2+skip, pcs[:])

	f := make(errors.StackTrace, n)
	for i := 0; i < n; i++ {
		f[i] = errors.Frame(pcs[i])
	}

	return StackTrace{f}
}
