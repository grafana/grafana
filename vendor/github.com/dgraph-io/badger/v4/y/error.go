/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package y

// This file contains some functions for error handling. Note that we are moving
// towards using x.Trace, i.e., rpc tracing using net/tracer. But for now, these
// functions are useful for simple checks logged on one machine.
// Some common use cases are:
// (1) You receive an error from external lib, and would like to check/log fatal.
//     For this, use x.Check, x.Checkf. These will check for err != nil, which is
//     more common in Go. If you want to check for boolean being true, use
//		   x.Assert, x.Assertf.
// (2) You receive an error from external lib, and would like to pass on with some
//     stack trace information. In this case, use x.Wrap or x.Wrapf.
// (3) You want to generate a new error with stack trace info. Use x.Errorf.

import (
	"errors"
	"fmt"
	"log"
)

var debugMode = false

// Check logs fatal if err != nil.
func Check(err error) {
	if err != nil {
		log.Fatalf("%+v", Wrap(err, ""))
	}
}

// Check2 acts as convenience wrapper around Check, using the 2nd argument as error.
func Check2(_ interface{}, err error) {
	Check(err)
}

// AssertTrue asserts that b is true. Otherwise, it would log fatal.
func AssertTrue(b bool) {
	if !b {
		log.Fatalf("%+v", errors.New("Assert failed"))
	}
}

// AssertTruef is AssertTrue with extra info.
func AssertTruef(b bool, format string, args ...interface{}) {
	if !b {
		log.Fatalf("%+v", fmt.Errorf(format, args...))
	}
}

// Wrap wraps errors from external lib.
func Wrap(err error, msg string) error {
	if !debugMode {
		if err == nil {
			return nil
		}
		return fmt.Errorf("%s err: %+v", msg, err)
	}
	return fmt.Errorf("%s: %w", msg, err)
}

// Wrapf is Wrap with extra info.
func Wrapf(err error, format string, args ...interface{}) error {
	return Wrap(err, fmt.Sprintf(format, args...))
}

func CombineErrors(one, other error) error {
	if one != nil && other != nil {
		return fmt.Errorf("%v; %v", one, other)
	}
	if one != nil && other == nil {
		return fmt.Errorf("%v", one)
	}
	if one == nil && other != nil {
		return fmt.Errorf("%v", other)
	}
	return nil
}
