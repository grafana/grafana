// The MIT License (MIT)

// Copyright (c) 2014 Ben Johnson

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

package testutil

import (
	"reflect"
)

// This package is imported by non-test code and therefore cannot import the
// testing package, which has side effects such as adding flags. Hence we use an
// interface to testing.{T,B}.
type TB interface {
	Helper()
	Fatalf(string, ...interface{})
}

// Assert fails the test if the condition is false.
func Assert(tb TB, condition bool, format string, a ...interface{}) {
	tb.Helper()
	if !condition {
		tb.Fatalf("\033[31m"+format+"\033[39m\n", a...)
	}
}

// Ok fails the test if an err is not nil.
func Ok(tb TB, err error) {
	tb.Helper()
	if err != nil {
		tb.Fatalf("\033[31munexpected error: %v\033[39m\n", err)
	}
}

// NotOk fails the test if an err is nil.
func NotOk(tb TB, err error, format string, a ...interface{}) {
	tb.Helper()
	if err == nil {
		if len(a) != 0 {
			tb.Fatalf("\033[31m"+format+": expected error, got none\033[39m", a...)
		}
		tb.Fatalf("\033[31mexpected error, got none\033[39m")
	}
}

// Equals fails the test if exp is not equal to act.
func Equals(tb TB, exp, act interface{}) {
	tb.Helper()
	if !reflect.DeepEqual(exp, act) {
		tb.Fatalf("\033[31m\nexp: %#v\n\ngot: %#v\033[39m\n", exp, act)
	}
}
