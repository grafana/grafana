// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

//go:build go1.18
// +build go1.18

package hcl

// This file contains additional diagnostics-related symbols that use the
// Go 1.18 type parameters syntax and would therefore be incompatible with
// Go 1.17 and earlier.

// DiagnosticExtra attempts to retrieve an "extra value" of type T from the
// given diagnostic, if either the diag.Extra field directly contains a value
// of that type or the value implements DiagnosticExtraUnwrapper and directly
// or indirectly returns a value of that type.
//
// Type T should typically be an interface type, so that code which generates
// diagnostics can potentially return different implementations of the same
// interface dynamically as needed.
//
// If a value of type T is found, returns that value and true to indicate
// success. Otherwise, returns the zero value of T and false to indicate
// failure.
func DiagnosticExtra[T any](diag *Diagnostic) (T, bool) {
	extra := diag.Extra
	var zero T

	for {
		if ret, ok := extra.(T); ok {
			return ret, true
		}

		if unwrap, ok := extra.(DiagnosticExtraUnwrapper); ok {
			// If our "extra" implements DiagnosticExtraUnwrapper then we'll
			// unwrap one level and try this again.
			extra = unwrap.UnwrapDiagnosticExtra()
		} else {
			return zero, false
		}
	}
}
