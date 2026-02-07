package stdlib

import (
	"fmt"
	"math"
	"math/big"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
	"github.com/zclconf/go-cty/cty/gocty"
)

var AbsoluteFunc = function.New(&function.Spec{
	Description: `If the given number is negative then returns its positive equivalent, or otherwise returns the given number unchanged.`,
	Params: []function.Parameter{
		{
			Name:             "num",
			Type:             cty.Number,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		return args[0].Absolute(), nil
	},
})

var AddFunc = function.New(&function.Spec{
	Description: `Returns the sum of the two given numbers.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
		{
			Name:             "b",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		// big.Float.Add can panic if the input values are opposing infinities,
		// so we must catch that here in order to remain within
		// the cty Function abstraction.
		defer func() {
			if r := recover(); r != nil {
				if _, ok := r.(big.ErrNaN); ok {
					ret = cty.NilVal
					err = fmt.Errorf("can't compute sum of opposing infinities")
				} else {
					// not a panic we recognize
					panic(r)
				}
			}
		}()
		return args[0].Add(args[1]), nil
	},
})

var SubtractFunc = function.New(&function.Spec{
	Description: `Returns the difference between the two given numbers.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
		{
			Name:             "b",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		// big.Float.Sub can panic if the input values are infinities,
		// so we must catch that here in order to remain within
		// the cty Function abstraction.
		defer func() {
			if r := recover(); r != nil {
				if _, ok := r.(big.ErrNaN); ok {
					ret = cty.NilVal
					err = fmt.Errorf("can't subtract infinity from itself")
				} else {
					// not a panic we recognize
					panic(r)
				}
			}
		}()
		return args[0].Subtract(args[1]), nil
	},
})

var MultiplyFunc = function.New(&function.Spec{
	Description: `Returns the product of the two given numbers.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
		{
			Name:             "b",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		// big.Float.Mul can panic if the input values are both zero or both
		// infinity, so we must catch that here in order to remain within
		// the cty Function abstraction.
		defer func() {
			if r := recover(); r != nil {
				if _, ok := r.(big.ErrNaN); ok {
					ret = cty.NilVal
					err = fmt.Errorf("can't multiply zero by infinity")
				} else {
					// not a panic we recognize
					panic(r)
				}
			}
		}()

		return args[0].Multiply(args[1]), nil
	},
})

var DivideFunc = function.New(&function.Spec{
	Description: `Divides the first given number by the second.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
		{
			Name:             "b",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		// big.Float.Quo can panic if the input values are both zero or both
		// infinity, so we must catch that here in order to remain within
		// the cty Function abstraction.
		defer func() {
			if r := recover(); r != nil {
				if _, ok := r.(big.ErrNaN); ok {
					ret = cty.NilVal
					err = fmt.Errorf("can't divide zero by zero or infinity by infinity")
				} else {
					// not a panic we recognize
					panic(r)
				}
			}
		}()

		return args[0].Divide(args[1]), nil
	},
})

var ModuloFunc = function.New(&function.Spec{
	Description: `Divides the first given number by the second and then returns the remainder.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
		{
			Name:             "b",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		// big.Float.Mul can panic if the input values are both zero or both
		// infinity, so we must catch that here in order to remain within
		// the cty Function abstraction.
		defer func() {
			if r := recover(); r != nil {
				if _, ok := r.(big.ErrNaN); ok {
					ret = cty.NilVal
					err = fmt.Errorf("can't use modulo with zero and infinity")
				} else {
					// not a panic we recognize
					panic(r)
				}
			}
		}()

		return args[0].Modulo(args[1]), nil
	},
})

var GreaterThanFunc = function.New(&function.Spec{
	Description: `Returns true if and only if the second number is greater than the first.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.Number,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
		{
			Name:             "b",
			Type:             cty.Number,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
	},
	Type:         function.StaticReturnType(cty.Bool),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		return args[0].GreaterThan(args[1]), nil
	},
})

var GreaterThanOrEqualToFunc = function.New(&function.Spec{
	Description: `Returns true if and only if the second number is greater than or equal to the first.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.Number,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
		{
			Name:             "b",
			Type:             cty.Number,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
	},
	Type:         function.StaticReturnType(cty.Bool),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		return args[0].GreaterThanOrEqualTo(args[1]), nil
	},
})

var LessThanFunc = function.New(&function.Spec{
	Description: `Returns true if and only if the second number is less than the first.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.Number,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
		{
			Name:             "b",
			Type:             cty.Number,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
	},
	Type:         function.StaticReturnType(cty.Bool),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		return args[0].LessThan(args[1]), nil
	},
})

var LessThanOrEqualToFunc = function.New(&function.Spec{
	Description: `Returns true if and only if the second number is less than or equal to the first.`,
	Params: []function.Parameter{
		{
			Name:             "a",
			Type:             cty.Number,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
		{
			Name:             "b",
			Type:             cty.Number,
			AllowUnknown:     true,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
	},
	Type:         function.StaticReturnType(cty.Bool),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		return args[0].LessThanOrEqualTo(args[1]), nil
	},
})

var NegateFunc = function.New(&function.Spec{
	Description: `Multiplies the given number by -1.`,
	Params: []function.Parameter{
		{
			Name:             "num",
			Type:             cty.Number,
			AllowDynamicType: true,
			AllowMarked:      true,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		return args[0].Negate(), nil
	},
})

var MinFunc = function.New(&function.Spec{
	Description: `Returns the numerically smallest of all of the given numbers.`,
	Params:      []function.Parameter{},
	VarParam: &function.Parameter{
		Name:             "numbers",
		Type:             cty.Number,
		AllowDynamicType: true,
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		if len(args) == 0 {
			return cty.NilVal, fmt.Errorf("must pass at least one number")
		}

		min := cty.PositiveInfinity
		for _, num := range args {
			if num.LessThan(min).True() {
				min = num
			}
		}

		return min, nil
	},
})

var MaxFunc = function.New(&function.Spec{
	Description: `Returns the numerically greatest of all of the given numbers.`,
	Params:      []function.Parameter{},
	VarParam: &function.Parameter{
		Name:             "numbers",
		Type:             cty.Number,
		AllowDynamicType: true,
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		if len(args) == 0 {
			return cty.NilVal, fmt.Errorf("must pass at least one number")
		}

		max := cty.NegativeInfinity
		for _, num := range args {
			if num.GreaterThan(max).True() {
				max = num
			}
		}

		return max, nil
	},
})

var IntFunc = function.New(&function.Spec{
	Description: `Discards any fractional portion of the given number.`,
	Params: []function.Parameter{
		{
			Name:             "num",
			Type:             cty.Number,
			AllowDynamicType: true,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		bf := args[0].AsBigFloat()
		if bf.IsInt() {
			return args[0], nil
		}
		bi, _ := bf.Int(nil)
		bf = (&big.Float{}).SetInt(bi)
		return cty.NumberVal(bf), nil
	},
})

// CeilFunc is a function that returns the closest whole number greater
// than or equal to the given value.
var CeilFunc = function.New(&function.Spec{
	Description: `Returns the smallest whole number that is greater than or equal to the given value.`,
	Params: []function.Parameter{
		{
			Name: "num",
			Type: cty.Number,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		f := args[0].AsBigFloat()

		if f.IsInf() {
			return cty.NumberVal(f), nil
		}

		i, acc := f.Int(nil)
		switch acc {
		case big.Exact, big.Above:
			// Done.
		case big.Below:
			i.Add(i, big.NewInt(1))
		}

		return cty.NumberVal(f.SetInt(i)), nil
	},
})

// FloorFunc is a function that returns the closest whole number lesser
// than or equal to the given value.
var FloorFunc = function.New(&function.Spec{
	Description: `Returns the greatest whole number that is less than or equal to the given value.`,
	Params: []function.Parameter{
		{
			Name: "num",
			Type: cty.Number,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		f := args[0].AsBigFloat()

		if f.IsInf() {
			return cty.NumberVal(f), nil
		}

		i, acc := f.Int(nil)
		switch acc {
		case big.Exact, big.Below:
			// Done.
		case big.Above:
			i.Sub(i, big.NewInt(1))
		}

		return cty.NumberVal(f.SetInt(i)), nil
	},
})

// LogFunc is a function that returns the logarithm of a given number in a given base.
var LogFunc = function.New(&function.Spec{
	Description: `Returns the logarithm of the given number in the given base.`,
	Params: []function.Parameter{
		{
			Name: "num",
			Type: cty.Number,
		},
		{
			Name: "base",
			Type: cty.Number,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		var num float64
		if err := gocty.FromCtyValue(args[0], &num); err != nil {
			return cty.UnknownVal(cty.String), err
		}

		var base float64
		if err := gocty.FromCtyValue(args[1], &base); err != nil {
			return cty.UnknownVal(cty.String), err
		}

		return cty.NumberFloatVal(math.Log(num) / math.Log(base)), nil
	},
})

// PowFunc is a function that returns the logarithm of a given number in a given base.
var PowFunc = function.New(&function.Spec{
	Description: `Returns the given number raised to the given power (exponentiation).`,
	Params: []function.Parameter{
		{
			Name: "num",
			Type: cty.Number,
		},
		{
			Name: "power",
			Type: cty.Number,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		var num float64
		if err := gocty.FromCtyValue(args[0], &num); err != nil {
			return cty.UnknownVal(cty.String), err
		}

		var power float64
		if err := gocty.FromCtyValue(args[1], &power); err != nil {
			return cty.UnknownVal(cty.String), err
		}

		return cty.NumberFloatVal(math.Pow(num, power)), nil
	},
})

// SignumFunc is a function that determines the sign of a number, returning a
// number between -1 and 1 to represent the sign..
var SignumFunc = function.New(&function.Spec{
	Description: `Returns 0 if the given number is zero, 1 if the given number is positive, or -1 if the given number is negative.`,
	Params: []function.Parameter{
		{
			Name: "num",
			Type: cty.Number,
		},
	},
	Type:         function.StaticReturnType(cty.Number),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		var num int
		if err := gocty.FromCtyValue(args[0], &num); err != nil {
			return cty.UnknownVal(cty.String), err
		}
		switch {
		case num < 0:
			return cty.NumberIntVal(-1), nil
		case num > 0:
			return cty.NumberIntVal(+1), nil
		default:
			return cty.NumberIntVal(0), nil
		}
	},
})

// ParseIntFunc is a function that parses a string argument and returns an integer of the specified base.
var ParseIntFunc = function.New(&function.Spec{
	Description: `Parses the given string as a number of the given base, or raises an error if the string contains invalid characters.`,
	Params: []function.Parameter{
		{
			Name: "number",
			Type: cty.DynamicPseudoType,
		},
		{
			Name: "base",
			Type: cty.Number,
		},
	},

	Type: func(args []cty.Value) (cty.Type, error) {
		if !args[0].Type().Equals(cty.String) {
			return cty.Number, function.NewArgErrorf(0, "first argument must be a string, not %s", args[0].Type().FriendlyName())
		}
		return cty.Number, nil
	},
	RefineResult: refineNonNull,

	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		var numstr string
		var base int
		var err error

		if err = gocty.FromCtyValue(args[0], &numstr); err != nil {
			return cty.UnknownVal(cty.String), function.NewArgError(0, err)
		}

		if err = gocty.FromCtyValue(args[1], &base); err != nil {
			return cty.UnknownVal(cty.Number), function.NewArgError(1, err)
		}

		if base < 2 || base > 62 {
			return cty.UnknownVal(cty.Number), function.NewArgErrorf(
				1,
				"base must be a whole number between 2 and 62 inclusive",
			)
		}

		num, ok := (&big.Int{}).SetString(numstr, base)
		if !ok {
			return cty.UnknownVal(cty.Number), function.NewArgErrorf(
				0,
				"cannot parse %q as a base %d integer",
				numstr,
				base,
			)
		}

		parsedNum := cty.NumberVal((&big.Float{}).SetInt(num))

		return parsedNum, nil
	},
})

// Absolute returns the magnitude of the given number, without its sign.
// That is, it turns negative values into positive values.
func Absolute(num cty.Value) (cty.Value, error) {
	return AbsoluteFunc.Call([]cty.Value{num})
}

// Add returns the sum of the two given numbers.
func Add(a cty.Value, b cty.Value) (cty.Value, error) {
	return AddFunc.Call([]cty.Value{a, b})
}

// Subtract returns the difference between the two given numbers.
func Subtract(a cty.Value, b cty.Value) (cty.Value, error) {
	return SubtractFunc.Call([]cty.Value{a, b})
}

// Multiply returns the product of the two given numbers.
func Multiply(a cty.Value, b cty.Value) (cty.Value, error) {
	return MultiplyFunc.Call([]cty.Value{a, b})
}

// Divide returns a divided by b, where both a and b are numbers.
func Divide(a cty.Value, b cty.Value) (cty.Value, error) {
	return DivideFunc.Call([]cty.Value{a, b})
}

// Negate returns the given number multipled by -1.
func Negate(num cty.Value) (cty.Value, error) {
	return NegateFunc.Call([]cty.Value{num})
}

// LessThan returns true if a is less than b.
func LessThan(a cty.Value, b cty.Value) (cty.Value, error) {
	return LessThanFunc.Call([]cty.Value{a, b})
}

// LessThanOrEqualTo returns true if a is less than b.
func LessThanOrEqualTo(a cty.Value, b cty.Value) (cty.Value, error) {
	return LessThanOrEqualToFunc.Call([]cty.Value{a, b})
}

// GreaterThan returns true if a is less than b.
func GreaterThan(a cty.Value, b cty.Value) (cty.Value, error) {
	return GreaterThanFunc.Call([]cty.Value{a, b})
}

// GreaterThanOrEqualTo returns true if a is less than b.
func GreaterThanOrEqualTo(a cty.Value, b cty.Value) (cty.Value, error) {
	return GreaterThanOrEqualToFunc.Call([]cty.Value{a, b})
}

// Modulo returns the remainder of a divided by b under integer division,
// where both a and b are numbers.
func Modulo(a cty.Value, b cty.Value) (cty.Value, error) {
	return ModuloFunc.Call([]cty.Value{a, b})
}

// Min returns the minimum number from the given numbers.
func Min(numbers ...cty.Value) (cty.Value, error) {
	return MinFunc.Call(numbers)
}

// Max returns the maximum number from the given numbers.
func Max(numbers ...cty.Value) (cty.Value, error) {
	return MaxFunc.Call(numbers)
}

// Int removes the fractional component of the given number returning an
// integer representing the whole number component, rounding towards zero.
// For example, -1.5 becomes -1.
//
// If an infinity is passed to Int, an error is returned.
func Int(num cty.Value) (cty.Value, error) {
	if num == cty.PositiveInfinity || num == cty.NegativeInfinity {
		return cty.NilVal, fmt.Errorf("can't truncate infinity to an integer")
	}
	return IntFunc.Call([]cty.Value{num})
}

// Ceil returns the closest whole number greater than or equal to the given value.
func Ceil(num cty.Value) (cty.Value, error) {
	return CeilFunc.Call([]cty.Value{num})
}

// Floor returns the closest whole number lesser than or equal to the given value.
func Floor(num cty.Value) (cty.Value, error) {
	return FloorFunc.Call([]cty.Value{num})
}

// Log returns returns the logarithm of a given number in a given base.
func Log(num, base cty.Value) (cty.Value, error) {
	return LogFunc.Call([]cty.Value{num, base})
}

// Pow returns the logarithm of a given number in a given base.
func Pow(num, power cty.Value) (cty.Value, error) {
	return PowFunc.Call([]cty.Value{num, power})
}

// Signum determines the sign of a number, returning a number between -1 and
// 1 to represent the sign.
func Signum(num cty.Value) (cty.Value, error) {
	return SignumFunc.Call([]cty.Value{num})
}

// ParseInt parses a string argument and returns an integer of the specified base.
func ParseInt(num cty.Value, base cty.Value) (cty.Value, error) {
	return ParseIntFunc.Call([]cty.Value{num, base})
}
