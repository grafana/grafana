package stdlib

import (
	"fmt"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/convert"
	"github.com/zclconf/go-cty/cty/function"
)

var ConcatFunc = function.New(&function.Spec{
	Description: `Concatenates together all of the given lists or tuples into a single sequence, preserving the input order.`,
	Params:      []function.Parameter{},
	VarParam: &function.Parameter{
		Name:        "seqs",
		Type:        cty.DynamicPseudoType,
		AllowMarked: true,
	},
	Type: func(args []cty.Value) (ret cty.Type, err error) {
		if len(args) == 0 {
			return cty.NilType, fmt.Errorf("at least one argument is required")
		}

		if args[0].Type().IsListType() {
			// Possibly we're going to return a list, if all of our other
			// args are also lists and we can find a common element type.
			tys := make([]cty.Type, len(args))
			for i, val := range args {
				ty := val.Type()
				if !ty.IsListType() {
					tys = nil
					break
				}
				tys[i] = ty
			}

			if tys != nil {
				commonType, _ := convert.UnifyUnsafe(tys)
				if commonType != cty.NilType {
					return commonType, nil
				}
			}
		}

		etys := make([]cty.Type, 0, len(args))
		for i, val := range args {
			// Discard marks for nested values, as we only need to handle types
			// and lengths.
			val, _ := val.UnmarkDeep()

			ety := val.Type()
			switch {
			case ety.IsTupleType():
				etys = append(etys, ety.TupleElementTypes()...)
			case ety.IsListType():
				if !val.IsKnown() {
					// We need to know the list to count its elements to
					// build our tuple type, so any concat of an unknown
					// list can't be typed yet.
					return cty.DynamicPseudoType, nil
				}

				l := val.LengthInt()
				subEty := ety.ElementType()
				for j := 0; j < l; j++ {
					etys = append(etys, subEty)
				}
			default:
				return cty.NilType, function.NewArgErrorf(
					i, "all arguments must be lists or tuples; got %s",
					ety.FriendlyName(),
				)
			}
		}
		return cty.Tuple(etys), nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		switch {
		case retType.IsListType():
			// If retType is a list type then we know that all of the
			// given values will be lists and that they will either be of
			// retType or of something we can convert to retType.
			vals := make([]cty.Value, 0, len(args))
			var markses []cty.ValueMarks // remember any marked lists we find
			for i, list := range args {
				list, err = convert.Convert(list, retType)
				if err != nil {
					// Conversion might fail because we used UnifyUnsafe
					// to choose our return type.
					return cty.NilVal, function.NewArgError(i, err)
				}

				list, listMarks := list.Unmark()
				if len(listMarks) > 0 {
					markses = append(markses, listMarks)
				}

				it := list.ElementIterator()
				for it.Next() {
					_, v := it.Element()
					vals = append(vals, v)
				}
			}
			if len(vals) == 0 {
				return cty.ListValEmpty(retType.ElementType()).WithMarks(markses...), nil
			}

			return cty.ListVal(vals).WithMarks(markses...), nil
		case retType.IsTupleType():
			// If retType is a tuple type then we could have a mixture of
			// lists and tuples but we know they all have known values
			// (because our params don't AllowUnknown) and we know that
			// concatenating them all together will produce a tuple of
			// retType because of the work we did in the Type function above.
			vals := make([]cty.Value, 0, len(args))
			var markses []cty.ValueMarks // remember any marked seqs we find

			for _, seq := range args {
				seq, seqMarks := seq.Unmark()
				if len(seqMarks) > 0 {
					markses = append(markses, seqMarks)
				}

				// Both lists and tuples support ElementIterator, so this is easy.
				it := seq.ElementIterator()
				for it.Next() {
					_, v := it.Element()
					vals = append(vals, v)
				}
			}

			return cty.TupleVal(vals).WithMarks(markses...), nil
		default:
			// should never happen if Type is working correctly above
			panic("unsupported return type")
		}
	},
})

var RangeFunc = function.New(&function.Spec{
	Description: `Returns a list of numbers spread evenly over a particular range.`,
	VarParam: &function.Parameter{
		Name: "params",
		Type: cty.Number,
	},
	Type:         function.StaticReturnType(cty.List(cty.Number)),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		var start, end, step cty.Value
		switch len(args) {
		case 1:
			if args[0].LessThan(cty.Zero).True() {
				start, end, step = cty.Zero, args[0], cty.NumberIntVal(-1)
			} else {
				start, end, step = cty.Zero, args[0], cty.NumberIntVal(1)
			}
		case 2:
			if args[1].LessThan(args[0]).True() {
				start, end, step = args[0], args[1], cty.NumberIntVal(-1)
			} else {
				start, end, step = args[0], args[1], cty.NumberIntVal(1)
			}
		case 3:
			start, end, step = args[0], args[1], args[2]
		default:
			return cty.NilVal, fmt.Errorf("must have one, two, or three arguments")
		}

		var vals []cty.Value

		if step == cty.Zero {
			return cty.NilVal, function.NewArgErrorf(2, "step must not be zero")
		}
		down := step.LessThan(cty.Zero).True()

		if down {
			if end.GreaterThan(start).True() {
				return cty.NilVal, function.NewArgErrorf(1, "end must be less than start when step is negative")
			}
		} else {
			if end.LessThan(start).True() {
				return cty.NilVal, function.NewArgErrorf(1, "end must be greater than start when step is positive")
			}
		}

		num := start
		for {
			if down {
				if num.LessThanOrEqualTo(end).True() {
					break
				}
			} else {
				if num.GreaterThanOrEqualTo(end).True() {
					break
				}
			}
			if len(vals) >= 1024 {
				// Artificial limit to prevent bad arguments from consuming huge amounts of memory
				return cty.NilVal, fmt.Errorf("more than 1024 values were generated; either decrease the difference between start and end or use a smaller step")
			}
			vals = append(vals, num)
			num = num.Add(step)
		}
		if len(vals) == 0 {
			return cty.ListValEmpty(cty.Number), nil
		}
		return cty.ListVal(vals), nil
	},
})

// Concat takes one or more sequences (lists or tuples) and returns the single
// sequence that results from concatenating them together in order.
//
// If all of the given sequences are lists of the same element type then the
// result is a list of that type. Otherwise, the result is a of a tuple type
// constructed from the given sequence types.
func Concat(seqs ...cty.Value) (cty.Value, error) {
	return ConcatFunc.Call(seqs)
}

// Range creates a list of numbers by starting from the given starting value,
// then adding the given step value until the result is greater than or
// equal to the given stopping value. Each intermediate result becomes an
// element in the resulting list.
//
// When all three parameters are set, the order is (start, end, step). If
// only two parameters are set, they are the start and end respectively and
// step defaults to 1. If only one argument is set, it gives the end value
// with start defaulting to 0 and step defaulting to 1.
//
// Because the resulting list must be fully buffered in memory, there is an
// artificial cap of 1024 elements, after which this function will return
// an error to avoid consuming unbounded amounts of memory. The Range function
// is primarily intended for creating small lists of indices to iterate over,
// so there should be no reason to generate huge lists with it.
func Range(params ...cty.Value) (cty.Value, error) {
	return RangeFunc.Call(params)
}
