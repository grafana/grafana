package stdlib

import (
	"fmt"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/convert"
	"github.com/zclconf/go-cty/cty/function"
)

var EqualFunc = function.New(&function.Spec{
	Description: `Returns true if the two given values are equal, or false otherwise.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.DynamicPseudoType,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowNull:        true,
		},
		{
			Name:             "b",
			Type:             cty.DynamicPseudoType,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowNull:        true,
		},
	},
	Type:         function.StaticReturnType(cty.Bool),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		return args[0].Equals(args[1]), nil
	},
})

var NotEqualFunc = function.New(&function.Spec{
	Description: `Returns false if the two given values are equal, or true otherwise.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.DynamicPseudoType,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowNull:        true,
		},
		{
			Name:             "b",
			Type:             cty.DynamicPseudoType,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowNull:        true,
		},
	},
	Type:         function.StaticReturnType(cty.Bool),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		return args[0].Equals(args[1]).Not(), nil
	},
})

var CoalesceFunc = function.New(&function.Spec{
	Description: `Returns the first of the given arguments that isn't null, or raises an error if there are no non-null arguments.`,
	Params:      []function.Parameter{},
	VarParam: &function.Parameter{
		Name:             "vals",
		Type:             cty.DynamicPseudoType,
		AllowUnknown:     true,
		AllowDynamicType: true,
		AllowNull:        true,
	},
	Type: func(args []cty.Value) (ret cty.Type, err error) {
		argTypes := make([]cty.Type, len(args))
		for i, val := range args {
			argTypes[i] = val.Type()
		}
		retType, _ := convert.UnifyUnsafe(argTypes)
		if retType == cty.NilType {
			return cty.NilType, fmt.Errorf("all arguments must have the same type")
		}
		return retType, nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		for _, argVal := range args {
			if !argVal.IsKnown() {
				return cty.UnknownVal(retType), nil
			}
			if argVal.IsNull() {
				continue
			}

			return convert.Convert(argVal, retType)
		}
		return cty.NilVal, fmt.Errorf("no non-null arguments")
	},
})

func refineNonNull(b *cty.RefinementBuilder) *cty.RefinementBuilder {
	return b.NotNull()
}

// Equal determines whether the two given values are equal, returning a
// bool value.
func Equal(a cty.Value, b cty.Value) (cty.Value, error) {
	return EqualFunc.Call([]cty.Value{a, b})
}

// NotEqual is the opposite of Equal.
func NotEqual(a cty.Value, b cty.Value) (cty.Value, error) {
	return NotEqualFunc.Call([]cty.Value{a, b})
}

// Coalesce returns the first of the given arguments that is not null. If
// all arguments are null, an error is produced.
func Coalesce(vals ...cty.Value) (cty.Value, error) {
	return CoalesceFunc.Call(vals)
}
