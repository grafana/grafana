// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package validate

import "sync"

// Opts specifies validation options for a SpecValidator.
//
// NOTE: other options might be needed, for example a go-swagger specific mode.
type Opts struct {
	ContinueOnErrors bool // true: continue reporting errors, even if spec is invalid

	// StrictPathParamUniqueness enables a strict validation of paths that include
	// path parameters. When true, it will enforce that for each method, the path
	// is unique, regardless of path parameters such that GET:/petstore/{id} and
	// GET:/petstore/{pet} anre considered duplicate paths.
	//
	// Consider disabling if path parameters can include slashes such as
	// GET:/v1/{shelve} and GET:/v1/{book}, where the IDs are "shelve/*" and
	// /"shelve/*/book/*" respectively.
	StrictPathParamUniqueness bool
	SkipSchemataResult        bool
}

var (
	defaultOpts = Opts{
		// default is to stop validation on errors
		ContinueOnErrors: false,

		// StrictPathParamUniqueness is defaulted to true. This maintains existing
		// behavior.
		StrictPathParamUniqueness: true,
	}

	defaultOptsMutex = &sync.Mutex{}
)

// SetContinueOnErrors sets global default behavior regarding spec validation errors reporting.
//
// For extended error reporting, you most likely want to set it to true.
// For faster validation, it's better to give up early when a spec is detected as invalid: set it to false (this is the default).
//
// Setting this mode does NOT affect the validation status.
//
// NOTE: this method affects global defaults. It is not suitable for a concurrent usage.
func SetContinueOnErrors(c bool) {
	defer defaultOptsMutex.Unlock()
	defaultOptsMutex.Lock()
	defaultOpts.ContinueOnErrors = c
}
