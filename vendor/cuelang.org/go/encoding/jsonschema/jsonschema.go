// Copyright 2020 CUE Authors
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

// Package jsonschema implements the JSON schema standard.
//
// # Mapping and Linking
//
// JSON Schema are often defined in a single file. CUE, on the other hand
// idiomatically defines schema as a definition.
//
// CUE:
//
//	$schema: which schema is used for validation.
//	$id: which validation does this schema provide.
//
//	Foo: _ @jsonschema(sc)
//	@source(https://...) // What schema is used to validate.
//
// NOTE: JSON Schema is a draft standard and may undergo backwards incompatible
// changes.
package jsonschema

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
)

// Extract converts JSON Schema data into an equivalent CUE representation.
//
// The generated CUE schema is guaranteed to deem valid any value that is
// a valid instance of the source JSON schema.
func Extract(data cue.InstanceOrValue, cfg *Config) (f *ast.File, err error) {
	d := &decoder{cfg: cfg}

	f = d.decode(data.Value())
	if d.errs != nil {
		return nil, d.errs
	}
	return f, nil
}

// A Config configures a JSON Schema encoding or decoding.
type Config struct {
	PkgName string

	// ID sets the URL of the original source, corresponding to the $id field.
	ID string

	// JSON reference of location containing schema. The empty string indicates
	// that there is a single schema at the root.
	//
	// Examples:
	//  "#/"                     top-level fields are schemas.
	//  "#/components/schemas"   the canonical OpenAPI location.
	Root string

	// Map maps the locations of schemas and definitions to a new location.
	// References are updated accordingly. A returned label must be
	// an identifier or string literal.
	//
	// The default mapping is
	//    {}                     {}
	//    {"definitions", foo}   {#foo} or {#, foo}
	//    {"$defs", foo}         {#foo} or {#, foo}
	Map func(pos token.Pos, path []string) ([]ast.Label, error)

	// TODO: configurability to make it compatible with OpenAPI, such as
	// - locations of definitions: #/components/schemas, for instance.
	// - selection and definition of formats
	// - documentation hooks.

	// Strict reports an error for unsupported features, rather than ignoring
	// them.
	Strict bool

	_ struct{} // prohibit casting from different type.
}
