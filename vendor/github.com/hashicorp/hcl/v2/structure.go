// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

import (
	"github.com/zclconf/go-cty/cty"
)

// File is the top-level node that results from parsing a HCL file.
type File struct {
	Body  Body
	Bytes []byte

	// Nav is used to integrate with the "hcled" editor integration package,
	// and with diagnostic information formatters. It is not for direct use
	// by a calling application.
	Nav interface{}
}

// Block represents a nested block within a Body.
type Block struct {
	Type   string
	Labels []string
	Body   Body

	DefRange    Range   // Range that can be considered the "definition" for seeking in an editor
	TypeRange   Range   // Range for the block type declaration specifically.
	LabelRanges []Range // Ranges for the label values specifically.
}

// Blocks is a sequence of Block.
type Blocks []*Block

// Attributes is a set of attributes keyed by their names.
type Attributes map[string]*Attribute

// Body is a container for attributes and blocks. It serves as the primary
// unit of hierarchical structure within configuration.
//
// The content of a body cannot be meaningfully interpreted without a schema,
// so Body represents the raw body content and has methods that allow the
// content to be extracted in terms of a given schema.
type Body interface {
	// Content verifies that the entire body content conforms to the given
	// schema and then returns it, and/or returns diagnostics. The returned
	// body content is valid if non-nil, regardless of whether Diagnostics
	// are provided, but diagnostics should still be eventually shown to
	// the user.
	Content(schema *BodySchema) (*BodyContent, Diagnostics)

	// PartialContent is like Content except that it permits the configuration
	// to contain additional blocks or attributes not specified in the
	// schema. If any are present, the returned Body is non-nil and contains
	// the remaining items from the body that were not selected by the schema.
	PartialContent(schema *BodySchema) (*BodyContent, Body, Diagnostics)

	// JustAttributes attempts to interpret all of the contents of the body
	// as attributes, allowing for the contents to be accessed without a priori
	// knowledge of the structure.
	//
	// The behavior of this method depends on the body's source language.
	// Some languages, like JSON, can't distinguish between attributes and
	// blocks without schema hints, but for languages that _can_ error
	// diagnostics will be generated if any blocks are present in the body.
	//
	// Diagnostics may be produced for other reasons too, such as duplicate
	// declarations of the same attribute.
	JustAttributes() (Attributes, Diagnostics)

	// MissingItemRange returns a range that represents where a missing item
	// might hypothetically be inserted. This is used when producing
	// diagnostics about missing required attributes or blocks. Not all bodies
	// will have an obvious single insertion point, so the result here may
	// be rather arbitrary.
	MissingItemRange() Range
}

// BodyContent is the result of applying a BodySchema to a Body.
type BodyContent struct {
	Attributes Attributes
	Blocks     Blocks

	MissingItemRange Range
}

// Attribute represents an attribute from within a body.
type Attribute struct {
	Name string
	Expr Expression

	Range     Range
	NameRange Range
}

// Expression is a literal value or an expression provided in the
// configuration, which can be evaluated within a scope to produce a value.
type Expression interface {
	// Value returns the value resulting from evaluating the expression
	// in the given evaluation context.
	//
	// The context may be nil, in which case the expression may contain
	// only constants and diagnostics will be produced for any non-constant
	// sub-expressions. (The exact definition of this depends on the source
	// language.)
	//
	// The context may instead be set but have either its Variables or
	// Functions maps set to nil, in which case only use of these features
	// will return diagnostics.
	//
	// Different diagnostics are provided depending on whether the given
	// context maps are nil or empty. In the former case, the message
	// tells the user that variables/functions are not permitted at all,
	// while in the latter case usage will produce a "not found" error for
	// the specific symbol in question.
	Value(ctx *EvalContext) (cty.Value, Diagnostics)

	// Variables returns a list of variables referenced in the receiving
	// expression. These are expressed as absolute Traversals, so may include
	// additional information about how the variable is used, such as
	// attribute lookups, which the calling application can potentially use
	// to only selectively populate the scope.
	Variables() []Traversal

	Range() Range
	StartRange() Range
}

// OfType filters the receiving block sequence by block type name,
// returning a new block sequence including only the blocks of the
// requested type.
func (els Blocks) OfType(typeName string) Blocks {
	ret := make(Blocks, 0)
	for _, el := range els {
		if el.Type == typeName {
			ret = append(ret, el)
		}
	}
	return ret
}

// ByType transforms the receiving block sequence into a map from type
// name to block sequences of only that type.
func (els Blocks) ByType() map[string]Blocks {
	ret := make(map[string]Blocks)
	for _, el := range els {
		ty := el.Type
		if ret[ty] == nil {
			ret[ty] = make(Blocks, 0, 1)
		}
		ret[ty] = append(ret[ty], el)
	}
	return ret
}
