// Copyright (c) 2016 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

package hclog

import (
	"bytes"
	"runtime"
	"strconv"
	"strings"
	"sync"
)

var (
	_stacktraceIgnorePrefixes = []string{
		"runtime.goexit",
		"runtime.main",
	}
	_stacktracePool = sync.Pool{
		New: func() interface{} {
			return newProgramCounters(64)
		},
	}
)

// A stacktrace gathered by a previous call to log.Stacktrace. If passed
// to a logging function, the stacktrace will be appended.
type CapturedStacktrace string

// Gather a stacktrace of the current goroutine and return it to be passed
// to a logging function.
func Stacktrace() CapturedStacktrace {
	return CapturedStacktrace(takeStacktrace())
}

func takeStacktrace() string {
	programCounters := _stacktracePool.Get().(*programCounters)
	defer _stacktracePool.Put(programCounters)

	var buffer bytes.Buffer

	for {
		// Skip the call to runtime.Counters and takeStacktrace so that the
		// program counters start at the caller of takeStacktrace.
		n := runtime.Callers(2, programCounters.pcs)
		if n < cap(programCounters.pcs) {
			programCounters.pcs = programCounters.pcs[:n]
			break
		}
		// Don't put the too-short counter slice back into the pool; this lets
		// the pool adjust if we consistently take deep stacktraces.
		programCounters = newProgramCounters(len(programCounters.pcs) * 2)
	}

	i := 0
	frames := runtime.CallersFrames(programCounters.pcs)
	for frame, more := frames.Next(); more; frame, more = frames.Next() {
		if shouldIgnoreStacktraceFunction(frame.Function) {
			continue
		}
		if i != 0 {
			buffer.WriteByte('\n')
		}
		i++
		buffer.WriteString(frame.Function)
		buffer.WriteByte('\n')
		buffer.WriteByte('\t')
		buffer.WriteString(frame.File)
		buffer.WriteByte(':')
		buffer.WriteString(strconv.Itoa(int(frame.Line)))
	}

	return buffer.String()
}

func shouldIgnoreStacktraceFunction(function string) bool {
	for _, prefix := range _stacktraceIgnorePrefixes {
		if strings.HasPrefix(function, prefix) {
			return true
		}
	}
	return false
}

type programCounters struct {
	pcs []uintptr
}

func newProgramCounters(size int) *programCounters {
	return &programCounters{make([]uintptr, size)}
}
