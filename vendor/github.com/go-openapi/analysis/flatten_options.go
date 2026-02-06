// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package analysis

import (
	"log"

	"github.com/go-openapi/spec"
)

// FlattenOpts configuration for flattening a swagger specification.
//
// The BasePath parameter is used to locate remote relative $ref found in the specification.
// This path is a file: it points to the location of the root document and may be either a local
// file path or a URL.
//
// If none specified, relative references (e.g. "$ref": "folder/schema.yaml#/definitions/...")
// found in the spec are searched from the current working directory.
type FlattenOpts struct {
	Spec           *Spec    // The analyzed spec to work with
	flattenContext *context // Internal context to track flattening activity

	BasePath string // The location of the root document for this spec to resolve relative $ref

	// Flattening options
	Expand          bool // When true, skip flattening the spec and expand it instead (if Minimal is false)
	Minimal         bool // When true, do not decompose complex structures such as allOf
	Verbose         bool // enable some reporting on possible name conflicts detected
	RemoveUnused    bool // When true, remove unused parameters, responses and definitions after expansion/flattening
	ContinueOnError bool // Continue when spec expansion issues are found
	KeepNames       bool // Do not attempt to jsonify names from references when flattening

	/* Extra keys */
	_ struct{} // require keys
}

// ExpandOpts creates a spec.ExpandOptions to configure expanding a specification document.
func (f *FlattenOpts) ExpandOpts(skipSchemas bool) *spec.ExpandOptions {
	return &spec.ExpandOptions{
		RelativeBase:    f.BasePath,
		SkipSchemas:     skipSchemas,
		ContinueOnError: f.ContinueOnError,
	}
}

// Swagger gets the swagger specification for this flatten operation
func (f *FlattenOpts) Swagger() *spec.Swagger {
	return f.Spec.spec
}

// croak logs notifications and warnings about valid, but possibly unwanted constructs resulting
// from flattening a spec
func (f *FlattenOpts) croak() {
	if !f.Verbose {
		return
	}

	reported := make(map[string]bool, len(f.flattenContext.newRefs))
	for _, v := range f.Spec.references.allRefs {
		// warns about duplicate handling
		for _, r := range f.flattenContext.newRefs {
			if r.isOAIGen && r.path == v.String() {
				reported[r.newName] = true
			}
		}
	}

	for k := range reported {
		log.Printf("warning: duplicate flattened definition name resolved as %s", k)
	}

	// warns about possible type mismatches
	uniqueMsg := make(map[string]bool)
	for _, msg := range f.flattenContext.warnings {
		if _, ok := uniqueMsg[msg]; ok {
			continue
		}
		log.Printf("warning: %s", msg)
		uniqueMsg[msg] = true
	}
}
