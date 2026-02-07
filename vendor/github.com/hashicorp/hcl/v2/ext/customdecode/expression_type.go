// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package customdecode

import (
	"fmt"
	"reflect"

	"github.com/hashicorp/hcl/v2"
	"github.com/zclconf/go-cty/cty"
)

// ExpressionType is a cty capsule type that carries hcl.Expression values.
//
// This type implements custom decoding in the most general way possible: it
// just captures whatever expression is given to it, with no further processing
// whatsoever. It could therefore be useful in situations where an application
// must defer processing of the expression content until a later step.
//
// ExpressionType only captures the expression, not the evaluation context it
// was destined to be evaluated in. That means this type can be fine for
// situations where the recipient of the value only intends to do static
// analysis, but ExpressionClosureType is more appropriate in situations where
// the recipient will eventually evaluate the given expression.
var ExpressionType cty.Type

// ExpressionVal returns a new cty value of type ExpressionType, wrapping the
// given expression.
func ExpressionVal(expr hcl.Expression) cty.Value {
	return cty.CapsuleVal(ExpressionType, &expr)
}

// ExpressionFromVal returns the expression encapsulated in the given value, or
// panics if the value is not a known value of ExpressionType.
func ExpressionFromVal(v cty.Value) hcl.Expression {
	if !v.Type().Equals(ExpressionType) {
		panic("value is not of ExpressionType")
	}
	ptr := v.EncapsulatedValue().(*hcl.Expression)
	return *ptr
}

// ExpressionClosureType is a cty capsule type that carries hcl.Expression
// values along with their original evaluation contexts.
//
// This is similar to ExpressionType except that during custom decoding it
// also captures the hcl.EvalContext that was provided, allowing callers to
// evaluate the expression later in the same context where it would originally
// have been evaluated, or a context derived from that one.
var ExpressionClosureType cty.Type

// ExpressionClosure is the type encapsulated in ExpressionClosureType
type ExpressionClosure struct {
	Expression  hcl.Expression
	EvalContext *hcl.EvalContext
}

// ExpressionClosureVal returns a new cty value of type ExpressionClosureType,
// wrapping the given expression closure.
func ExpressionClosureVal(closure *ExpressionClosure) cty.Value {
	return cty.CapsuleVal(ExpressionClosureType, closure)
}

// Value evaluates the closure's expression using the closure's EvalContext,
// returning the result.
func (c *ExpressionClosure) Value() (cty.Value, hcl.Diagnostics) {
	return c.Expression.Value(c.EvalContext)
}

// ExpressionClosureFromVal returns the expression closure encapsulated in the
// given value, or panics if the value is not a known value of
// ExpressionClosureType.
//
// The caller MUST NOT modify the returned closure or the EvalContext inside
// it. To derive a new EvalContext, either create a child context or make
// a copy.
func ExpressionClosureFromVal(v cty.Value) *ExpressionClosure {
	if !v.Type().Equals(ExpressionClosureType) {
		panic("value is not of ExpressionClosureType")
	}
	return v.EncapsulatedValue().(*ExpressionClosure)
}

func init() {
	// Getting hold of a reflect.Type for hcl.Expression is a bit tricky because
	// it's an interface type, but we can do it with some indirection.
	goExpressionType := reflect.TypeOf((*hcl.Expression)(nil)).Elem()

	ExpressionType = cty.CapsuleWithOps("expression", goExpressionType, &cty.CapsuleOps{
		ExtensionData: func(key interface{}) interface{} {
			switch key {
			case CustomExpressionDecoder:
				return CustomExpressionDecoderFunc(
					func(expr hcl.Expression, ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
						return ExpressionVal(expr), nil
					},
				)
			default:
				return nil
			}
		},
		TypeGoString: func(_ reflect.Type) string {
			return "customdecode.ExpressionType"
		},
		GoString: func(raw interface{}) string {
			exprPtr := raw.(*hcl.Expression)
			return fmt.Sprintf("customdecode.ExpressionVal(%#v)", *exprPtr)
		},
		RawEquals: func(a, b interface{}) bool {
			aPtr := a.(*hcl.Expression)
			bPtr := b.(*hcl.Expression)
			return reflect.DeepEqual(*aPtr, *bPtr)
		},
	})
	ExpressionClosureType = cty.CapsuleWithOps("expression closure", reflect.TypeOf(ExpressionClosure{}), &cty.CapsuleOps{
		ExtensionData: func(key interface{}) interface{} {
			switch key {
			case CustomExpressionDecoder:
				return CustomExpressionDecoderFunc(
					func(expr hcl.Expression, ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
						return ExpressionClosureVal(&ExpressionClosure{
							Expression:  expr,
							EvalContext: ctx,
						}), nil
					},
				)
			default:
				return nil
			}
		},
		TypeGoString: func(_ reflect.Type) string {
			return "customdecode.ExpressionClosureType"
		},
		GoString: func(raw interface{}) string {
			closure := raw.(*ExpressionClosure)
			return fmt.Sprintf("customdecode.ExpressionClosureVal(%#v)", closure)
		},
		RawEquals: func(a, b interface{}) bool {
			closureA := a.(*ExpressionClosure)
			closureB := b.(*ExpressionClosure)
			// The expression itself compares by deep equality, but EvalContexts
			// conventionally compare by pointer identity, so we'll comply
			// with both conventions here by testing them separately.
			return closureA.EvalContext == closureB.EvalContext &&
				reflect.DeepEqual(closureA.Expression, closureB.Expression)
		},
	})
}
