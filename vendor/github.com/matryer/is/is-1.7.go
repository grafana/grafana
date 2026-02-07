// +build go1.7

package is

import (
	"regexp"
	"runtime"
)

// Helper marks the calling function as a test helper function.
// When printing file and line information, that function will be skipped.
//
// Available with Go 1.7 and later.
func (is *I) Helper() {
	is.helpers[callerName(1)] = struct{}{}
}

// callerName gives the function name (qualified with a package path)
// for the caller after skip frames (where 0 means the current function).
func callerName(skip int) string {
	// Make room for the skip PC.
	var pc [1]uintptr
	n := runtime.Callers(skip+2, pc[:]) // skip + runtime.Callers + callerName
	if n == 0 {
		panic("is: zero callers found")
	}
	frames := runtime.CallersFrames(pc[:n])
	frame, _ := frames.Next()
	return frame.Function
}

// The maximum number of stack frames to go through when skipping helper functions for
// the purpose of decorating log messages.
const maxStackLen = 50

var reIsSourceFile = regexp.MustCompile(`is(-1.7)?\.go$`)

func (is *I) callerinfo() (path string, line int, ok bool) {
	var pc [maxStackLen]uintptr
	// Skip two extra frames to account for this function
	// and runtime.Callers itself.
	n := runtime.Callers(2, pc[:])
	if n == 0 {
		panic("is: zero callers found")
	}
	frames := runtime.CallersFrames(pc[:n])
	var firstFrame, frame runtime.Frame
	for more := true; more; {
		frame, more = frames.Next()
		if reIsSourceFile.MatchString(frame.File) {
			continue
		}
		if firstFrame.PC == 0 {
			firstFrame = frame
		}
		if _, ok := is.helpers[frame.Function]; ok {
			// Frame is inside a helper function.
			continue
		}
		return frame.File, frame.Line, true
	}
	// If no "non-helper" frame is found, the first non is frame is returned.
	return firstFrame.File, firstFrame.Line, true
}
