# HCL Custom Static Decoding Extension

This HCL extension provides a mechanism for defining arguments in an HCL-based
language whose values are derived using custom decoding rules against the
HCL expression syntax, overriding the usual behavior of normal expression
evaluation.

"Arguments", for the purpose of this extension, currently includes the
following two contexts:

* For applications using `hcldec` for dynamic decoding, a `hcldec.AttrSpec`
  or `hcldec.BlockAttrsSpec` can be given a special type constraint that
  opts in to custom decoding behavior for the attribute(s) that are selected
  by that specification.

* When working with the HCL native expression syntax, a function given in
  the `hcl.EvalContext` during evaluation can have parameters with special
  type constraints that opt in to custom decoding behavior for the argument
  expression associated with that parameter in any call.

The above use-cases are rather abstract, so we'll consider a motivating
real-world example: sometimes we (language designers) need to allow users
to specify type constraints directly in the language itself, such as in
[Terraform's Input Variables](https://www.terraform.io/docs/configuration/variables.html).
Terraform's `variable` blocks include an argument called `type` which takes
a type constraint given using HCL expression building-blocks as defined by
[the HCL `typeexpr` extension](../typeexpr/README.md).

A "type constraint expression" of that sort is not an expression intended to
be evaluated in the usual way. Instead, the physical expression is
deconstructed using [the static analysis operations](../../spec.md#static-analysis)
to produce a `cty.Type` as the result, rather than a `cty.Value`.

The purpose of this Custom Static Decoding Extension, then, is to provide a
bridge to allow that sort of custom decoding to be used via mechanisms that
normally deal in `cty.Value`, such as `hcldec` and native syntax function
calls as listed above.

(Note: [`gohcl`](https://pkg.go.dev/github.com/hashicorp/hcl/v2/gohcl) has
its own mechanism to support this use case, exploiting the fact that it is
working directly with "normal" Go types. Decoding into a struct field of
type `hcl.Expression` obtains the expression directly without evaluating it
first. The Custom Static Decoding Extension is not necessary for that `gohcl`
technique. You can also implement custom decoding by working directly with
the lowest-level HCL API, which separates extraction of and evaluation of
expressions into two steps.)

## Custom Decoding Types

This extension relies on a convention implemented in terms of
[_Capsule Types_ in the underlying `cty` type system](https://github.com/zclconf/go-cty/blob/master/docs/types.md#capsule-types). `cty` allows a capsule type to carry arbitrary
extension metadata values as an aid to creating higher-level abstractions like
this extension.

A custom argument decoding mode, then, is implemented by creating a new `cty`
capsule type that implements the `ExtensionData` custom operation to return
a decoding function when requested. For example:

```go
var keywordType cty.Type
keywordType = cty.CapsuleWithOps("keyword", reflect.TypeOf(""), &cty.CapsuleOps{
    ExtensionData: func(key interface{}) interface{} {
        switch key {
        case customdecode.CustomExpressionDecoder:
            return customdecode.CustomExpressionDecoderFunc(
                func(expr hcl.Expression, ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
                    var diags hcl.Diagnostics
                    kw := hcl.ExprAsKeyword(expr)
                    if kw == "" {
                        diags = append(diags, &hcl.Diagnostic{
                            Severity: hcl.DiagError,
                            Summary:  "Invalid keyword",
                            Detail:   "A keyword is required",
                            Subject:  expr.Range().Ptr(),
                        })
                        return cty.UnkownVal(keywordType), diags
                    }
                    return cty.CapsuleVal(keywordType, &kw)
                },
            )
        default:
            return nil
        }
    },
})
```

The boilerplate here is a bit fussy, but the important part for our purposes
is the `case customdecode.CustomExpressionDecoder:` clause, which uses
a custom extension key type defined in this package to recognize when a
component implementing this extension is checking to see if a target type
has a custom decode implementation.

In the above case we've defined a type that decodes expressions as static
keywords, so a keyword like `foo` would decode as an encapsulated `"foo"`
string, while any other sort of expression like `"baz"` or `1 + 1` would
return an error.

We could then use `keywordType` as a type constraint either for a function
parameter or a `hcldec` attribute specification, which would require the
argument for that function parameter or the expression for the matching
attributes to be a static keyword, rather than an arbitrary expression.
For example, in a `hcldec.AttrSpec`:

```go
keywordSpec := &hcldec.AttrSpec{
    Name: "keyword",
    Type: keywordType,
}
```

The above would accept input like the following and would set its result to
a `cty.Value` of `keywordType`, after decoding:

```hcl
keyword = foo
```

## The Expression and Expression Closure `cty` types

Building on the above, this package also includes two capsule types that use
the above mechanism to allow calling applications to capture expressions
directly and thus defer analysis to a later step, after initial decoding.

The `customdecode.ExpressionType` type encapsulates an `hcl.Expression` alone,
for situations like our type constraint expression example above where it's
the static structure of the expression we want to inspect, and thus any
variables and functions defined in the evaluation context are irrelevant.

The `customdecode.ExpressionClosureType` type encapsulates a
`*customdecode.ExpressionClosure` value, which binds the given expression to
the `hcl.EvalContext` it was asked to evaluate against and thus allows the
receiver of that result to later perform normal evaluation of the expression
with all the same variables and functions that would've been available to it
naturally.

Both of these types can be used as type constraints either for `hcldec`
attribute specifications or for function arguments. Here's an example of
`ExpressionClosureType` to implement a function that can evaluate
an expression with some additional variables defined locally, which we'll
call the `with(...)` function:

```go
var WithFunc = function.New(&function.Spec{
    Params: []function.Parameter{
        {
            Name: "variables",
            Type: cty.DynamicPseudoType,
        },
        {
            Name: "expression",
            Type: customdecode.ExpressionClosureType,
        },
    },
    Type: func(args []cty.Value) (cty.Type, error) {
        varsVal := args[0]
        exprVal := args[1]
        if !varsVal.Type().IsObjectType() {
            return cty.NilVal, function.NewArgErrorf(0, "must be an object defining local variables")
        }
        if !varsVal.IsKnown() {
            // We can't predict our result type until the variables object
            // is known.
            return cty.DynamicPseudoType, nil
        }
        vars := varsVal.AsValueMap()
        closure := customdecode.ExpressionClosureFromVal(exprVal)
        result, err := evalWithLocals(vars, closure)
        if err != nil {
            return cty.NilVal, err
        }
        return result.Type(), nil
    },
    Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
        varsVal := args[0]
        exprVal := args[1]
        vars := varsVal.AsValueMap()
        closure := customdecode.ExpressionClosureFromVal(exprVal)
        return evalWithLocals(vars, closure)
    },
})

func evalWithLocals(locals map[string]cty.Value, closure *customdecode.ExpressionClosure) (cty.Value, error) {
    childCtx := closure.EvalContext.NewChild()
    childCtx.Variables = locals
    val, diags := closure.Expression.Value(childCtx)
    if diags.HasErrors() {
        return cty.NilVal, function.NewArgErrorf(1, "couldn't evaluate expression: %s", diags.Error())
    }
    return val, nil
}
```

If the above function were placed into an `hcl.EvalContext` as `with`, it
could be used in a native syntax call to that function as follows:

```hcl
  foo = with({name = "Cory"}, "${greeting}, ${name}!")
```

The above assumes a variable in the main context called `greeting`, to which
the `with` function adds `name` before evaluating the expression given in
its second argument. This makes that second argument context-sensitive -- it
would behave differently if the user wrote the same thing somewhere else -- so
this capability should be used with care to make sure it doesn't cause confusion
for the end-users of your language.

There are some other examples of this capability to evaluate expressions in
unusual ways in the `tryfunc` directory that is a sibling of this one.
