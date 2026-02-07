// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

import (
	"github.com/zclconf/go-cty/cty"
)

type staticExpr struct {
	val cty.Value
	rng Range
}

// StaticExpr returns an Expression that always evaluates to the given value.
//
// This is useful to substitute default values for expressions that are
// not explicitly given in configuration and thus would otherwise have no
// Expression to return.
//
// Since expressions are expected to have a source range, the caller must
// provide one. Ideally this should be a real source range, but it can
// be a synthetic one (with an empty-string filename) if no suitable range
// is available.
func StaticExpr(val cty.Value, rng Range) Expression {
	return staticExpr{val, rng}
}

func (e staticExpr) Value(ctx *EvalContext) (cty.Value, Diagnostics) {
	return e.val, nil
}

func (e staticExpr) Variables() []Traversal {
	return nil
}

func (e staticExpr) Range() Range {
	return e.rng
}

func (e staticExpr) StartRange() Range {
	return e.rng
}
