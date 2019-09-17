// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.13

package xerrors

import (
	"errors"
	"fmt"
	"strconv"
)

// A Frame contains part of a call stack.
type Frame = errors.Frame

// Caller returns a Frame that describes a frame on the caller's stack.
// The argument skip is the number of frames to skip over.
// Caller(0) returns the frame for the caller of Caller.
var Caller func(skip int) Frame = errors.Caller

// FormatError calls the FormatError method of f with an errors.Printer
// configured according to s and verb, and writes the result to s.
func FormatError(f Formatter, s fmt.State, verb rune) {
	// Assuming this function is only called from the Format method, and given
	// that FormatError takes precedence over Format, it cannot be called from
	// any package that supports errors.Formatter. It is therefore safe to
	// disregard that State may be a specific printer implementation and use one
	// of our choice instead.

	width, okW := s.Width()
	prec, okP := s.Precision()

	// Construct format string from State s.
	format := []byte{'%'}
	if s.Flag('-') {
		format = append(format, '-')
	}
	if s.Flag('+') {
		format = append(format, '+')
	}
	if s.Flag(' ') {
		format = append(format, ' ')
	}
	if okW {
		format = strconv.AppendInt(format, int64(width), 10)
	}
	if okP {
		format = append(format, '.')
		format = strconv.AppendInt(format, int64(prec), 10)
	}
	format = append(format, string(verb)...)
	fmt.Fprintf(s, string(format), f)
}
