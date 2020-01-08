// Package jsonassert is a Go test assertion library for verifying that two representations of JSON are semantically equal.
// Create a new `*jsonassert.Asserter` in your test and use this to make assertions against your JSON payloads.
package jsonassert

import (
	"fmt"
)

// Printer is any type that has a testing.T-like Errorf function.
// You probably want to pass in a *testing.T instance here if you are using
// this in your tests.
type Printer interface {
	Errorf(msg string, args ...interface{})
}

// Asserter represents the main type within the jsonassert package.
// See Asserter.Assertf for the main use of this package.
type Asserter struct {
	Printer Printer
}

// New creates a new *jsonassert.Asserter for making assertions against JSON payloads.
// This type can be reused. I.e. if you are using jsonassert as part of your tests,
// you only need one *jsonassert.Asseter per (sub)test.
// In most cases, this will look something like
//
// ja := jsonassert.New(t)
func New(p Printer) *Asserter {
	return &Asserter{Printer: p}
}

// Assertf takes two strings, the first being the 'actual' JSON that you wish to
// make assertions against. The second string is the 'expected' JSON, which
// can be treated as a template for additional format arguments.
// If any discrepancies are found, these will be given to the Errorf function in the printer.
// E.g. for the JSON
//
// {"hello": "world"}
//
// you may use an expected JSON of
//
// {"hello": "%s"}
//
// along with the "world" format argument. For example:
//
// ja.Assertf(`{"hello": "world"}`, `{"hello":"%s"}`, "world")
//
// Additionally, you may wish to make assertions against the *presence* of a
// value, but not against its value. For example:
//
// ja.Assertf(`{"uuid": "94ae1a31-63b2-4a55-a478-47764b60c56b"}`, `{"uuid":"<<PRESENCE>>"}`)
//
// will verify that the UUID field is present, but does not check its actual value.
// You may use "<<PRESENCE>>" against any type of value. The only exception is null, which
// will result in an assertion failure.
func (a *Asserter) Assertf(actualJSON, expectedJSON string, fmtArgs ...interface{}) {
	if t, ok := a.Printer.(tt); ok {
		t.Helper()
	}
	a.pathassertf("$", actualJSON, fmt.Sprintf(expectedJSON, fmtArgs...))
}
