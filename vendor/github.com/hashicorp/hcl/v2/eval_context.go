// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

import (
	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
)

// An EvalContext provides the variables and functions that should be used
// to evaluate an expression.
type EvalContext struct {
	Variables map[string]cty.Value
	Functions map[string]function.Function
	parent    *EvalContext
}

// NewChild returns a new EvalContext that is a child of the receiver.
func (ctx *EvalContext) NewChild() *EvalContext {
	return &EvalContext{parent: ctx}
}

// Parent returns the parent of the receiver, or nil if the receiver has
// no parent.
func (ctx *EvalContext) Parent() *EvalContext {
	return ctx.parent
}
