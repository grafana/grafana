// Copyright 2023 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package stackdump provides wrappers for runtime.Stack and runtime.Callers
// with uniform support for skipping caller frames.
//
// ⚠ Unlike the functions in the runtime package, these may allocate a
// non-trivial quantity of memory: use them with care. ⚠
package stackdump

import (
	"bytes"
	"runtime"
)

// runtimeStackSelfFrames is 1 if runtime.Stack includes the call to
// runtime.Stack itself or 0 if it does not.
//
// As of 2016-04-27, the gccgo compiler includes runtime.Stack but the gc
// compiler does not.
var runtimeStackSelfFrames = func() int {
	for n := 1 << 10; n < 1<<20; n *= 2 {
		buf := make([]byte, n)
		n := runtime.Stack(buf, false)
		if bytes.Contains(buf[:n], []byte("runtime.Stack")) {
			return 1
		} else if n < len(buf) || bytes.Count(buf, []byte("\n")) >= 3 {
			return 0
		}
	}
	return 0
}()

// Stack is a stack dump for a single goroutine.
type Stack struct {
	// Text is a representation of the stack dump in a human-readable format.
	Text []byte

	// PC is a representation of the stack dump using raw program counter values.
	PC []uintptr
}

func (s Stack) String() string { return string(s.Text) }

// Caller returns the Stack dump for the calling goroutine, starting skipDepth
// frames before the caller of Caller.  (Caller(0) provides a dump starting at
// the caller of this function.)
func Caller(skipDepth int) Stack {
	return Stack{
		Text: CallerText(skipDepth + 1),
		PC:   CallerPC(skipDepth + 1),
	}
}

// CallerText returns a textual dump of the stack starting skipDepth frames before
// the caller.  (CallerText(0) provides a dump starting at the caller of this
// function.)
func CallerText(skipDepth int) []byte {
	for n := 1 << 10; ; n *= 2 {
		buf := make([]byte, n)
		n := runtime.Stack(buf, false)
		if n < len(buf) {
			return pruneFrames(skipDepth+1+runtimeStackSelfFrames, buf[:n])
		}
	}
}

// CallerPC returns a dump of the program counters of the stack starting
// skipDepth frames before the caller.  (CallerPC(0) provides a dump starting at
// the caller of this function.)
func CallerPC(skipDepth int) []uintptr {
	for n := 1 << 8; ; n *= 2 {
		buf := make([]uintptr, n)
		n := runtime.Callers(skipDepth+2, buf)
		if n < len(buf) {
			return buf[:n]
		}
	}
}

// pruneFrames removes the topmost skipDepth frames of the first goroutine in a
// textual stack dump.  It overwrites the passed-in slice.
//
// If there are fewer than skipDepth frames in the first goroutine's stack,
// pruneFrames prunes it to an empty stack and leaves the remaining contents
// intact.
func pruneFrames(skipDepth int, stack []byte) []byte {
	headerLen := 0
	for i, c := range stack {
		if c == '\n' {
			headerLen = i + 1
			break
		}
	}
	if headerLen == 0 {
		return stack // No header line - not a well-formed stack trace.
	}

	skipLen := headerLen
	skipNewlines := skipDepth * 2
	for ; skipLen < len(stack) && skipNewlines > 0; skipLen++ {
		c := stack[skipLen]
		if c != '\n' {
			continue
		}
		skipNewlines--
		skipLen++
		if skipNewlines == 0 || skipLen == len(stack) || stack[skipLen] == '\n' {
			break
		}
	}

	pruned := stack[skipLen-headerLen:]
	copy(pruned, stack[:headerLen])
	return pruned
}
