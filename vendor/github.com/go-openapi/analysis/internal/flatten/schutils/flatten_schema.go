// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

// Package schutils provides tools to save or clone a schema
// when flattening a spec.
package schutils

import (
	"github.com/go-openapi/spec"
	"github.com/go-openapi/swag/jsonutils"
)

const allocLargeMap = 150

// Save registers a schema as an entry in spec #/definitions
func Save(sp *spec.Swagger, name string, schema *spec.Schema) {
	if schema == nil {
		return
	}

	if sp.Definitions == nil {
		sp.Definitions = make(map[string]spec.Schema, allocLargeMap)
	}

	sp.Definitions[name] = *schema
}

// Clone deep-clones a schema
func Clone(schema *spec.Schema) *spec.Schema {
	var sch spec.Schema
	_ = jsonutils.FromDynamicJSON(schema, &sch)

	return &sch
}
