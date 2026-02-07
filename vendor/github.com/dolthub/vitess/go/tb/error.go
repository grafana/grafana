/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package tb exposes some handy traceback functionality buried in the runtime.
//
// It can also be used to provide context to errors reducing the temptation to
// panic carelessly, just to get stack information.
//
// The theory is that most errors that are created with the fmt.Errorf
// style are likely to be rare, but require more context to debug
// properly. The additional cost of computing a stack trace is
// therefore negligible.
package tb

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"runtime"
)

var (
	dunno     = []byte("???")
	centerDot = []byte("·")
	dot       = []byte(".")
)

// StackError represents an error along with a stack trace.
type StackError interface {
	Error() string
	StackTrace() string
}

type stackError struct {
	err        error
	stackTrace string
}

func (e stackError) Error() string {
	return fmt.Sprintf("%v\n%v", e.err, e.stackTrace)
}

func (e stackError) StackTrace() string {
	return e.stackTrace
}

func Errorf(msg string, args ...interface{}) error {
	stack := ""
	// See if any arg is already embedding a stack - no need to
	// recompute something expensive and make the message unreadable.
	for _, arg := range args {
		if stackErr, ok := arg.(stackError); ok {
			stack = stackErr.stackTrace
			break
		}
	}

	if stack == "" {
		// magic 5 trims off just enough stack data to be clear
		stack = string(Stack(5))
	}

	return stackError{fmt.Errorf(msg, args...), stack}
}

// Stack is taken from runtime/debug.go
// calldepth is the number of (bottommost) frames to skip.
func Stack(calldepth int) []byte {
	return stack(calldepth)
}

func stack(calldepth int) []byte {
	buf := new(bytes.Buffer) // the returned data
	// As we loop, we open files and read them. These variables record the currently
	// loaded file.
	var lines [][]byte
	var lastFile string
	for i := calldepth; ; i++ { // Caller we care about is the user, 2 frames up
		pc, file, line, ok := runtime.Caller(i)
		if !ok {
			break
		}
		// Print this much at least.  If we can't find the source, it won't show.
		fmt.Fprintf(buf, "%s:%d (0x%x)\n", file, line, pc)
		if file != lastFile {
			data, err := ioutil.ReadFile(file)
			if err != nil {
				continue
			}
			lines = bytes.Split(data, []byte{'\n'})
			lastFile = file
		}
		line-- // in stack trace, lines are 1-indexed but our array is 0-indexed
		fmt.Fprintf(buf, "\t%s: %s\n", function(pc), source(lines, line))
	}
	return buf.Bytes()
}

// source returns a space-trimmed slice of the n'th line.
func source(lines [][]byte, n int) []byte {
	if n < 0 || n >= len(lines) {
		return dunno
	}
	return bytes.Trim(lines[n], " \t")
}

// function returns, if possible, the name of the function containing the PC.
func function(pc uintptr) []byte {
	fn := runtime.FuncForPC(pc)
	if fn == nil {
		return dunno
	}
	name := []byte(fn.Name())
	// The name includes the path name to the package, which is unnecessary
	// since the file name is already included.  Plus, it has center dots.
	// That is, we see
	//	runtime/debug.*T·ptrmethod
	// and want
	//	*T.ptrmethod
	if period := bytes.Index(name, dot); period >= 0 {
		name = name[period+1:]
	}
	name = bytes.Replace(name, centerDot, dot, -1)
	return name
}
