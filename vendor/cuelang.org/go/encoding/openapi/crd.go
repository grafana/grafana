// Copyright 2019 CUE Authors
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

package openapi

// This file contains functionality for structural schema, a subset of OpenAPI
// used for CRDs.
//
// See https://kubernetes.io/blog/2019/06/20/crd-structural-schema/ for details.
//
// Insofar definitions are compatible, openapi normalizes to structural whenever
// possible.
//
// A core structural schema is only made out of the following fields:
//
// - properties
// - items
// - additionalProperties
// - type
// - nullable
// - title
// - descriptions.
//
// Where the types must be defined for all fields.
//
// In addition, the value validations constraints may be used as defined in
// OpenAPI, with the restriction that
//  - within the logical constraints anyOf, allOf, oneOf, and not
//    additionalProperties, type, nullable, title, and description may not be used.
//  - all mentioned fields must be defined in the core schema.
//
// It appears that CRDs do not allow references.
//

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
)

// newCoreBuilder returns a builder that represents a structural schema.
func newCoreBuilder(c *buildContext) *builder {
	b := newRootBuilder(c)
	b.properties = map[string]*builder{}
	return b
}

func (b *builder) coreSchemaWithName(name cue.Selector) *ast.StructLit {
	oldPath := b.ctx.path
	b.ctx.path = append(b.ctx.path, name)
	s := b.coreSchema()
	b.ctx.path = oldPath
	return s
}

// coreSchema creates the core part of a structural OpenAPI.
func (b *builder) coreSchema() *ast.StructLit {
	switch b.kind {
	case cue.ListKind:
		if b.items != nil {
			b.setType("array", "")
			schema := b.items.coreSchemaWithName(cue.AnyString)
			b.setSingle("items", schema, false)
		}

	case cue.StructKind:
		p := &OrderedMap{}
		for _, k := range b.keys {
			sub := b.properties[k]
			p.Set(k, sub.coreSchemaWithName(cue.Str(k)))
		}
		if p.len() > 0 || b.items != nil {
			b.setType("object", "")
		}
		if p.len() > 0 {
			b.setSingle("properties", (*ast.StructLit)(p), false)
		}
		// TODO: in Structural schema only one of these is allowed.
		if b.items != nil {
			schema := b.items.coreSchemaWithName(cue.AnyString)
			b.setSingle("additionalProperties", schema, false)
		}
	}

	// If there was only a single value associated with this node, we can
	// safely assume there were no disjunctions etc. In structural mode this
	// is the only chance we get to set certain properties.
	if len(b.values) == 1 {
		return b.fillSchema(b.values[0])
	}

	// TODO: do type analysis if we have multiple values and piece out more
	// information that applies to all possible instances.

	return b.finish()
}

// buildCore collects the CUE values for the structural OpenAPI tree.
// To this extent, all fields of both conjunctions and disjunctions are
// collected in a single properties map.
func (b *builder) buildCore(v cue.Value) {
	b.pushNode(v)
	defer b.popNode()

	if !b.ctx.expandRefs {
		_, r := v.Reference()
		if len(r) > 0 {
			return
		}
	}
	b.getDoc(v)
	format := extractFormat(v)
	if format != "" {
		b.format = format
	} else {
		v = v.Eval()
		b.kind = v.IncompleteKind()

		switch b.kind {
		case cue.StructKind:
			if typ, ok := v.Elem(); ok {
				if !b.checkCycle(typ) {
					return
				}
				if b.items == nil {
					b.items = newCoreBuilder(b.ctx)
				}
				b.items.buildCore(typ)
			}
			b.buildCoreStruct(v)

		case cue.ListKind:
			if typ, ok := v.Elem(); ok {
				if !b.checkCycle(typ) {
					return
				}
				if b.items == nil {
					b.items = newCoreBuilder(b.ctx)
				}
				b.items.buildCore(typ)
			}
		}
	}

	for _, bv := range b.values {
		if bv.Equals(v) {
			return
		}
	}
	b.values = append(b.values, v)
}

func (b *builder) buildCoreStruct(v cue.Value) {
	op, args := v.Expr()
	switch op {
	case cue.OrOp, cue.AndOp:
		for _, v := range args {
			b.buildCore(v)
		}
	}
	for i, _ := v.Fields(cue.Optional(true), cue.Hidden(false)); i.Next(); {
		label := i.Label()
		sub, ok := b.properties[label]
		if !ok {
			sub = newCoreBuilder(b.ctx)
			b.properties[label] = sub
			b.keys = append(b.keys, label)
		}
		sub.buildCore(i.Value())
	}
}
