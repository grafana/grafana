// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/ext/customdecode"
	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/convert"
	"github.com/zclconf/go-cty/cty/function"
)

// Expression is the abstract type for nodes that behave as HCL expressions.
type Expression interface {
	Node

	// The hcl.Expression methods are duplicated here, rather than simply
	// embedded, because both Node and hcl.Expression have a Range method
	// and so they conflict.

	Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics)
	Variables() []hcl.Traversal
	StartRange() hcl.Range
}

// Assert that Expression implements hcl.Expression
var _ hcl.Expression = Expression(nil)

// ParenthesesExpr represents an expression written in grouping
// parentheses.
//
// The parser takes care of the precedence effect of the parentheses, so the
// only purpose of this separate expression node is to capture the source range
// of the parentheses themselves, rather than the source range of the
// expression within. All of the other expression operations just pass through
// to the underlying expression.
type ParenthesesExpr struct {
	Expression
	SrcRange hcl.Range
}

var _ hcl.Expression = (*ParenthesesExpr)(nil)

func (e *ParenthesesExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *ParenthesesExpr) walkChildNodes(w internalWalkFunc) {
	// We override the walkChildNodes from the embedded Expression to
	// ensure that both the parentheses _and_ the content are visible
	// in a walk.
	w(e.Expression)
}

// LiteralValueExpr is an expression that just always returns a given value.
type LiteralValueExpr struct {
	Val      cty.Value
	SrcRange hcl.Range
}

func (e *LiteralValueExpr) walkChildNodes(w internalWalkFunc) {
	// Literal values have no child nodes
}

func (e *LiteralValueExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	return e.Val, nil
}

func (e *LiteralValueExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *LiteralValueExpr) StartRange() hcl.Range {
	return e.SrcRange
}

// Implementation for hcl.AbsTraversalForExpr.
func (e *LiteralValueExpr) AsTraversal() hcl.Traversal {
	// This one's a little weird: the contract for AsTraversal is to interpret
	// an expression as if it were traversal syntax, and traversal syntax
	// doesn't have the special keywords "null", "true", and "false" so these
	// are expected to be treated like variables in that case.
	// Since our parser already turned them into LiteralValueExpr by the time
	// we get here, we need to undo this and infer the name that would've
	// originally led to our value.
	// We don't do anything for any other values, since they don't overlap
	// with traversal roots.

	if e.Val.IsNull() {
		// In practice the parser only generates null values of the dynamic
		// pseudo-type for literals, so we can safely assume that any null
		// was orignally the keyword "null".
		return hcl.Traversal{
			hcl.TraverseRoot{
				Name:     "null",
				SrcRange: e.SrcRange,
			},
		}
	}

	switch e.Val {
	case cty.True:
		return hcl.Traversal{
			hcl.TraverseRoot{
				Name:     "true",
				SrcRange: e.SrcRange,
			},
		}
	case cty.False:
		return hcl.Traversal{
			hcl.TraverseRoot{
				Name:     "false",
				SrcRange: e.SrcRange,
			},
		}
	default:
		// No traversal is possible for any other value.
		return nil
	}
}

// ScopeTraversalExpr is an Expression that retrieves a value from the scope
// using a traversal.
type ScopeTraversalExpr struct {
	Traversal hcl.Traversal
	SrcRange  hcl.Range
}

func (e *ScopeTraversalExpr) walkChildNodes(w internalWalkFunc) {
	// Scope traversals have no child nodes
}

func (e *ScopeTraversalExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	val, diags := e.Traversal.TraverseAbs(ctx)
	setDiagEvalContext(diags, e, ctx)
	return val, diags
}

func (e *ScopeTraversalExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *ScopeTraversalExpr) StartRange() hcl.Range {
	return e.SrcRange
}

// Implementation for hcl.AbsTraversalForExpr.
func (e *ScopeTraversalExpr) AsTraversal() hcl.Traversal {
	return e.Traversal
}

// RelativeTraversalExpr is an Expression that retrieves a value from another
// value using a _relative_ traversal.
type RelativeTraversalExpr struct {
	Source    Expression
	Traversal hcl.Traversal
	SrcRange  hcl.Range
}

func (e *RelativeTraversalExpr) walkChildNodes(w internalWalkFunc) {
	w(e.Source)
}

func (e *RelativeTraversalExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	src, diags := e.Source.Value(ctx)
	ret, travDiags := e.Traversal.TraverseRel(src)
	setDiagEvalContext(travDiags, e, ctx)
	diags = append(diags, travDiags...)
	return ret, diags
}

func (e *RelativeTraversalExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *RelativeTraversalExpr) StartRange() hcl.Range {
	return e.SrcRange
}

// Implementation for hcl.AbsTraversalForExpr.
func (e *RelativeTraversalExpr) AsTraversal() hcl.Traversal {
	// We can produce a traversal only if our source can.
	st, diags := hcl.AbsTraversalForExpr(e.Source)
	if diags.HasErrors() {
		return nil
	}

	ret := make(hcl.Traversal, len(st)+len(e.Traversal))
	copy(ret, st)
	copy(ret[len(st):], e.Traversal)
	return ret
}

// FunctionCallExpr is an Expression that calls a function from the EvalContext
// and returns its result.
type FunctionCallExpr struct {
	Name string
	Args []Expression

	// If true, the final argument should be a tuple, list or set which will
	// expand to be one argument per element.
	ExpandFinal bool

	NameRange       hcl.Range
	OpenParenRange  hcl.Range
	CloseParenRange hcl.Range
}

func (e *FunctionCallExpr) walkChildNodes(w internalWalkFunc) {
	for _, arg := range e.Args {
		w(arg)
	}
}

func (e *FunctionCallExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	var diags hcl.Diagnostics

	var f function.Function
	exists := false
	hasNonNilMap := false
	thisCtx := ctx
	for thisCtx != nil {
		if thisCtx.Functions == nil {
			thisCtx = thisCtx.Parent()
			continue
		}
		hasNonNilMap = true
		f, exists = thisCtx.Functions[e.Name]
		if exists {
			break
		}
		thisCtx = thisCtx.Parent()
	}

	if !exists {
		if !hasNonNilMap {
			return cty.DynamicVal, hcl.Diagnostics{
				{
					Severity:    hcl.DiagError,
					Summary:     "Function calls not allowed",
					Detail:      "Functions may not be called here.",
					Subject:     e.Range().Ptr(),
					Expression:  e,
					EvalContext: ctx,
				},
			}
		}

		extraUnknown := &functionCallUnknown{
			name: e.Name,
		}

		// For historical reasons, we represent namespaced function names
		// as strings with :: separating the names. If this was an attempt
		// to call a namespaced function then we'll try to distinguish
		// between an invalid namespace or an invalid name within a valid
		// namespace in order to give the user better feedback about what
		// is wrong.
		//
		// The parser guarantees that a function name will always
		// be a series of valid identifiers separated by "::" with no
		// other content, so we can be relatively unforgiving in our processing
		// here.
		if sepIdx := strings.LastIndex(e.Name, "::"); sepIdx != -1 {
			namespace := e.Name[:sepIdx+2]
			name := e.Name[sepIdx+2:]

			avail := make([]string, 0, len(ctx.Functions))
			for availName := range ctx.Functions {
				if strings.HasPrefix(availName, namespace) {
					avail = append(avail, availName)
				}
			}

			extraUnknown.name = name
			extraUnknown.namespace = namespace

			if len(avail) == 0 {
				// TODO: Maybe use nameSuggestion for the other available
				// namespaces? But that'd require us to go scan the function
				// table again, so we'll wait to see if it's really warranted.
				// For now, we're assuming people are more likely to misremember
				// the function names than the namespaces, because in many
				// applications there will be relatively few namespaces compared
				// to the number of distinct functions.
				return cty.DynamicVal, hcl.Diagnostics{
					{
						Severity:    hcl.DiagError,
						Summary:     "Call to unknown function",
						Detail:      fmt.Sprintf("There are no functions in namespace %q.", namespace),
						Subject:     &e.NameRange,
						Context:     e.Range().Ptr(),
						Expression:  e,
						EvalContext: ctx,
						Extra:       extraUnknown,
					},
				}
			} else {
				suggestion := nameSuggestion(name, avail)
				if suggestion != "" {
					suggestion = fmt.Sprintf(" Did you mean %s%s?", namespace, suggestion)
				}

				return cty.DynamicVal, hcl.Diagnostics{
					{
						Severity:    hcl.DiagError,
						Summary:     "Call to unknown function",
						Detail:      fmt.Sprintf("There is no function named %q in namespace %s.%s", name, namespace, suggestion),
						Subject:     &e.NameRange,
						Context:     e.Range().Ptr(),
						Expression:  e,
						EvalContext: ctx,
						Extra:       extraUnknown,
					},
				}
			}
		}

		avail := make([]string, 0, len(ctx.Functions))
		for name := range ctx.Functions {
			avail = append(avail, name)
		}
		suggestion := nameSuggestion(e.Name, avail)
		if suggestion != "" {
			suggestion = fmt.Sprintf(" Did you mean %q?", suggestion)
		}

		return cty.DynamicVal, hcl.Diagnostics{
			{
				Severity:    hcl.DiagError,
				Summary:     "Call to unknown function",
				Detail:      fmt.Sprintf("There is no function named %q.%s", e.Name, suggestion),
				Subject:     &e.NameRange,
				Context:     e.Range().Ptr(),
				Expression:  e,
				EvalContext: ctx,
				Extra:       extraUnknown,
			},
		}
	}

	diagExtra := functionCallDiagExtra{
		calledFunctionName: e.Name,
	}

	params := f.Params()
	varParam := f.VarParam()

	args := e.Args
	if e.ExpandFinal {
		if len(args) < 1 {
			// should never happen if the parser is behaving
			panic("ExpandFinal set on function call with no arguments")
		}
		expandExpr := args[len(args)-1]
		expandVal, expandDiags := expandExpr.Value(ctx)
		diags = append(diags, expandDiags...)
		if expandDiags.HasErrors() {
			return cty.DynamicVal, diags
		}

		switch {
		case expandVal.Type().Equals(cty.DynamicPseudoType):
			if expandVal.IsNull() {
				diags = append(diags, &hcl.Diagnostic{
					Severity:    hcl.DiagError,
					Summary:     "Invalid expanding argument value",
					Detail:      "The expanding argument (indicated by ...) must not be null.",
					Subject:     expandExpr.Range().Ptr(),
					Context:     e.Range().Ptr(),
					Expression:  expandExpr,
					EvalContext: ctx,
					Extra:       &diagExtra,
				})
				return cty.DynamicVal, diags
			}
			return cty.DynamicVal, diags
		case expandVal.Type().IsTupleType() || expandVal.Type().IsListType() || expandVal.Type().IsSetType():
			if expandVal.IsNull() {
				diags = append(diags, &hcl.Diagnostic{
					Severity:    hcl.DiagError,
					Summary:     "Invalid expanding argument value",
					Detail:      "The expanding argument (indicated by ...) must not be null.",
					Subject:     expandExpr.Range().Ptr(),
					Context:     e.Range().Ptr(),
					Expression:  expandExpr,
					EvalContext: ctx,
					Extra:       &diagExtra,
				})
				return cty.DynamicVal, diags
			}
			if !expandVal.IsKnown() {
				return cty.DynamicVal, diags
			}

			// When expanding arguments from a collection, we must first unmark
			// the collection itself, and apply any marks directly to the
			// elements. This ensures that marks propagate correctly.
			expandVal, marks := expandVal.Unmark()
			newArgs := make([]Expression, 0, (len(args)-1)+expandVal.LengthInt())
			newArgs = append(newArgs, args[:len(args)-1]...)
			it := expandVal.ElementIterator()
			for it.Next() {
				_, val := it.Element()
				newArgs = append(newArgs, &LiteralValueExpr{
					Val:      val.WithMarks(marks),
					SrcRange: expandExpr.Range(),
				})
			}
			args = newArgs
		default:
			diags = append(diags, &hcl.Diagnostic{
				Severity:    hcl.DiagError,
				Summary:     "Invalid expanding argument value",
				Detail:      "The expanding argument (indicated by ...) must be of a tuple, list, or set type.",
				Subject:     expandExpr.Range().Ptr(),
				Context:     e.Range().Ptr(),
				Expression:  expandExpr,
				EvalContext: ctx,
				Extra:       &diagExtra,
			})
			return cty.DynamicVal, diags
		}
	}

	if len(args) < len(params) {
		missing := params[len(args)]
		qual := ""
		if varParam != nil {
			qual = " at least"
		}
		return cty.DynamicVal, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Not enough function arguments",
				Detail: fmt.Sprintf(
					"Function %q expects%s %d argument(s). Missing value for %q.",
					e.Name, qual, len(params), missing.Name,
				),
				Subject:     &e.CloseParenRange,
				Context:     e.Range().Ptr(),
				Expression:  e,
				EvalContext: ctx,
				Extra:       &diagExtra,
			},
		}
	}

	if varParam == nil && len(args) > len(params) {
		return cty.DynamicVal, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Too many function arguments",
				Detail: fmt.Sprintf(
					"Function %q expects only %d argument(s).",
					e.Name, len(params),
				),
				Subject:     args[len(params)].StartRange().Ptr(),
				Context:     e.Range().Ptr(),
				Expression:  e,
				EvalContext: ctx,
				Extra:       &diagExtra,
			},
		}
	}

	argVals := make([]cty.Value, len(args))

	for i, argExpr := range args {
		var param *function.Parameter
		if i < len(params) {
			param = &params[i]
		} else {
			param = varParam
		}

		var val cty.Value
		if decodeFn := customdecode.CustomExpressionDecoderForType(param.Type); decodeFn != nil {
			var argDiags hcl.Diagnostics
			val, argDiags = decodeFn(argExpr, ctx)
			diags = append(diags, argDiags...)
			if val == cty.NilVal {
				val = cty.UnknownVal(param.Type)
			}
		} else {
			var argDiags hcl.Diagnostics
			val, argDiags = argExpr.Value(ctx)
			if len(argDiags) > 0 {
				diags = append(diags, argDiags...)
			}

			// Try to convert our value to the parameter type
			var err error
			val, err = convert.Convert(val, param.Type)
			if err != nil {
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid function argument",
					Detail: fmt.Sprintf(
						"Invalid value for %q parameter: %s.",
						param.Name, err,
					),
					Subject:     argExpr.StartRange().Ptr(),
					Context:     e.Range().Ptr(),
					Expression:  argExpr,
					EvalContext: ctx,
					Extra:       &diagExtra,
				})
			}
		}

		argVals[i] = val
	}

	if diags.HasErrors() {
		// Don't try to execute the function if we already have errors with
		// the arguments, because the result will probably be a confusing
		// error message.
		return cty.DynamicVal, diags
	}

	resultVal, err := f.Call(argVals)
	if err != nil {
		// For errors in the underlying call itself we also return the raw
		// call error via an extra method on our "diagnostic extra" value.
		diagExtra.functionCallError = err

		switch terr := err.(type) {
		case function.ArgError:
			i := terr.Index
			var param *function.Parameter
			if i < len(params) {
				param = &params[i]
			} else {
				param = varParam
			}

			if param == nil || i > len(args)-1 {
				// Getting here means that the function we called has a bug:
				// it returned an arg error that refers to an argument index
				// that wasn't present in the call. For that situation
				// we'll degrade to a less specific error just to give
				// some sort of answer, but best to still fix the buggy
				// function so that it only returns argument indices that
				// are in range.
				switch {
				case param != nil:
					// In this case we'll assume that the function was trying
					// to talk about a final variadic parameter but the caller
					// didn't actually provide any arguments for it. That means
					// we can at least still name the parameter in the
					// error message, but our source range will be the call
					// as a whole because we don't have an argument expression
					// to highlight specifically.
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid function argument",
						Detail: fmt.Sprintf(
							"Invalid value for %q parameter: %s.",
							param.Name, err,
						),
						Subject:     e.Range().Ptr(),
						Expression:  e,
						EvalContext: ctx,
						Extra:       &diagExtra,
					})
				default:
					// This is the most degenerate case of all, where the
					// index is out of range even for the declared parameters,
					// and so we can't tell which parameter the function is
					// trying to report an error for. Just a generic error
					// report in that case.
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Error in function call",
						Detail: fmt.Sprintf(
							"Call to function %q failed: %s.",
							e.Name, err,
						),
						Subject:     e.StartRange().Ptr(),
						Context:     e.Range().Ptr(),
						Expression:  e,
						EvalContext: ctx,
						Extra:       &diagExtra,
					})
				}
			} else {
				argExpr := args[i]

				// TODO: we should also unpick a PathError here and show the
				// path to the deep value where the error was detected.
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid function argument",
					Detail: fmt.Sprintf(
						"Invalid value for %q parameter: %s.",
						param.Name, err,
					),
					Subject:     argExpr.StartRange().Ptr(),
					Context:     e.Range().Ptr(),
					Expression:  argExpr,
					EvalContext: ctx,
					Extra:       &diagExtra,
				})
			}

		default:
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Error in function call",
				Detail: fmt.Sprintf(
					"Call to function %q failed: %s.",
					e.Name, err,
				),
				Subject:     e.StartRange().Ptr(),
				Context:     e.Range().Ptr(),
				Expression:  e,
				EvalContext: ctx,
				Extra:       &diagExtra,
			})
		}

		return cty.DynamicVal, diags
	}

	return resultVal, diags
}

func (e *FunctionCallExpr) Range() hcl.Range {
	return hcl.RangeBetween(e.NameRange, e.CloseParenRange)
}

func (e *FunctionCallExpr) StartRange() hcl.Range {
	return hcl.RangeBetween(e.NameRange, e.OpenParenRange)
}

// Implementation for hcl.ExprCall.
func (e *FunctionCallExpr) ExprCall() *hcl.StaticCall {
	ret := &hcl.StaticCall{
		Name:      e.Name,
		NameRange: e.NameRange,
		Arguments: make([]hcl.Expression, len(e.Args)),
		ArgsRange: hcl.RangeBetween(e.OpenParenRange, e.CloseParenRange),
	}
	// Need to convert our own Expression objects into hcl.Expression.
	for i, arg := range e.Args {
		ret.Arguments[i] = arg
	}
	return ret
}

// FunctionCallDiagExtra is an interface implemented by the value in the "Extra"
// field of some diagnostics returned by FunctionCallExpr.Value, giving
// cooperating callers access to some machine-readable information about the
// call that a diagnostic relates to.
type FunctionCallDiagExtra interface {
	// CalledFunctionName returns the name of the function being called at
	// the time the diagnostic was generated, if any. Returns an empty string
	// if there is no known called function.
	CalledFunctionName() string

	// FunctionCallError returns the error value returned by the implementation
	// of the function being called, if any. Returns nil if the diagnostic was
	// not returned in response to a call error.
	//
	// Some errors related to calling functions are generated by HCL itself
	// rather than by the underlying function, in which case this method
	// will return nil.
	FunctionCallError() error
}

type functionCallDiagExtra struct {
	calledFunctionName string
	functionCallError  error
}

func (e *functionCallDiagExtra) CalledFunctionName() string {
	return e.calledFunctionName
}

func (e *functionCallDiagExtra) FunctionCallError() error {
	return e.functionCallError
}

// FunctionCallUnknownDiagExtra is an interface implemented by a value in the Extra
// field of some diagnostics to indicate when the error was caused by a call to
// an unknown function.
type FunctionCallUnknownDiagExtra interface {
	CalledFunctionName() string
	CalledFunctionNamespace() string
}

type functionCallUnknown struct {
	name      string
	namespace string
}

func (e *functionCallUnknown) CalledFunctionName() string {
	return e.name
}

func (e *functionCallUnknown) CalledFunctionNamespace() string {
	return e.namespace
}

type ConditionalExpr struct {
	Condition   Expression
	TrueResult  Expression
	FalseResult Expression

	SrcRange hcl.Range
}

func (e *ConditionalExpr) walkChildNodes(w internalWalkFunc) {
	w(e.Condition)
	w(e.TrueResult)
	w(e.FalseResult)
}

func (e *ConditionalExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	trueResult, trueDiags := e.TrueResult.Value(ctx)
	falseResult, falseDiags := e.FalseResult.Value(ctx)
	var diags hcl.Diagnostics

	resultType := cty.DynamicPseudoType
	convs := make([]convert.Conversion, 2)

	switch {
	// If either case is a dynamic null value (which would result from a
	// literal null in the config), we know that it can convert to the expected
	// type of the opposite case, and we don't need to speculatively reduce the
	// final result type to DynamicPseudoType.

	// If we know that either Type is a DynamicPseudoType, we can be certain
	// that the other value can convert since it's a pass-through, and we don't
	// need to unify the types. If the final evaluation results in the dynamic
	// value being returned, there's no conversion we can do, so we return the
	// value directly.
	case trueResult.RawEquals(cty.NullVal(cty.DynamicPseudoType)):
		resultType = falseResult.Type()
		convs[0] = convert.GetConversionUnsafe(cty.DynamicPseudoType, resultType)
	case falseResult.RawEquals(cty.NullVal(cty.DynamicPseudoType)):
		resultType = trueResult.Type()
		convs[1] = convert.GetConversionUnsafe(cty.DynamicPseudoType, resultType)
	case trueResult.Type() == cty.DynamicPseudoType, falseResult.Type() == cty.DynamicPseudoType:
		// the final resultType type is still unknown
		// we don't need to get the conversion, because both are a noop.

	default:
		// Try to find a type that both results can be converted to.
		resultType, convs = convert.UnifyUnsafe([]cty.Type{trueResult.Type(), falseResult.Type()})
	}

	if resultType == cty.NilType {
		return cty.DynamicVal, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Inconsistent conditional result types",
				Detail: fmt.Sprintf(
					"The true and false result expressions must have consistent types. %s.",
					describeConditionalTypeMismatch(trueResult.Type(), falseResult.Type()),
				),
				Subject:     hcl.RangeBetween(e.TrueResult.Range(), e.FalseResult.Range()).Ptr(),
				Context:     &e.SrcRange,
				Expression:  e,
				EvalContext: ctx,
			},
		}
	}

	condResult, condDiags := e.Condition.Value(ctx)
	diags = append(diags, condDiags...)
	if condResult.IsNull() {
		diags = append(diags, &hcl.Diagnostic{
			Severity:    hcl.DiagError,
			Summary:     "Null condition",
			Detail:      "The condition value is null. Conditions must either be true or false.",
			Subject:     e.Condition.Range().Ptr(),
			Context:     &e.SrcRange,
			Expression:  e.Condition,
			EvalContext: ctx,
		})
		return cty.UnknownVal(resultType), diags
	}

	// Now that we have all three values, collect all the marks for the result.
	// Since it's possible that a condition value could be unknown, and the
	// consumer needs to deal with any marks from either branch anyway, we must
	// always combine them for consistent results.
	condResult, condResultMarks := condResult.Unmark()
	trueResult, trueResultMarks := trueResult.Unmark()
	falseResult, falseResultMarks := falseResult.Unmark()
	var resMarks []cty.ValueMarks
	resMarks = append(resMarks, condResultMarks, trueResultMarks, falseResultMarks)

	if !condResult.IsKnown() {
		trueRange := trueResult.Range()
		falseRange := falseResult.Range()

		// if both branches are known to be null, then the result must still be null
		if trueResult.IsNull() && falseResult.IsNull() {
			return cty.NullVal(resultType).WithMarks(resMarks...), diags
		}

		// We might be able to offer a refined range for the result based on
		// the two possible outcomes.
		if trueResult.Type() == cty.Number && falseResult.Type() == cty.Number {
			ref := cty.UnknownVal(cty.Number).Refine()
			if trueRange.DefinitelyNotNull() && falseRange.DefinitelyNotNull() {
				ref = ref.NotNull()
			}

			falseLo, falseLoInc := falseRange.NumberLowerBound()
			falseHi, falseHiInc := falseRange.NumberUpperBound()
			trueLo, trueLoInc := trueRange.NumberLowerBound()
			trueHi, trueHiInc := trueRange.NumberUpperBound()

			if falseLo.IsKnown() && trueLo.IsKnown() {
				lo, loInc := falseLo, falseLoInc
				switch {
				case trueLo.LessThan(falseLo).True():
					lo, loInc = trueLo, trueLoInc
				case trueLo.Equals(falseLo).True():
					loInc = trueLoInc || falseLoInc
				}

				ref = ref.NumberRangeLowerBound(lo, loInc)
			}

			if falseHi.IsKnown() && trueHi.IsKnown() {
				hi, hiInc := falseHi, falseHiInc
				switch {
				case trueHi.GreaterThan(falseHi).True():
					hi, hiInc = trueHi, trueHiInc
				case trueHi.Equals(falseHi).True():
					hiInc = trueHiInc || falseHiInc
				}
				ref = ref.NumberRangeUpperBound(hi, hiInc)
			}

			return ref.NewValue().WithMarks(resMarks...), diags
		}

		if trueResult.Type().IsCollectionType() && falseResult.Type().IsCollectionType() {
			if trueResult.Type().Equals(falseResult.Type()) {
				ref := cty.UnknownVal(resultType).Refine()
				if trueRange.DefinitelyNotNull() && falseRange.DefinitelyNotNull() {
					ref = ref.NotNull()
				}

				falseLo := falseRange.LengthLowerBound()
				falseHi := falseRange.LengthUpperBound()
				trueLo := trueRange.LengthLowerBound()
				trueHi := trueRange.LengthUpperBound()

				lo := falseLo
				if trueLo < falseLo {
					lo = trueLo
				}

				hi := falseHi
				if trueHi > falseHi {
					hi = trueHi
				}

				ref = ref.CollectionLengthLowerBound(lo).CollectionLengthUpperBound(hi)
				return ref.NewValue().WithMarks(resMarks...), diags
			}
		}

		ret := cty.UnknownVal(resultType)
		if trueRange.DefinitelyNotNull() && falseRange.DefinitelyNotNull() {
			ret = ret.RefineNotNull()
		}
		return ret.WithMarks(resMarks...), diags
	}

	condResult, err := convert.Convert(condResult, cty.Bool)
	if err != nil {
		diags = append(diags, &hcl.Diagnostic{
			Severity:    hcl.DiagError,
			Summary:     "Incorrect condition type",
			Detail:      "The condition expression must be of type bool.",
			Subject:     e.Condition.Range().Ptr(),
			Context:     &e.SrcRange,
			Expression:  e.Condition,
			EvalContext: ctx,
		})
		return cty.UnknownVal(resultType), diags
	}

	if condResult.True() {
		diags = append(diags, trueDiags...)
		if convs[0] != nil {
			var err error
			trueResult, err = convs[0](trueResult)
			if err != nil {
				// Unsafe conversion failed with the concrete result value
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Inconsistent conditional result types",
					Detail: fmt.Sprintf(
						"The true result value has the wrong type: %s.",
						err.Error(),
					),
					Subject:     e.TrueResult.Range().Ptr(),
					Context:     &e.SrcRange,
					Expression:  e.TrueResult,
					EvalContext: ctx,
				})
				trueResult = cty.UnknownVal(resultType)
			}
		}
		return trueResult.WithMarks(resMarks...), diags
	} else {
		diags = append(diags, falseDiags...)
		if convs[1] != nil {
			var err error
			falseResult, err = convs[1](falseResult)
			if err != nil {
				// Unsafe conversion failed with the concrete result value
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Inconsistent conditional result types",
					Detail: fmt.Sprintf(
						"The false result value has the wrong type: %s.",
						err.Error(),
					),
					Subject:     e.FalseResult.Range().Ptr(),
					Context:     &e.SrcRange,
					Expression:  e.FalseResult,
					EvalContext: ctx,
				})
				falseResult = cty.UnknownVal(resultType)
			}
		}
		return falseResult.WithMarks(resMarks...), diags
	}
}

// describeConditionalTypeMismatch makes a best effort to describe the
// difference between types in the true and false arms of a conditional
// expression in a way that would be useful to someone trying to understand
// why their conditional expression isn't valid.
//
// NOTE: This function is only designed to deal with situations
// where trueTy and falseTy are different. Calling it with two equal
// types will produce a nonsense result. This function also only really
// deals with situations that type unification can't resolve, so we should
// call this function only after trying type unification first.
func describeConditionalTypeMismatch(trueTy, falseTy cty.Type) string {
	// The main tricky cases here are when both trueTy and falseTy are
	// of the same structural type kind, such as both being object types
	// or both being tuple types. In that case the "FriendlyName" method
	// returns only "object" or "tuple" and so we need to do some more
	// work to describe what's different inside them.

	switch {
	case trueTy.IsObjectType() && falseTy.IsObjectType():
		// We'll first gather up the attribute names and sort them. In the
		// event that there are multiple attributes that disagree across
		// the two types, we'll prefer to report the one that sorts lexically
		// least just so that our error message is consistent between
		// evaluations.
		var trueAttrs, falseAttrs []string
		for name := range trueTy.AttributeTypes() {
			trueAttrs = append(trueAttrs, name)
		}
		sort.Strings(trueAttrs)
		for name := range falseTy.AttributeTypes() {
			falseAttrs = append(falseAttrs, name)
		}
		sort.Strings(falseAttrs)

		for _, name := range trueAttrs {
			if !falseTy.HasAttribute(name) {
				return fmt.Sprintf("The 'true' value includes object attribute %q, which is absent in the 'false' value", name)
			}
			trueAty := trueTy.AttributeType(name)
			falseAty := falseTy.AttributeType(name)
			if !trueAty.Equals(falseAty) {
				// For deeply-nested differences this will likely get very
				// clunky quickly by nesting these messages inside one another,
				// but we'll accept that for now in the interests of producing
				// _some_ useful feedback, even if it isn't as concise as
				// we'd prefer it to be. Deeply-nested structures in
				// conditionals are thankfully not super common.
				return fmt.Sprintf(
					"Type mismatch for object attribute %q: %s",
					name, describeConditionalTypeMismatch(trueAty, falseAty),
				)
			}
		}
		for _, name := range falseAttrs {
			if !trueTy.HasAttribute(name) {
				return fmt.Sprintf("The 'false' value includes object attribute %q, which is absent in the 'true' value", name)
			}
			// NOTE: We don't need to check the attribute types again, because
			// any attribute that both types have in common would already have
			// been checked in the previous loop.
		}
	case trueTy.IsTupleType() && falseTy.IsTupleType():
		trueEtys := trueTy.TupleElementTypes()
		falseEtys := falseTy.TupleElementTypes()

		if trueCount, falseCount := len(trueEtys), len(falseEtys); trueCount != falseCount {
			return fmt.Sprintf("The 'true' tuple has length %d, but the 'false' tuple has length %d", trueCount, falseCount)
		}

		// NOTE: Thanks to the condition above, we know that both tuples are
		// of the same length and so they must have some differing types
		// instead.
		for i := range trueEtys {
			trueEty := trueEtys[i]
			falseEty := falseEtys[i]

			if !trueEty.Equals(falseEty) {
				// For deeply-nested differences this will likely get very
				// clunky quickly by nesting these messages inside one another,
				// but we'll accept that for now in the interests of producing
				// _some_ useful feedback, even if it isn't as concise as
				// we'd prefer it to be. Deeply-nested structures in
				// conditionals are thankfully not super common.
				return fmt.Sprintf(
					"Type mismatch for tuple element %d: %s",
					i, describeConditionalTypeMismatch(trueEty, falseEty),
				)
			}
		}
	case trueTy.IsCollectionType() && falseTy.IsCollectionType():
		// For this case we're specifically interested in the situation where:
		// - both collections are of the same kind, AND
		// - the element types of both are either object or tuple types.
		// This is just to avoid writing a useless statement like
		// "The 'true' value is list of object, but the 'false' value is list of object".
		// This still doesn't account for more awkward cases like collections
		// of collections of structural types, but we won't let perfect be
		// the enemy of the good.
		trueEty := trueTy.ElementType()
		falseEty := falseTy.ElementType()
		if (trueTy.IsListType() && falseTy.IsListType()) || (trueTy.IsMapType() && falseTy.IsMapType()) || (trueTy.IsSetType() && falseTy.IsSetType()) {
			if (trueEty.IsObjectType() && falseEty.IsObjectType()) || (trueEty.IsTupleType() && falseEty.IsTupleType()) {
				noun := "collection"
				switch { // NOTE: We now know that trueTy and falseTy have the same collection kind
				case trueTy.IsListType():
					noun = "list"
				case trueTy.IsSetType():
					noun = "set"
				case trueTy.IsMapType():
					noun = "map"
				}
				return fmt.Sprintf(
					"Mismatched %s element types: %s",
					noun, describeConditionalTypeMismatch(trueEty, falseEty),
				)
			}
		}
	}

	// If we don't manage any more specialized message, we'll just report
	// what the two types are.
	trueName := trueTy.FriendlyName()
	falseName := falseTy.FriendlyName()
	if trueName == falseName {
		// Absolute last resort for when we have no special rule above but
		// we have two types with the same friendly name anyway. This is
		// the most vague of all possible messages but is reserved for
		// particularly awkward cases, like lists of lists of differing tuple
		// types.
		return "At least one deeply-nested attribute or element is not compatible across both the 'true' and the 'false' value"
	}
	return fmt.Sprintf(
		"The 'true' value is %s, but the 'false' value is %s",
		trueTy.FriendlyName(), falseTy.FriendlyName(),
	)

}

func (e *ConditionalExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *ConditionalExpr) StartRange() hcl.Range {
	return e.Condition.StartRange()
}

type IndexExpr struct {
	Collection Expression
	Key        Expression

	SrcRange     hcl.Range
	OpenRange    hcl.Range
	BracketRange hcl.Range
}

func (e *IndexExpr) walkChildNodes(w internalWalkFunc) {
	w(e.Collection)
	w(e.Key)
}

func (e *IndexExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	var diags hcl.Diagnostics
	coll, collDiags := e.Collection.Value(ctx)
	key, keyDiags := e.Key.Value(ctx)
	diags = append(diags, collDiags...)
	diags = append(diags, keyDiags...)

	val, indexDiags := hcl.Index(coll, key, &e.BracketRange)
	setDiagEvalContext(indexDiags, e, ctx)
	diags = append(diags, indexDiags...)
	return val, diags
}

func (e *IndexExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *IndexExpr) StartRange() hcl.Range {
	return e.OpenRange
}

type TupleConsExpr struct {
	Exprs []Expression

	SrcRange  hcl.Range
	OpenRange hcl.Range
}

func (e *TupleConsExpr) walkChildNodes(w internalWalkFunc) {
	for _, expr := range e.Exprs {
		w(expr)
	}
}

func (e *TupleConsExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	var vals []cty.Value
	var diags hcl.Diagnostics

	vals = make([]cty.Value, len(e.Exprs))
	for i, expr := range e.Exprs {
		val, valDiags := expr.Value(ctx)
		vals[i] = val
		diags = append(diags, valDiags...)
	}

	return cty.TupleVal(vals), diags
}

func (e *TupleConsExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *TupleConsExpr) StartRange() hcl.Range {
	return e.OpenRange
}

// Implementation for hcl.ExprList
func (e *TupleConsExpr) ExprList() []hcl.Expression {
	ret := make([]hcl.Expression, len(e.Exprs))
	for i, expr := range e.Exprs {
		ret[i] = expr
	}
	return ret
}

type ObjectConsExpr struct {
	Items []ObjectConsItem

	SrcRange  hcl.Range
	OpenRange hcl.Range
}

type ObjectConsItem struct {
	KeyExpr   Expression
	ValueExpr Expression
}

func (e *ObjectConsExpr) walkChildNodes(w internalWalkFunc) {
	for _, item := range e.Items {
		w(item.KeyExpr)
		w(item.ValueExpr)
	}
}

func (e *ObjectConsExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	var vals map[string]cty.Value
	var diags hcl.Diagnostics
	var marks []cty.ValueMarks

	// This will get set to true if we fail to produce any of our keys,
	// either because they are actually unknown or if the evaluation produces
	// errors. In all of these case we must return DynamicPseudoType because
	// we're unable to know the full set of keys our object has, and thus
	// we can't produce a complete value of the intended type.
	//
	// We still evaluate all of the item keys and values to make sure that we
	// get as complete as possible a set of diagnostics.
	known := true

	vals = make(map[string]cty.Value, len(e.Items))
	for _, item := range e.Items {
		key, keyDiags := item.KeyExpr.Value(ctx)
		diags = append(diags, keyDiags...)

		val, valDiags := item.ValueExpr.Value(ctx)
		diags = append(diags, valDiags...)

		if keyDiags.HasErrors() {
			known = false
			continue
		}

		if key.IsNull() {
			diags = append(diags, &hcl.Diagnostic{
				Severity:    hcl.DiagError,
				Summary:     "Null value as key",
				Detail:      "Can't use a null value as a key.",
				Subject:     item.ValueExpr.Range().Ptr(),
				Expression:  item.KeyExpr,
				EvalContext: ctx,
			})
			known = false
			continue
		}

		key, keyMarks := key.Unmark()
		marks = append(marks, keyMarks)

		var err error
		key, err = convert.Convert(key, cty.String)
		if err != nil {
			diags = append(diags, &hcl.Diagnostic{
				Severity:    hcl.DiagError,
				Summary:     "Incorrect key type",
				Detail:      fmt.Sprintf("Can't use this value as a key: %s.", err.Error()),
				Subject:     item.KeyExpr.Range().Ptr(),
				Expression:  item.KeyExpr,
				EvalContext: ctx,
			})
			known = false
			continue
		}

		if !key.IsKnown() {
			known = false
			continue
		}

		keyStr := key.AsString()

		vals[keyStr] = val
	}

	if !known {
		return cty.DynamicVal, diags
	}

	return cty.ObjectVal(vals).WithMarks(marks...), diags
}

func (e *ObjectConsExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *ObjectConsExpr) StartRange() hcl.Range {
	return e.OpenRange
}

// Implementation for hcl.ExprMap
func (e *ObjectConsExpr) ExprMap() []hcl.KeyValuePair {
	ret := make([]hcl.KeyValuePair, len(e.Items))
	for i, item := range e.Items {
		ret[i] = hcl.KeyValuePair{
			Key:   item.KeyExpr,
			Value: item.ValueExpr,
		}
	}
	return ret
}

// ObjectConsKeyExpr is a special wrapper used only for ObjectConsExpr keys,
// which deals with the special case that a naked identifier in that position
// must be interpreted as a literal string rather than evaluated directly.
type ObjectConsKeyExpr struct {
	Wrapped         Expression
	ForceNonLiteral bool
}

func (e *ObjectConsKeyExpr) literalName() string {
	// This is our logic for deciding whether to behave like a literal string.
	// We lean on our AbsTraversalForExpr implementation here, which already
	// deals with some awkward cases like the expression being the result
	// of the keywords "null", "true" and "false" which we'd want to interpret
	// as keys here too.
	return hcl.ExprAsKeyword(e.Wrapped)
}

func (e *ObjectConsKeyExpr) walkChildNodes(w internalWalkFunc) {
	// We only treat our wrapped expression as a real expression if we're
	// not going to interpret it as a literal.
	if e.literalName() == "" {
		w(e.Wrapped)
	}
}

func (e *ObjectConsKeyExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	// Because we accept a naked identifier as a literal key rather than a
	// reference, it's confusing to accept a traversal containing periods
	// here since we can't tell if the user intends to create a key with
	// periods or actually reference something. To avoid confusing downstream
	// errors we'll just prohibit a naked multi-step traversal here and
	// require the user to state their intent more clearly.
	// (This is handled at evaluation time rather than parse time because
	// an application using static analysis _can_ accept a naked multi-step
	// traversal here, if desired.)
	if !e.ForceNonLiteral {
		if travExpr, isTraversal := e.Wrapped.(*ScopeTraversalExpr); isTraversal && len(travExpr.Traversal) > 1 {
			var diags hcl.Diagnostics
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Ambiguous attribute key",
				Detail:   "If this expression is intended to be a reference, wrap it in parentheses. If it's instead intended as a literal name containing periods, wrap it in quotes to create a string literal.",
				Subject:  e.Range().Ptr(),
			})
			return cty.DynamicVal, diags
		}

		if ln := e.literalName(); ln != "" {
			return cty.StringVal(ln), nil
		}
	}
	return e.Wrapped.Value(ctx)
}

func (e *ObjectConsKeyExpr) Range() hcl.Range {
	return e.Wrapped.Range()
}

func (e *ObjectConsKeyExpr) StartRange() hcl.Range {
	return e.Wrapped.StartRange()
}

// Implementation for hcl.AbsTraversalForExpr.
func (e *ObjectConsKeyExpr) AsTraversal() hcl.Traversal {
	// If we're forcing a non-literal then we can never be interpreted
	// as a traversal.
	if e.ForceNonLiteral {
		return nil
	}

	// We can produce a traversal only if our wrappee can.
	st, diags := hcl.AbsTraversalForExpr(e.Wrapped)
	if diags.HasErrors() {
		return nil
	}

	return st
}

func (e *ObjectConsKeyExpr) UnwrapExpression() Expression {
	return e.Wrapped
}

// ForExpr represents iteration constructs:
//
//	tuple = [for i, v in list: upper(v) if i > 2]
//	object = {for k, v in map: k => upper(v)}
//	object_of_tuples = {for v in list: v.key: v...}
type ForExpr struct {
	KeyVar string // empty if ignoring the key
	ValVar string

	CollExpr Expression

	KeyExpr  Expression // nil when producing a tuple
	ValExpr  Expression
	CondExpr Expression // null if no "if" clause is present

	Group bool // set if the ellipsis is used on the value in an object for

	SrcRange   hcl.Range
	OpenRange  hcl.Range
	CloseRange hcl.Range
}

func (e *ForExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	var diags hcl.Diagnostics
	var marks []cty.ValueMarks

	collVal, collDiags := e.CollExpr.Value(ctx)
	diags = append(diags, collDiags...)

	if collVal.IsNull() {
		diags = append(diags, &hcl.Diagnostic{
			Severity:    hcl.DiagError,
			Summary:     "Iteration over null value",
			Detail:      "A null value cannot be used as the collection in a 'for' expression.",
			Subject:     e.CollExpr.Range().Ptr(),
			Context:     &e.SrcRange,
			Expression:  e.CollExpr,
			EvalContext: ctx,
		})
		return cty.DynamicVal, diags
	}
	if collVal.Type() == cty.DynamicPseudoType {
		return cty.DynamicVal, diags
	}
	// Unmark collection before checking for iterability, because marked
	// values cannot be iterated
	collVal, collMarks := collVal.Unmark()
	marks = append(marks, collMarks)
	if !collVal.CanIterateElements() {
		diags = append(diags, &hcl.Diagnostic{
			Severity: hcl.DiagError,
			Summary:  "Iteration over non-iterable value",
			Detail: fmt.Sprintf(
				"A value of type %s cannot be used as the collection in a 'for' expression.",
				collVal.Type().FriendlyName(),
			),
			Subject:     e.CollExpr.Range().Ptr(),
			Context:     &e.SrcRange,
			Expression:  e.CollExpr,
			EvalContext: ctx,
		})
		return cty.DynamicVal, diags
	}

	// Grab the CondExpr marks when we're returning early with an unknown
	var condMarks cty.ValueMarks

	// Before we start we'll do an early check to see if any CondExpr we've
	// been given is of the wrong type. This isn't 100% reliable (it may
	// be DynamicVal until real values are given) but it should catch some
	// straightforward cases and prevent a barrage of repeated errors.
	if e.CondExpr != nil {
		childCtx := ctx.NewChild()
		childCtx.Variables = map[string]cty.Value{}
		if e.KeyVar != "" {
			childCtx.Variables[e.KeyVar] = cty.DynamicVal
		}
		childCtx.Variables[e.ValVar] = cty.DynamicVal

		result, condDiags := e.CondExpr.Value(childCtx)
		diags = append(diags, condDiags...)
		if result.IsNull() {
			diags = append(diags, &hcl.Diagnostic{
				Severity:    hcl.DiagError,
				Summary:     "Condition is null",
				Detail:      "The value of the 'if' clause must not be null.",
				Subject:     e.CondExpr.Range().Ptr(),
				Context:     &e.SrcRange,
				Expression:  e.CondExpr,
				EvalContext: ctx,
			})
			return cty.DynamicVal, diags
		}

		_, condMarks = result.Unmark()

		_, err := convert.Convert(result, cty.Bool)
		if err != nil {
			diags = append(diags, &hcl.Diagnostic{
				Severity:    hcl.DiagError,
				Summary:     "Invalid 'for' condition",
				Detail:      fmt.Sprintf("The 'if' clause value is invalid: %s.", err.Error()),
				Subject:     e.CondExpr.Range().Ptr(),
				Context:     &e.SrcRange,
				Expression:  e.CondExpr,
				EvalContext: ctx,
			})
			return cty.DynamicVal, diags
		}
		if condDiags.HasErrors() {
			return cty.DynamicVal, diags
		}
	}

	if !collVal.IsKnown() {
		return cty.DynamicVal.WithMarks(append(marks, condMarks)...), diags
	}

	if e.KeyExpr != nil {
		// Producing an object
		var vals map[string]cty.Value
		var groupVals map[string][]cty.Value
		if e.Group {
			groupVals = map[string][]cty.Value{}
		} else {
			vals = map[string]cty.Value{}
		}

		it := collVal.ElementIterator()

		known := true
		for it.Next() {
			k, v := it.Element()
			childCtx := ctx.NewChild()
			childCtx.Variables = map[string]cty.Value{}
			if e.KeyVar != "" {
				childCtx.Variables[e.KeyVar] = k
			}
			childCtx.Variables[e.ValVar] = v

			if e.CondExpr != nil {
				includeRaw, condDiags := e.CondExpr.Value(childCtx)
				diags = append(diags, condDiags...)
				if includeRaw.IsNull() {
					if known {
						diags = append(diags, &hcl.Diagnostic{
							Severity:    hcl.DiagError,
							Summary:     "Invalid 'for' condition",
							Detail:      "The value of the 'if' clause must not be null.",
							Subject:     e.CondExpr.Range().Ptr(),
							Context:     &e.SrcRange,
							Expression:  e.CondExpr,
							EvalContext: childCtx,
						})
					}
					known = false
					continue
				}

				// Extract and merge marks from the include expression into the
				// main set of marks
				_, includeMarks := includeRaw.Unmark()
				marks = append(marks, includeMarks)

				include, err := convert.Convert(includeRaw, cty.Bool)
				if err != nil {
					if known {
						diags = append(diags, &hcl.Diagnostic{
							Severity:    hcl.DiagError,
							Summary:     "Invalid 'for' condition",
							Detail:      fmt.Sprintf("The 'if' clause value is invalid: %s.", err.Error()),
							Subject:     e.CondExpr.Range().Ptr(),
							Context:     &e.SrcRange,
							Expression:  e.CondExpr,
							EvalContext: childCtx,
						})
					}
					known = false
					continue
				}
				if !include.IsKnown() {
					known = false
					continue
				}

				// Extract and merge marks from the include expression into the
				// main set of marks
				includeUnmarked, _ := include.Unmark()
				marks = append(marks, includeMarks)
				if includeUnmarked.False() {
					// Skip this element
					continue
				}
			}

			keyRaw, keyDiags := e.KeyExpr.Value(childCtx)
			diags = append(diags, keyDiags...)
			if keyRaw.IsNull() {
				if known {
					diags = append(diags, &hcl.Diagnostic{
						Severity:    hcl.DiagError,
						Summary:     "Invalid object key",
						Detail:      "Key expression in 'for' expression must not produce a null value.",
						Subject:     e.KeyExpr.Range().Ptr(),
						Context:     &e.SrcRange,
						Expression:  e.KeyExpr,
						EvalContext: childCtx,
					})
				}
				known = false
				continue
			}

			_, keyMarks := keyRaw.Unmark()
			marks = append(marks, keyMarks)

			if !keyRaw.IsKnown() {
				known = false
				continue
			}

			key, err := convert.Convert(keyRaw, cty.String)
			if err != nil {
				if known {
					diags = append(diags, &hcl.Diagnostic{
						Severity:    hcl.DiagError,
						Summary:     "Invalid object key",
						Detail:      fmt.Sprintf("The key expression produced an invalid result: %s.", err.Error()),
						Subject:     e.KeyExpr.Range().Ptr(),
						Context:     &e.SrcRange,
						Expression:  e.KeyExpr,
						EvalContext: childCtx,
					})
				}
				known = false
				continue
			}

			key, _ = key.Unmark()

			val, valDiags := e.ValExpr.Value(childCtx)
			diags = append(diags, valDiags...)

			if e.Group {
				k := key.AsString()
				groupVals[k] = append(groupVals[k], val)
			} else {
				k := key.AsString()
				if _, exists := vals[k]; exists {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Duplicate object key",
						Detail: fmt.Sprintf(
							"Two different items produced the key %q in this 'for' expression. If duplicates are expected, use the ellipsis (...) after the value expression to enable grouping by key.",
							k,
						),
						Subject:     e.KeyExpr.Range().Ptr(),
						Context:     &e.SrcRange,
						Expression:  e.KeyExpr,
						EvalContext: childCtx,
					})
				} else {
					vals[key.AsString()] = val
				}
			}
		}

		if !known {
			return cty.DynamicVal.WithMarks(marks...), diags
		}

		if e.Group {
			vals = map[string]cty.Value{}
			for k, gvs := range groupVals {
				vals[k] = cty.TupleVal(gvs)
			}
		}

		return cty.ObjectVal(vals).WithMarks(marks...), diags

	} else {
		// Producing a tuple
		vals := []cty.Value{}

		it := collVal.ElementIterator()

		known := true
		for it.Next() {
			k, v := it.Element()
			childCtx := ctx.NewChild()
			childCtx.Variables = map[string]cty.Value{}
			if e.KeyVar != "" {
				childCtx.Variables[e.KeyVar] = k
			}
			childCtx.Variables[e.ValVar] = v

			if e.CondExpr != nil {
				includeRaw, condDiags := e.CondExpr.Value(childCtx)
				diags = append(diags, condDiags...)
				if includeRaw.IsNull() {
					if known {
						diags = append(diags, &hcl.Diagnostic{
							Severity:    hcl.DiagError,
							Summary:     "Invalid 'for' condition",
							Detail:      "The value of the 'if' clause must not be null.",
							Subject:     e.CondExpr.Range().Ptr(),
							Context:     &e.SrcRange,
							Expression:  e.CondExpr,
							EvalContext: childCtx,
						})
					}
					known = false
					continue
				}

				// Extract and merge marks from the include expression into the
				// main set of marks
				_, includeMarks := includeRaw.Unmark()
				marks = append(marks, includeMarks)

				if !includeRaw.IsKnown() {
					// We will eventually return DynamicVal, but we'll continue
					// iterating in case there are other diagnostics to gather
					// for later elements.
					known = false
					continue
				}

				include, err := convert.Convert(includeRaw, cty.Bool)
				if err != nil {
					if known {
						diags = append(diags, &hcl.Diagnostic{
							Severity:    hcl.DiagError,
							Summary:     "Invalid 'for' condition",
							Detail:      fmt.Sprintf("The 'if' clause value is invalid: %s.", err.Error()),
							Subject:     e.CondExpr.Range().Ptr(),
							Context:     &e.SrcRange,
							Expression:  e.CondExpr,
							EvalContext: childCtx,
						})
					}
					known = false
					continue
				}

				includeUnmarked, _ := include.Unmark()
				if includeUnmarked.False() {
					// Skip this element
					continue
				}
			}

			val, valDiags := e.ValExpr.Value(childCtx)
			diags = append(diags, valDiags...)
			vals = append(vals, val)
		}

		if !known {
			return cty.DynamicVal.WithMarks(marks...), diags
		}

		return cty.TupleVal(vals).WithMarks(marks...), diags
	}
}

func (e *ForExpr) walkChildNodes(w internalWalkFunc) {
	w(e.CollExpr)

	scopeNames := map[string]struct{}{}
	if e.KeyVar != "" {
		scopeNames[e.KeyVar] = struct{}{}
	}
	if e.ValVar != "" {
		scopeNames[e.ValVar] = struct{}{}
	}

	if e.KeyExpr != nil {
		w(ChildScope{
			LocalNames: scopeNames,
			Expr:       e.KeyExpr,
		})
	}
	w(ChildScope{
		LocalNames: scopeNames,
		Expr:       e.ValExpr,
	})
	if e.CondExpr != nil {
		w(ChildScope{
			LocalNames: scopeNames,
			Expr:       e.CondExpr,
		})
	}
}

func (e *ForExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *ForExpr) StartRange() hcl.Range {
	return e.OpenRange
}

type SplatExpr struct {
	Source Expression
	Each   Expression
	Item   *AnonSymbolExpr

	SrcRange    hcl.Range
	MarkerRange hcl.Range
}

func (e *SplatExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	sourceVal, diags := e.Source.Value(ctx)
	if diags.HasErrors() {
		// We'll evaluate our "Each" expression here just to see if it
		// produces any more diagnostics we can report. Since we're not
		// assigning a value to our AnonSymbolExpr here it will return
		// DynamicVal, which should short-circuit any use of it.
		_, itemDiags := e.Item.Value(ctx)
		diags = append(diags, itemDiags...)
		return cty.DynamicVal, diags
	}

	sourceTy := sourceVal.Type()

	// A "special power" of splat expressions is that they can be applied
	// both to tuples/lists and to other values, and in the latter case
	// the value will be treated as an implicit single-item tuple, or as
	// an empty tuple if the value is null.
	//nolint:staticcheck // QF1001: Demorgan's law wouldn't improve readability.
	autoUpgrade := !(sourceTy.IsTupleType() || sourceTy.IsListType() || sourceTy.IsSetType())

	if sourceVal.IsNull() {
		if autoUpgrade {
			return cty.EmptyTupleVal.WithSameMarks(sourceVal), diags
		}
		diags = append(diags, &hcl.Diagnostic{
			Severity:    hcl.DiagError,
			Summary:     "Splat of null value",
			Detail:      "Splat expressions (with the * symbol) cannot be applied to null sequences.",
			Subject:     e.Source.Range().Ptr(),
			Context:     hcl.RangeBetween(e.Source.Range(), e.MarkerRange).Ptr(),
			Expression:  e.Source,
			EvalContext: ctx,
		})
		return cty.DynamicVal, diags
	}

	if sourceTy == cty.DynamicPseudoType {
		// If we don't even know the _type_ of our source value yet then
		// we'll need to defer all processing, since we can't decide our
		// result type either.
		return cty.DynamicVal.WithSameMarks(sourceVal), diags
	}

	upgradedUnknown := false
	if autoUpgrade {
		// If we're upgrading an unknown value to a tuple/list, the result
		// cannot be known. Otherwise a tuple containing an unknown value will
		// upgrade to a different number of elements depending on whether
		// sourceVal becomes null or not.
		// We record this condition here so we can process any remaining
		// expression after the * to verify the result of the traversal. For
		// example, it is valid to use a splat on a single object to retrieve a
		// list of a single attribute, but we still need to check if that
		// attribute actually exists.
		if !sourceVal.IsKnown() {
			unmarkedVal, _ := sourceVal.Unmark()
			sourceRng := unmarkedVal.Range()
			if sourceRng.CouldBeNull() {
				upgradedUnknown = true
			}
		}

		sourceVal = cty.TupleVal([]cty.Value{sourceVal}).WithSameMarks(sourceVal)
		sourceTy = sourceVal.Type()
	}

	// We'll compute our result type lazily if we need it. In the normal case
	// it's inferred automatically from the value we construct.
	resultTy := func() (cty.Type, hcl.Diagnostics) {
		chiCtx := ctx.NewChild()
		var diags hcl.Diagnostics
		switch {
		case sourceTy.IsListType() || sourceTy.IsSetType():
			ety := sourceTy.ElementType()
			e.Item.setValue(chiCtx, cty.UnknownVal(ety))
			val, itemDiags := e.Each.Value(chiCtx)
			diags = append(diags, itemDiags...)
			e.Item.clearValue(chiCtx) // clean up our temporary value
			return cty.List(val.Type()), diags
		case sourceTy.IsTupleType():
			etys := sourceTy.TupleElementTypes()
			resultTys := make([]cty.Type, 0, len(etys))
			for _, ety := range etys {
				e.Item.setValue(chiCtx, cty.UnknownVal(ety))
				val, itemDiags := e.Each.Value(chiCtx)
				diags = append(diags, itemDiags...)
				e.Item.clearValue(chiCtx) // clean up our temporary value
				resultTys = append(resultTys, val.Type())
			}
			return cty.Tuple(resultTys), diags
		default:
			// Should never happen because of our promotion to list above.
			return cty.DynamicPseudoType, diags
		}
	}

	if !sourceVal.IsKnown() {
		// We can't produce a known result in this case, but we'll still
		// indicate what the result type would be, allowing any downstream type
		// checking to proceed.
		ty, tyDiags := resultTy()
		diags = append(diags, tyDiags...)
		ret := cty.UnknownVal(ty)
		if ty != cty.DynamicPseudoType {
			ret = ret.RefineNotNull()
		}
		if ty.IsListType() && sourceVal.Type().IsCollectionType() {
			// We can refine the length of an unknown list result based on
			// the source collection's own length.
			sv, _ := sourceVal.Unmark()
			sourceRng := sv.Range()
			ret = ret.Refine().
				CollectionLengthLowerBound(sourceRng.LengthLowerBound()).
				CollectionLengthUpperBound(sourceRng.LengthUpperBound()).
				NewValue()
		}
		return ret.WithSameMarks(sourceVal), diags
	}

	// Unmark the collection, and save the marks to apply to the returned
	// collection result
	sourceVal, marks := sourceVal.Unmark()
	vals := make([]cty.Value, 0, sourceVal.LengthInt())
	it := sourceVal.ElementIterator()
	if ctx == nil {
		// we need a context to use our AnonSymbolExpr, so we'll just
		// make an empty one here to use as a placeholder.
		ctx = ctx.NewChild()
	}
	isKnown := true
	for it.Next() {
		_, sourceItem := it.Element()
		e.Item.setValue(ctx, sourceItem)
		newItem, itemDiags := e.Each.Value(ctx)
		diags = append(diags, itemDiags...)
		if itemDiags.HasErrors() {
			isKnown = false
		}
		vals = append(vals, newItem)
	}
	e.Item.clearValue(ctx) // clean up our temporary value

	if upgradedUnknown {
		return cty.DynamicVal.WithMarks(marks), diags
	}

	if !isKnown {
		// We'll ingore the resultTy diagnostics in this case since they
		// will just be the same errors we saw while iterating above.
		ty, _ := resultTy()
		return cty.UnknownVal(ty).WithMarks(marks), diags
	}

	switch {
	case sourceTy.IsListType() || sourceTy.IsSetType():
		if len(vals) == 0 {
			ty, tyDiags := resultTy()
			diags = append(diags, tyDiags...)
			return cty.ListValEmpty(ty.ElementType()).WithMarks(marks), diags
		}
		// Unfortunately it's possible for a nested splat on scalar values to
		// generate non-homogenously-typed vals, and we discovered this bad
		// interaction after the two conflicting behaviors were both
		// well-established so it isn't clear how to change them without
		// breaking existing code. Therefore we just make that an error for
		// now, to avoid crashing trying to constuct an impossible list.
		if !cty.CanListVal(vals) {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid nested splat expressions",
				Detail:   "The second level of splat expression produced elements of different types, so it isn't possible to construct a valid list to represent the top-level result.\n\nConsider using a for expression instead, to produce a tuple-typed result which can therefore have non-homogenous element types.",
				Subject:  e.Each.Range().Ptr(),
				Context:  e.Range().Ptr(), // encourage a diagnostic renderer to also include the "source" part of the expression in its code snippet
			})
			return cty.DynamicVal, diags
		}
		return cty.ListVal(vals).WithMarks(marks), diags
	default:
		return cty.TupleVal(vals).WithMarks(marks), diags
	}
}

func (e *SplatExpr) walkChildNodes(w internalWalkFunc) {
	w(e.Source)
	w(e.Each)
}

func (e *SplatExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *SplatExpr) StartRange() hcl.Range {
	return e.MarkerRange
}

// AnonSymbolExpr is used as a placeholder for a value in an expression that
// can be applied dynamically to any value at runtime.
//
// This is a rather odd, synthetic expression. It is used as part of the
// representation of splat expressions as a placeholder for the current item
// being visited in the splat evaluation.
//
// AnonSymbolExpr cannot be evaluated in isolation. If its Value is called
// directly then cty.DynamicVal will be returned. Instead, it is evaluated
// in terms of another node (i.e. a splat expression) which temporarily
// assigns it a value.
type AnonSymbolExpr struct {
	SrcRange hcl.Range

	// values and its associated lock are used to isolate concurrent
	// evaluations of a symbol from one another. It is the calling application's
	// responsibility to ensure that the same splat expression is not evalauted
	// concurrently within the _same_ EvalContext, but it is fine and safe to
	// do cuncurrent evaluations with distinct EvalContexts.
	values     map[*hcl.EvalContext]cty.Value
	valuesLock sync.RWMutex
}

func (e *AnonSymbolExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	if ctx == nil {
		return cty.DynamicVal, nil
	}

	e.valuesLock.RLock()
	defer e.valuesLock.RUnlock()

	val, exists := e.values[ctx]
	if !exists {
		return cty.DynamicVal, nil
	}
	return val, nil
}

// setValue sets a temporary local value for the expression when evaluated
// in the given context, which must be non-nil.
func (e *AnonSymbolExpr) setValue(ctx *hcl.EvalContext, val cty.Value) {
	e.valuesLock.Lock()
	defer e.valuesLock.Unlock()

	if e.values == nil {
		e.values = make(map[*hcl.EvalContext]cty.Value)
	}
	if ctx == nil {
		panic("can't setValue for a nil EvalContext")
	}
	e.values[ctx] = val
}

func (e *AnonSymbolExpr) clearValue(ctx *hcl.EvalContext) {
	e.valuesLock.Lock()
	defer e.valuesLock.Unlock()

	if e.values == nil {
		return
	}
	if ctx == nil {
		panic("can't clearValue for a nil EvalContext")
	}
	delete(e.values, ctx)
}

func (e *AnonSymbolExpr) walkChildNodes(w internalWalkFunc) {
	// AnonSymbolExpr is a leaf node in the tree
}

func (e *AnonSymbolExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *AnonSymbolExpr) StartRange() hcl.Range {
	return e.SrcRange
}

// ExprSyntaxError is a placeholder for an invalid expression that could not
// be parsed due to syntax errors.
type ExprSyntaxError struct {
	Placeholder cty.Value
	ParseDiags  hcl.Diagnostics
	SrcRange    hcl.Range
}

func (e *ExprSyntaxError) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	return e.Placeholder, e.ParseDiags
}

func (e *ExprSyntaxError) walkChildNodes(w internalWalkFunc) {
	// ExprSyntaxError is a leaf node in the tree
}

func (e *ExprSyntaxError) Range() hcl.Range {
	return e.SrcRange
}

func (e *ExprSyntaxError) StartRange() hcl.Range {
	return e.SrcRange
}
