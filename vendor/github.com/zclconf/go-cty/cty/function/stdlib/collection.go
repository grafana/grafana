package stdlib

import (
	"errors"
	"fmt"
	"sort"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/convert"
	"github.com/zclconf/go-cty/cty/function"
	"github.com/zclconf/go-cty/cty/gocty"
)

var HasIndexFunc = function.New(&function.Spec{
	Description: `Returns true if if the given collection can be indexed with the given key without producing an error, or false otherwise.`,
	Params: []function.Parameter{
		{
			Name:             "collection",
			Type:             cty.DynamicPseudoType,
			AllowDynamicType: true,
		},
		{
			Name:             "key",
			Type:             cty.DynamicPseudoType,
			AllowDynamicType: true,
		},
	},
	Type: func(args []cty.Value) (ret cty.Type, err error) {
		collTy := args[0].Type()
		if !(collTy.IsTupleType() || collTy.IsListType() || collTy.IsMapType() || collTy == cty.DynamicPseudoType) {
			return cty.NilType, fmt.Errorf("collection must be a list, a map or a tuple")
		}
		return cty.Bool, nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		return args[0].HasIndex(args[1]), nil
	},
})

var IndexFunc = function.New(&function.Spec{
	Description: `Returns the element with the given key from the given collection, or raises an error if there is no such element.`,
	Params: []function.Parameter{
		{
			Name: "collection",
			Type: cty.DynamicPseudoType,
		},
		{
			Name:             "key",
			Type:             cty.DynamicPseudoType,
			AllowDynamicType: true,
		},
	},
	Type: func(args []cty.Value) (ret cty.Type, err error) {
		collTy := args[0].Type()
		key := args[1]
		keyTy := key.Type()
		switch {
		case collTy.IsTupleType():
			if keyTy != cty.Number && keyTy != cty.DynamicPseudoType {
				return cty.NilType, fmt.Errorf("key for tuple must be number")
			}
			if !key.IsKnown() {
				return cty.DynamicPseudoType, nil
			}
			var idx int
			err := gocty.FromCtyValue(key, &idx)
			if err != nil {
				return cty.NilType, fmt.Errorf("invalid key for tuple: %s", err)
			}

			etys := collTy.TupleElementTypes()

			if idx >= len(etys) || idx < 0 {
				return cty.NilType, fmt.Errorf("key must be between 0 and %d inclusive", len(etys))
			}

			return etys[idx], nil

		case collTy.IsListType():
			if keyTy != cty.Number && keyTy != cty.DynamicPseudoType {
				return cty.NilType, fmt.Errorf("key for list must be number")
			}

			return collTy.ElementType(), nil

		case collTy.IsMapType():
			if keyTy != cty.String && keyTy != cty.DynamicPseudoType {
				return cty.NilType, fmt.Errorf("key for map must be string")
			}

			return collTy.ElementType(), nil

		default:
			return cty.NilType, fmt.Errorf("collection must be a list, a map or a tuple")
		}
	},
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		has, err := HasIndex(args[0], args[1])
		if err != nil {
			return cty.NilVal, err
		}
		if has.False() { // safe because collection and key are guaranteed known here
			return cty.NilVal, fmt.Errorf("invalid index")
		}

		return args[0].Index(args[1]), nil
	},
})

var LengthFunc = function.New(&function.Spec{
	Description: `Returns the number of elements in the given collection.`,
	Params: []function.Parameter{
		{
			Name:             "collection",
			Type:             cty.DynamicPseudoType,
			AllowDynamicType: true,
			AllowUnknown:     true,
			AllowMarked:      true,
		},
	},
	Type: func(args []cty.Value) (ret cty.Type, err error) {
		collTy := args[0].Type()
		if !(collTy.IsTupleType() || collTy.IsListType() || collTy.IsMapType() || collTy.IsSetType() || collTy == cty.DynamicPseudoType) {
			return cty.NilType, fmt.Errorf("collection must be a list, a map or a tuple")
		}
		return cty.Number, nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		return args[0].Length(), nil
	},
})

var ElementFunc = function.New(&function.Spec{
	Description: `Returns the element with the given index from the given list or tuple, applying the modulo operation to the given index if it's greater than the number of elements.`,
	Params: []function.Parameter{
		{
			Name:        "list",
			Type:        cty.DynamicPseudoType,
			AllowMarked: true,
		},
		{
			Name: "index",
			Type: cty.Number,
		},
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		list := args[0]

		listTy := list.Type()
		switch {
		case listTy.IsListType():
			return listTy.ElementType(), nil
		case listTy.IsTupleType():
			if !args[1].IsKnown() {
				// If the index isn't known yet then we can't predict the
				// result type since each tuple element can have its own type.
				return cty.DynamicPseudoType, nil
			}

			etys := listTy.TupleElementTypes()
			var index int
			err := gocty.FromCtyValue(args[1], &index)
			if err != nil {
				// e.g. fractional number where whole number is required
				return cty.DynamicPseudoType, fmt.Errorf("invalid index: %s", err)
			}
			if len(etys) == 0 {
				return cty.DynamicPseudoType, errors.New("cannot use element function with an empty list")
			}
			index = index % len(etys)
			if index < 0 {
				index += len(etys)
			}
			return etys[index], nil
		default:
			return cty.DynamicPseudoType, fmt.Errorf("cannot read elements from %s", listTy.FriendlyName())
		}
	},
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		var index int
		err := gocty.FromCtyValue(args[1], &index)
		if err != nil {
			// can't happen because we checked this in the Type function above
			return cty.DynamicVal, fmt.Errorf("invalid index: %s", err)
		}

		input, marks := args[0].Unmark()
		if !input.IsKnown() {
			return cty.UnknownVal(retType), nil
		}

		l := input.LengthInt()
		if l == 0 {
			return cty.DynamicVal, errors.New("cannot use element function with an empty list")
		}
		index = index % l
		if index < 0 {
			index += l
		}

		// We did all the necessary type checks in the type function above,
		// so this is guaranteed not to fail.
		return input.Index(cty.NumberIntVal(int64(index))).WithMarks(marks), nil
	},
})

// CoalesceListFunc is a function that takes any number of list arguments
// and returns the first one that isn't empty.
var CoalesceListFunc = function.New(&function.Spec{
	Description: `Returns the first of the given sequences that has a length greater than zero.`,
	Params:      []function.Parameter{},
	VarParam: &function.Parameter{
		Name:             "vals",
		Description:      `List or tuple values to test in the given order.`,
		Type:             cty.DynamicPseudoType,
		AllowUnknown:     true,
		AllowDynamicType: true,
		AllowNull:        true,
	},
	Type: func(args []cty.Value) (ret cty.Type, err error) {
		if len(args) == 0 {
			return cty.NilType, errors.New("at least one argument is required")
		}

		argTypes := make([]cty.Type, len(args))

		for i, arg := range args {
			// if any argument is unknown, we can't be certain know which type we will return
			if !arg.IsKnown() {
				return cty.DynamicPseudoType, nil
			}
			ty := arg.Type()

			if !ty.IsListType() && !ty.IsTupleType() {
				return cty.NilType, errors.New("coalescelist arguments must be lists or tuples")
			}

			argTypes[i] = arg.Type()
		}

		last := argTypes[0]
		// If there are mixed types, we have to return a dynamic type.
		for _, next := range argTypes[1:] {
			if !next.Equals(last) {
				return cty.DynamicPseudoType, nil
			}
		}

		return last, nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		for _, arg := range args {
			if !arg.IsKnown() {
				// If we run into an unknown list at some point, we can't
				// predict the final result yet. (If there's a known, non-empty
				// arg before this then we won't get here.)
				return cty.UnknownVal(retType), nil
			}

			if arg.IsNull() {
				continue
			}

			if arg.LengthInt() > 0 {
				return arg, nil
			}
		}

		return cty.NilVal, errors.New("no non-null arguments")
	},
})

// CompactFunc is a function that takes a list of strings and returns a new list
// with any empty string elements removed.
var CompactFunc = function.New(&function.Spec{
	Description: `Removes all empty string elements from the given list of strings.`,
	Params: []function.Parameter{
		{
			Name: "list",
			Type: cty.List(cty.String),
		},
	},
	Type:         function.StaticReturnType(cty.List(cty.String)),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		listVal := args[0]
		if !listVal.IsWhollyKnown() {
			// If some of the element values aren't known yet then we
			// can't yet return a compacted list
			return cty.UnknownVal(retType), nil
		}

		var outputList []cty.Value

		for it := listVal.ElementIterator(); it.Next(); {
			_, v := it.Element()
			if v.IsNull() || v.AsString() == "" {
				continue
			}
			outputList = append(outputList, v)
		}

		if len(outputList) == 0 {
			return cty.ListValEmpty(cty.String), nil
		}

		return cty.ListVal(outputList), nil
	},
})

// ContainsFunc is a function that determines whether a given list or
// set contains a given single value as one of its elements.
var ContainsFunc = function.New(&function.Spec{
	Description: `Returns true if the given value is a value in the given list, tuple, or set, or false otherwise.`,
	Params: []function.Parameter{
		{
			Name: "list",
			Type: cty.DynamicPseudoType,
		},
		{
			Name: "value",
			Type: cty.DynamicPseudoType,
		},
	},
	Type:         function.StaticReturnType(cty.Bool),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		arg := args[0]
		ty := arg.Type()

		if !ty.IsListType() && !ty.IsTupleType() && !ty.IsSetType() {
			return cty.NilVal, errors.New("argument must be list, tuple, or set")
		}

		if args[0].IsNull() {
			return cty.NilVal, errors.New("cannot search a nil list or set")
		}

		if args[0].LengthInt() == 0 {
			return cty.False, nil
		}

		if !args[0].IsKnown() || !args[1].IsKnown() {
			return cty.UnknownVal(cty.Bool), nil
		}

		containsUnknown := false
		for it := args[0].ElementIterator(); it.Next(); {
			_, v := it.Element()
			eq := args[1].Equals(v)
			if !eq.IsKnown() {
				// We may have an unknown value which could match later, but we
				// first need to continue checking all values for an exact
				// match.
				containsUnknown = true
				continue
			}
			if eq.True() {
				return cty.True, nil
			}
		}

		if containsUnknown {
			return cty.UnknownVal(cty.Bool), nil
		}

		return cty.False, nil
	},
})

// DistinctFunc is a function that takes a list and returns a new list
// with any duplicate elements removed.
var DistinctFunc = function.New(&function.Spec{
	Description: `Removes any duplicate values from the given list, preserving the order of remaining elements.`,
	Params: []function.Parameter{
		{
			Name: "list",
			Type: cty.List(cty.DynamicPseudoType),
		},
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		return args[0].Type(), nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		listVal := args[0]

		if !listVal.IsWhollyKnown() {
			return cty.UnknownVal(retType), nil
		}
		var list []cty.Value

		for it := listVal.ElementIterator(); it.Next(); {
			_, v := it.Element()
			list, err = appendIfMissing(list, v)
			if err != nil {
				return cty.NilVal, err
			}
		}

		if len(list) == 0 {
			return cty.ListValEmpty(retType.ElementType()), nil
		}
		return cty.ListVal(list), nil
	},
})

// ChunklistFunc is a function that splits a single list into fixed-size chunks,
// returning a list of lists.
var ChunklistFunc = function.New(&function.Spec{
	Description: `Splits a single list into multiple lists where each has at most the given number of elements.`,
	Params: []function.Parameter{
		{
			Name:        "list",
			Description: `The list to split into chunks.`,
			Type:        cty.List(cty.DynamicPseudoType),
			AllowMarked: true,
		},
		{
			Name:        "size",
			Description: `The maximum length of each chunk. All but the last element of the result is guaranteed to be of exactly this size.`,
			Type:        cty.Number,
			AllowMarked: true,
		},
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		return cty.List(args[0].Type()), nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		listVal := args[0]
		sizeVal := args[1]
		listVal, listMarks := listVal.Unmark()
		sizeVal, sizeMarks := sizeVal.Unmark()
		// All return paths below must include .WithMarks(retMarks) to propagate
		// the top-level marks into the return value. Deep marks inside the
		// list will just propagate naturally because we treat those values
		// as opaque here.
		retMarks := cty.NewValueMarks(listMarks, sizeMarks)

		var size int
		err = gocty.FromCtyValue(sizeVal, &size)
		if err != nil {
			return cty.NilVal, fmt.Errorf("invalid size: %s", err)
		}

		if size < 0 {
			return cty.NilVal, errors.New("the size argument must be positive")
		}

		if listVal.LengthInt() == 0 {
			return cty.ListValEmpty(listVal.Type()).WithMarks(retMarks), nil
		}

		output := make([]cty.Value, 0)

		// if size is 0, returns a list made of the initial list
		if size == 0 {
			output = append(output, listVal)
			return cty.ListVal(output).WithMarks(retMarks), nil
		}

		chunk := make([]cty.Value, 0)

		l := listVal.LengthInt()
		i := 0

		for it := listVal.ElementIterator(); it.Next(); {
			_, v := it.Element()
			chunk = append(chunk, v)

			// Chunk when index isn't 0, or when reaching the values's length
			if (i+1)%size == 0 || (i+1) == l {
				output = append(output, cty.ListVal(chunk))
				chunk = make([]cty.Value, 0)
			}
			i++
		}

		return cty.ListVal(output).WithMarks(retMarks), nil
	},
})

// FlattenFunc is a function that takes a list and replaces any elements
// that are lists with a flattened sequence of the list contents.
var FlattenFunc = function.New(&function.Spec{
	Description: `Transforms a list, set, or tuple value into a tuple by replacing any given elements that are themselves sequences with a flattened tuple of all of the nested elements concatenated together.`,
	Params: []function.Parameter{
		{
			Name:        "list",
			Type:        cty.DynamicPseudoType,
			AllowMarked: true,
		},
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		if !args[0].IsWhollyKnown() {
			return cty.DynamicPseudoType, nil
		}

		argTy := args[0].Type()
		if !argTy.IsListType() && !argTy.IsSetType() && !argTy.IsTupleType() {
			return cty.NilType, errors.New("can only flatten lists, sets and tuples")
		}

		// marks are attached to values, so ignore while determining type
		retVal, _, known := flattener(args[0])
		if !known {
			return cty.DynamicPseudoType, nil
		}

		tys := make([]cty.Type, len(retVal))
		for i, ty := range retVal {
			tys[i] = ty.Type()
		}
		return cty.Tuple(tys), nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		inputList := args[0]

		if unmarked, marks := inputList.Unmark(); unmarked.LengthInt() == 0 {
			return cty.EmptyTupleVal.WithMarks(marks), nil
		}

		out, markses, known := flattener(inputList)
		if !known {
			return cty.UnknownVal(retType).WithMarks(markses...), nil
		}

		return cty.TupleVal(out).WithMarks(markses...), nil
	},
})

// Flatten until it's not a cty.List, and return whether the value is known.
// We can flatten lists with unknown values, as long as they are not
// lists themselves.
func flattener(flattenList cty.Value) ([]cty.Value, []cty.ValueMarks, bool) {
	var markses []cty.ValueMarks
	flattenList, flattenListMarks := flattenList.Unmark()
	if len(flattenListMarks) > 0 {
		markses = append(markses, flattenListMarks)
	}

	if !flattenList.Length().IsKnown() {
		// If we don't know the length of what we're flattening then we can't
		// predict the length of our result yet either.
		return nil, markses, false
	}

	out := make([]cty.Value, 0)
	isKnown := true
	for it := flattenList.ElementIterator(); it.Next(); {
		_, val := it.Element()

		// Any dynamic types could result in more collections that need to be
		// flattened, so the type cannot be known.
		if val == cty.DynamicVal {
			isKnown = false
		}

		if !val.IsNull() && (val.Type().IsListType() || val.Type().IsSetType() || val.Type().IsTupleType()) {
			if !val.IsKnown() {
				isKnown = false
				_, unknownMarks := val.Unmark()
				markses = append(markses, unknownMarks)
				continue
			}

			res, resMarks, known := flattener(val)
			markses = append(markses, resMarks...)
			if known {
				out = append(out, res...)
			} else {
				isKnown = false
			}
		} else {
			out = append(out, val)
		}
	}
	return out, markses, isKnown
}

// KeysFunc is a function that takes a map and returns a sorted list of the map keys.
var KeysFunc = function.New(&function.Spec{
	Description: `Returns a list of the keys of the given map in lexicographical order.`,
	Params: []function.Parameter{
		{
			Name:         "inputMap",
			Description:  `The map to extract keys from. May instead be an object-typed value, in which case the result is a tuple of the object attributes.`,
			Type:         cty.DynamicPseudoType,
			AllowUnknown: true,
			AllowMarked:  true,
		},
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		ty := args[0].Type()
		switch {
		case ty.IsMapType():
			return cty.List(cty.String), nil
		case ty.IsObjectType():
			atys := ty.AttributeTypes()
			if len(atys) == 0 {
				return cty.EmptyTuple, nil
			}
			// All of our result elements will be strings, and atys just
			// decides how many there are.
			etys := make([]cty.Type, len(atys))
			for i := range etys {
				etys[i] = cty.String
			}
			return cty.Tuple(etys), nil
		default:
			return cty.DynamicPseudoType, function.NewArgErrorf(0, "must have map or object type")
		}
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		// We must unmark the value before we can use ElementIterator on it, and
		// then re-apply the same marks (possibly none) when we return. Since we
		// don't mark map keys, we can throw away any nested marks, which would
		// only apply to values.
		m, marks := args[0].Unmark()
		var keys []cty.Value

		switch {
		case m.Type().IsObjectType():
			// In this case we allow unknown values so we must work only with
			// the attribute _types_, not with the value itself.
			var names []string
			for name := range m.Type().AttributeTypes() {
				names = append(names, name)
			}
			sort.Strings(names) // same ordering guaranteed by cty's ElementIterator
			if len(names) == 0 {
				return cty.EmptyTupleVal.WithMarks(marks), nil
			}
			keys = make([]cty.Value, len(names))
			for i, name := range names {
				keys[i] = cty.StringVal(name)
			}
			return cty.TupleVal(keys).WithMarks(marks), nil
		default:
			if !m.IsKnown() {
				return cty.UnknownVal(retType).WithMarks(marks), nil
			}

			// cty guarantees that ElementIterator will iterate in lexicographical
			// order by key.
			for it := m.ElementIterator(); it.Next(); {
				k, _ := it.Element()
				keys = append(keys, k)
			}
			if len(keys) == 0 {
				return cty.ListValEmpty(cty.String).WithMarks(marks), nil
			}
			return cty.ListVal(keys).WithMarks(marks), nil
		}
	},
})

// LookupFunc is a function that performs dynamic lookups of map types.
var LookupFunc = function.New(&function.Spec{
	Description: `Returns the value of the element with the given key from the given map, or returns the default value if there is no such element.`,
	Params: []function.Parameter{
		{
			Name:        "inputMap",
			Type:        cty.DynamicPseudoType,
			AllowMarked: true,
		},
		{
			Name:        "key",
			Type:        cty.String,
			AllowMarked: true,
		},
		{
			Name:        "default",
			Type:        cty.DynamicPseudoType,
			AllowMarked: true,
		},
	},
	Type: func(args []cty.Value) (ret cty.Type, err error) {
		ty := args[0].Type()

		switch {
		case ty.IsObjectType():
			if !args[1].IsKnown() {
				return cty.DynamicPseudoType, nil
			}

			keyVal, _ := args[1].Unmark()
			key := keyVal.AsString()
			if ty.HasAttribute(key) {
				return args[0].GetAttr(key).Type(), nil
			} else if len(args) == 3 {
				// if the key isn't found but a default is provided,
				// return the default type
				return args[2].Type(), nil
			}
			return cty.DynamicPseudoType, function.NewArgErrorf(0, "the given object has no attribute %q", key)
		case ty.IsMapType():
			if len(args) == 3 {
				_, err = convert.Convert(args[2], ty.ElementType())
				if err != nil {
					return cty.NilType, function.NewArgErrorf(2, "the default value must have the same type as the map elements")
				}
			}
			return ty.ElementType(), nil
		default:
			return cty.NilType, function.NewArgErrorf(0, "lookup() requires a map as the first argument")
		}
	},
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		// leave default value marked
		defaultVal := args[2]

		var markses []cty.ValueMarks

		// unmark collection, retain marks to reapply later
		mapVar, mapMarks := args[0].Unmark()
		markses = append(markses, mapMarks)

		// include marks on the key in the result
		keyVal, keyMarks := args[1].Unmark()
		if len(keyMarks) > 0 {
			markses = append(markses, keyMarks)
		}
		lookupKey := keyVal.AsString()

		if !mapVar.IsWhollyKnown() {
			return cty.UnknownVal(retType).WithMarks(markses...), nil
		}

		if mapVar.Type().IsObjectType() {
			if mapVar.Type().HasAttribute(lookupKey) {
				return mapVar.GetAttr(lookupKey).WithMarks(markses...), nil
			}
		} else if mapVar.HasIndex(cty.StringVal(lookupKey)) == cty.True {
			return mapVar.Index(cty.StringVal(lookupKey)).WithMarks(markses...), nil
		}

		defaultVal, err = convert.Convert(defaultVal, retType)
		if err != nil {
			return cty.NilVal, err
		}
		return defaultVal.WithMarks(markses...), nil
	},
})

// MergeFunc constructs a function that takes an arbitrary number of maps or
// objects, and returns a single value that contains a merged set of keys and
// values from all of the inputs.
//
// If more than one given map or object defines the same key then the one that
// is later in the argument sequence takes precedence.
var MergeFunc = function.New(&function.Spec{
	Description: `Merges all of the elements from the given maps into a single map, or the attributes from given objects into a single object.`,
	Params:      []function.Parameter{},
	VarParam: &function.Parameter{
		Name:             "maps",
		Type:             cty.DynamicPseudoType,
		AllowDynamicType: true,
		AllowNull:        true,
		AllowMarked:      true,
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		// empty args is accepted, so assume an empty object since we have no
		// key-value types.
		if len(args) == 0 {
			return cty.EmptyObject, nil
		}

		// collect the possible object attrs
		attrs := map[string]cty.Type{}

		first := cty.NilType
		matching := true
		attrsKnown := true
		for i, arg := range args {
			ty := arg.Type()
			// any dynamic args mean we can't compute a type
			if ty.Equals(cty.DynamicPseudoType) {
				return cty.DynamicPseudoType, nil
			}

			// check for invalid arguments
			if !ty.IsMapType() && !ty.IsObjectType() {
				return cty.NilType, fmt.Errorf("arguments must be maps or objects, got %#v", ty.FriendlyName())
			}
			// marks are attached to values, so ignore while determining type
			arg, _ = arg.Unmark()

			switch {
			case ty.IsObjectType() && !arg.IsNull():
				for attr, aty := range ty.AttributeTypes() {
					attrs[attr] = aty
				}
			case ty.IsMapType():
				switch {
				case arg.IsNull():
					// pass, nothing to add
				case arg.IsKnown():
					ety := arg.Type().ElementType()
					for it := arg.ElementIterator(); it.Next(); {
						attr, _ := it.Element()
						attrs[attr.AsString()] = ety
					}
				default:
					// any unknown maps means we don't know all possible attrs
					// for the return type
					attrsKnown = false
				}
			}

			// record the first argument type for comparison
			if i == 0 {
				first = arg.Type()
				continue
			}

			if !ty.Equals(first) && matching {
				matching = false
			}
		}

		// the types all match, so use the first argument type
		if matching {
			return first, nil
		}

		// We had a mix of unknown maps and objects, so we can't predict the
		// attributes
		if !attrsKnown {
			return cty.DynamicPseudoType, nil
		}

		return cty.Object(attrs), nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		outputMap := make(map[string]cty.Value)
		var markses []cty.ValueMarks // remember any marked maps/objects we find

		for _, arg := range args {
			if arg.IsNull() {
				continue
			}
			arg, argMarks := arg.Unmark()
			if len(argMarks) > 0 {
				markses = append(markses, argMarks)
			}
			for it := arg.ElementIterator(); it.Next(); {
				k, v := it.Element()
				outputMap[k.AsString()] = v
			}
		}

		switch {
		case retType.IsMapType():
			if len(outputMap) == 0 {
				return cty.MapValEmpty(retType.ElementType()).WithMarks(markses...), nil
			}
			return cty.MapVal(outputMap).WithMarks(markses...), nil
		case retType.IsObjectType(), retType.Equals(cty.DynamicPseudoType):
			return cty.ObjectVal(outputMap).WithMarks(markses...), nil
		default:
			panic(fmt.Sprintf("unexpected return type: %#v", retType))
		}
	},
})

// ReverseListFunc takes a sequence and produces a new sequence of the same length
// with all of the same elements as the given sequence but in reverse order.
var ReverseListFunc = function.New(&function.Spec{
	Description: `Returns the given list with its elements in reverse order.`,
	Params: []function.Parameter{
		{
			Name:        "list",
			Type:        cty.DynamicPseudoType,
			AllowMarked: true,
		},
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		argTy := args[0].Type()
		switch {
		case argTy.IsTupleType():
			argTys := argTy.TupleElementTypes()
			retTys := make([]cty.Type, len(argTys))
			for i, ty := range argTys {
				retTys[len(retTys)-i-1] = ty
			}
			return cty.Tuple(retTys), nil
		case argTy.IsListType(), argTy.IsSetType(): // We accept sets here to mimic the usual behavior of auto-converting to list
			return cty.List(argTy.ElementType()), nil
		default:
			return cty.NilType, function.NewArgErrorf(0, "can only reverse list or tuple values, not %s", argTy.FriendlyName())
		}
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		in, marks := args[0].Unmark()
		inVals := in.AsValueSlice()
		outVals := make([]cty.Value, len(inVals))

		for i, v := range inVals {
			outVals[len(outVals)-i-1] = v
		}
		switch {
		case retType.IsTupleType():
			return cty.TupleVal(outVals).WithMarks(marks), nil
		default:
			if len(outVals) == 0 {
				return cty.ListValEmpty(retType.ElementType()).WithMarks(marks), nil
			}
			return cty.ListVal(outVals).WithMarks(marks), nil
		}
	},
})

// SetProductFunc calculates the Cartesian product of two or more sets or
// sequences. If the arguments are all lists then the result is a list of tuples,
// preserving the ordering of all of the input lists. Otherwise the result is a
// set of tuples.
var SetProductFunc = function.New(&function.Spec{
	Description: `Calculates the cartesian product of two or more sets.`,
	Params:      []function.Parameter{},
	VarParam: &function.Parameter{
		Name:         "sets",
		Description:  "The sets to consider. Also accepts lists and tuples, and if all arguments are of list or tuple type then the result will preserve the input ordering",
		Type:         cty.DynamicPseudoType,
		AllowMarked:  true,
		AllowUnknown: true,
	},
	Type: func(args []cty.Value) (retType cty.Type, err error) {
		if len(args) < 2 {
			return cty.NilType, errors.New("at least two arguments are required")
		}

		listCount := 0
		elemTys := make([]cty.Type, len(args))
		for i, arg := range args {
			aty := arg.Type()
			switch {
			case aty.IsSetType():
				elemTys[i] = aty.ElementType()
			case aty.IsListType():
				elemTys[i] = aty.ElementType()
				listCount++
			case aty.IsTupleType():
				// We can accept a tuple type only if there's some common type
				// that all of its elements can be converted to.
				allEtys := aty.TupleElementTypes()
				if len(allEtys) == 0 {
					elemTys[i] = cty.DynamicPseudoType
					listCount++
					break
				}
				ety, _ := convert.UnifyUnsafe(allEtys)
				if ety == cty.NilType {
					return cty.NilType, function.NewArgErrorf(i, "all elements must be of the same type")
				}
				elemTys[i] = ety
				listCount++
			default:
				return cty.NilType, function.NewArgErrorf(i, "a set or a list is required")
			}
		}

		if listCount == len(args) {
			return cty.List(cty.Tuple(elemTys)), nil
		}
		return cty.Set(cty.Tuple(elemTys)), nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		ety := retType.ElementType()
		var retMarks cty.ValueMarks

		total := 1
		var hasUnknownLength bool
		for _, arg := range args {
			arg, marks := arg.Unmark()
			retMarks = cty.NewValueMarks(retMarks, marks)

			// Continue processing after we find an argument with unknown
			// length to ensure that we cover all the marks
			if !(arg.IsKnown() && arg.Length().IsKnown()) {
				hasUnknownLength = true
				continue
			}

			// Because of our type checking function, we are guaranteed that
			// all of the arguments are known, non-null values of types that
			// support LengthInt.
			total *= arg.LengthInt()
		}

		if hasUnknownLength {
			defer func() {
				// We're definitely going to return from somewhere in this
				// branch and however we do it we must reapply the marks
				// on the way out.
				ret = ret.WithMarks(retMarks)
			}()
			ret := cty.UnknownVal(retType)

			// Even if we don't know the exact length we may be able to
			// constrain the upper and lower bounds of the resulting length.
			maxLength := 1
			for _, arg := range args {
				arg, _ := arg.Unmark() // safe to discard marks because "retMarks" already contains them all
				argRng := arg.Range()
				ty := argRng.TypeConstraint()
				var argMaxLen int
				if ty.IsCollectionType() {
					argMaxLen = argRng.LengthUpperBound()
				} else if ty.IsTupleType() {
					argMaxLen = ty.Length()
				} else {
					// Should not get here but if we do then we'll just
					// bail out with an unrefined unknown value.
					return ret, nil
				}
				// The upper bound of a totally-unrefined collection is
				// math.MaxInt, which will quickly get us to integer overflow
				// here, and so out of pragmatism we'll just impose a reasonable
				// upper limit on what is a useful bound to track and return
				// unrefined for unusually-large input.
				if argMaxLen > 1024 { // arbitrarily-decided threshold
					return ret, nil
				}
				maxLength *= argMaxLen
				if maxLength > 2048 { // arbitrarily-decided threshold
					return ret, nil
				}
				if maxLength < 0 { // Seems like we already overflowed, then.
					return ret, nil
				}
			}

			if maxLength == 0 {
				// This refinement will typically allow the unknown value to
				// collapse into a known empty collection.
				ret = ret.Refine().CollectionLength(0).NewValue()
			} else {
				// If we know there's a nonzero maximum number of elements then
				// set element coalescing cannot reduce to fewer than one
				// element.
				ret = ret.Refine().
					CollectionLengthLowerBound(1).
					CollectionLengthUpperBound(maxLength).
					NewValue()
			}
			return ret, nil
		}

		if total == 0 {
			// If any of the arguments was an empty collection then our result
			// is also an empty collection, which we'll short-circuit here.
			if retType.IsListType() {
				return cty.ListValEmpty(ety).WithMarks(retMarks), nil
			}
			return cty.SetValEmpty(ety).WithMarks(retMarks), nil
		}

		subEtys := ety.TupleElementTypes()
		product := make([][]cty.Value, total)

		b := make([]cty.Value, total*len(args))
		n := make([]int, len(args))
		s := 0
		argVals := make([][]cty.Value, len(args))
		for i, arg := range args {
			// We've already stored the marks in retMarks
			arg, _ := arg.Unmark()
			argVals[i] = arg.AsValueSlice()
		}

		for i := range product {
			e := s + len(args)
			pi := b[s:e]
			product[i] = pi
			s = e

			for j, n := range n {
				val := argVals[j][n]
				ty := subEtys[j]
				if !val.Type().Equals(ty) {
					var err error
					val, err = convert.Convert(val, ty)
					if err != nil {
						// Should never happen since we checked this in our
						// type-checking function.
						return cty.NilVal, fmt.Errorf("failed to convert argVals[%d][%d] to %s; this is a bug in cty", j, n, ty.FriendlyName())
					}
				}
				pi[j] = val
			}

			for j := len(n) - 1; j >= 0; j-- {
				n[j]++
				if n[j] < len(argVals[j]) {
					break
				}
				n[j] = 0
			}
		}

		productVals := make([]cty.Value, total)
		for i, vals := range product {
			productVals[i] = cty.TupleVal(vals)
		}

		if retType.IsListType() {
			return cty.ListVal(productVals).WithMarks(retMarks), nil
		}
		return cty.SetVal(productVals).WithMarks(retMarks), nil
	},
})

// SliceFunc is a function that extracts some consecutive elements
// from within a list.
var SliceFunc = function.New(&function.Spec{
	Description: `Extracts a subslice of the given list or tuple value.`,
	Params: []function.Parameter{
		{
			Name:        "list",
			Type:        cty.DynamicPseudoType,
			AllowMarked: true,
		},
		{
			Name: "start_index",
			Type: cty.Number,
		},
		{
			Name: "end_index",
			Type: cty.Number,
		},
	},
	Type: func(args []cty.Value) (cty.Type, error) {
		arg := args[0]
		argTy := arg.Type()

		if argTy.IsSetType() {
			return cty.NilType, function.NewArgErrorf(0, "cannot slice a set, because its elements do not have indices; explicitly convert to a list if the ordering of the result is not important")
		}
		if !argTy.IsListType() && !argTy.IsTupleType() {
			return cty.NilType, function.NewArgErrorf(0, "must be a list or tuple value")
		}

		startIndex, endIndex, idxsKnown, err := sliceIndexes(args)
		if err != nil {
			return cty.NilType, err
		}

		if argTy.IsListType() {
			return argTy, nil
		}

		if !idxsKnown {
			// If we don't know our start/end indices then we can't predict
			// the result type if we're planning to return a tuple.
			return cty.DynamicPseudoType, nil
		}
		return cty.Tuple(argTy.TupleElementTypes()[startIndex:endIndex]), nil
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		inputList, marks := args[0].Unmark()

		if retType == cty.DynamicPseudoType {
			return cty.DynamicVal.WithMarks(marks), nil
		}

		// we ignore idxsKnown return value here because the indices are always
		// known here, or else the call would've short-circuited.
		startIndex, endIndex, _, err := sliceIndexes(args)
		if err != nil {
			return cty.NilVal, err
		}

		if endIndex-startIndex == 0 {
			if retType.IsTupleType() {
				return cty.EmptyTupleVal.WithMarks(marks), nil
			}
			return cty.ListValEmpty(retType.ElementType()).WithMarks(marks), nil
		}

		outputList := inputList.AsValueSlice()[startIndex:endIndex]

		if retType.IsTupleType() {
			return cty.TupleVal(outputList).WithMarks(marks), nil
		}

		return cty.ListVal(outputList).WithMarks(marks), nil
	},
})

func sliceIndexes(args []cty.Value) (int, int, bool, error) {
	var startIndex, endIndex, length int
	var startKnown, endKnown, lengthKnown bool

	// remove marks from args[0]
	list, _ := args[0].Unmark()

	// If it's a tuple then we always know the length by the type, but collections might be unknown or have unknown length
	if list.Type().IsTupleType() || list.Length().IsKnown() {
		length = list.LengthInt()
		lengthKnown = true
	}

	if args[1].IsKnown() {
		if err := gocty.FromCtyValue(args[1], &startIndex); err != nil {
			return 0, 0, false, function.NewArgErrorf(1, "invalid start index: %s", err)
		}
		if startIndex < 0 {
			return 0, 0, false, function.NewArgErrorf(1, "start index must not be less than zero")
		}
		if lengthKnown && startIndex > length {
			return 0, 0, false, function.NewArgErrorf(1, "start index must not be greater than the length of the list")
		}
		startKnown = true
	}
	if args[2].IsKnown() {
		if err := gocty.FromCtyValue(args[2], &endIndex); err != nil {
			return 0, 0, false, function.NewArgErrorf(2, "invalid end index: %s", err)
		}
		if endIndex < 0 {
			return 0, 0, false, function.NewArgErrorf(2, "end index must not be less than zero")
		}
		if lengthKnown && endIndex > length {
			return 0, 0, false, function.NewArgErrorf(2, "end index must not be greater than the length of the list")
		}
		endKnown = true
	}
	if startKnown && endKnown {
		if startIndex > endIndex {
			return 0, 0, false, function.NewArgErrorf(1, "start index must not be greater than end index")
		}
	}
	return startIndex, endIndex, startKnown && endKnown, nil
}

// ValuesFunc is a function that returns a list of the map values,
// in the order of the sorted keys.
var ValuesFunc = function.New(&function.Spec{
	Description: `Returns the values of elements of a given map, or the values of attributes of a given object, in lexicographic order by key or attribute name.`,
	Params: []function.Parameter{
		{
			Name:        "mapping",
			Type:        cty.DynamicPseudoType,
			AllowMarked: true,
		},
	},
	Type: func(args []cty.Value) (ret cty.Type, err error) {
		ty := args[0].Type()
		if ty.IsMapType() {
			return cty.List(ty.ElementType()), nil
		} else if ty.IsObjectType() {
			// The result is a tuple type with all of the same types as our
			// object type's attributes, sorted in lexicographical order by the
			// keys. (This matches the sort order guaranteed by ElementIterator
			// on a cty object value.)
			atys := ty.AttributeTypes()
			if len(atys) == 0 {
				return cty.EmptyTuple, nil
			}
			attrNames := make([]string, 0, len(atys))
			for name := range atys {
				attrNames = append(attrNames, name)
			}
			sort.Strings(attrNames)

			tys := make([]cty.Type, len(attrNames))
			for i, name := range attrNames {
				tys[i] = atys[name]
			}
			return cty.Tuple(tys), nil
		}
		return cty.NilType, errors.New("values() requires a map as the first argument")
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		mapVar := args[0]

		// We must unmark the value before we can use ElementIterator on it,
		// and then re-apply the same marks (possibly none) when we return.
		// (We leave the inner values just as they are, because we won't be
		// doing anything with them aside from copying them verbatim into the
		// result, marks and all.)
		mapVar, marks := mapVar.Unmark()

		// We can just iterate the map/object value here because cty guarantees
		// that these types always iterate in key lexicographical order.
		var values []cty.Value
		for it := mapVar.ElementIterator(); it.Next(); {
			_, val := it.Element()
			values = append(values, val)
		}

		// All of the return paths must include .WithMarks(marks) so that we
		// will preserve the markings of the overall map/object we were given.
		if retType.IsTupleType() {
			return cty.TupleVal(values).WithMarks(marks), nil
		}
		if len(values) == 0 {
			return cty.ListValEmpty(retType.ElementType()).WithMarks(marks), nil
		}
		return cty.ListVal(values).WithMarks(marks), nil
	},
})

// ZipmapFunc is a function that constructs a map from a list of keys
// and a corresponding list of values.
var ZipmapFunc = function.New(&function.Spec{
	Description: `Constructs a map from a list of keys and a corresponding list of values, which must both be of the same length.`,
	Params: []function.Parameter{
		{
			Name:        "keys",
			Type:        cty.List(cty.String),
			AllowMarked: true,
		},
		{
			Name:        "values",
			Type:        cty.DynamicPseudoType,
			AllowMarked: true,
		},
	},
	Type: func(args []cty.Value) (ret cty.Type, err error) {
		keys := args[0]
		values := args[1]
		valuesTy := values.Type()

		switch {
		case valuesTy.IsListType():
			return cty.Map(values.Type().ElementType()), nil
		case valuesTy.IsTupleType():
			if !keys.IsWhollyKnown() {
				// Since zipmap with a tuple produces an object, we need to know
				// all of the key names before we can predict our result type.
				return cty.DynamicPseudoType, nil
			}

			// NOTE: Marking of the keys list can't be represented in the
			// result type, so the tuple type here will disclose the keys.
			// This is unfortunate but is a common compromise with dynamic
			// return types; the result from Impl will still reflect the marks
			// from the keys list, so a mark-using caller should look out for
			// that if it's important for their use-case.
			keys, _ := keys.Unmark()
			keysRaw := keys.AsValueSlice()
			valueTypesRaw := valuesTy.TupleElementTypes()
			if len(keysRaw) != len(valueTypesRaw) {
				return cty.NilType, fmt.Errorf("number of keys (%d) does not match number of values (%d)", len(keysRaw), len(valueTypesRaw))
			}
			atys := make(map[string]cty.Type, len(valueTypesRaw))
			for i, keyVal := range keysRaw {
				keyVal, _ = keyVal.Unmark()
				if keyVal.IsNull() {
					return cty.NilType, fmt.Errorf("keys list has null value at index %d", i)
				}
				key := keyVal.AsString()
				atys[key] = valueTypesRaw[i]
			}
			return cty.Object(atys), nil

		default:
			return cty.NilType, errors.New("values argument must be a list or tuple value")
		}
	},
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (ret cty.Value, err error) {
		keys := args[0]
		values := args[1]
		keys, keysMarks := keys.Unmark()
		values, valuesMarks := values.Unmark()

		// All of our return paths must pass through the merged marks from
		// both the keys and the values, if any, using .WithMarks(retMarks)
		retMarks := cty.NewValueMarks(keysMarks, valuesMarks)

		if !keys.IsWhollyKnown() {
			// Unknown map keys and object attributes are not supported, so
			// our entire result must be unknown in this case.
			return cty.UnknownVal(retType).WithMarks(retMarks), nil
		}

		// both keys and values are guaranteed to be shallowly-known here,
		// because our declared params above don't allow unknown or null values.
		if keys.LengthInt() != values.LengthInt() {
			return cty.NilVal, fmt.Errorf("number of keys (%d) does not match number of values (%d)", keys.LengthInt(), values.LengthInt())
		}

		output := make(map[string]cty.Value)

		i := 0
		for it := keys.ElementIterator(); it.Next(); {
			_, v := it.Element()
			v, vMarks := v.Unmark()
			val := values.Index(cty.NumberIntVal(int64(i)))
			output[v.AsString()] = val

			// We also need to accumulate the individual key marks on the
			// returned map, because keys can't carry marks on their own.
			retMarks = cty.NewValueMarks(retMarks, vMarks)

			i++
		}

		switch {
		case retType.IsMapType():
			if len(output) == 0 {
				return cty.MapValEmpty(retType.ElementType()).WithMarks(retMarks), nil
			}
			return cty.MapVal(output).WithMarks(retMarks), nil
		case retType.IsObjectType():
			return cty.ObjectVal(output).WithMarks(retMarks), nil
		default:
			// Should never happen because the type-check function should've
			// caught any other case.
			return cty.NilVal, fmt.Errorf("internally selected incorrect result type %s (this is a bug)", retType.FriendlyName())
		}
	},
})

// helper function to add an element to a list, if it does not already exist
func appendIfMissing(slice []cty.Value, element cty.Value) ([]cty.Value, error) {
	for _, ele := range slice {
		eq, err := Equal(ele, element)
		if err != nil {
			return slice, err
		}
		if eq.True() {
			return slice, nil
		}
	}
	return append(slice, element), nil
}

// HasIndex determines whether the given collection can be indexed with the
// given key.
func HasIndex(collection cty.Value, key cty.Value) (cty.Value, error) {
	return HasIndexFunc.Call([]cty.Value{collection, key})
}

// Index returns an element from the given collection using the given key,
// or returns an error if there is no element for the given key.
func Index(collection cty.Value, key cty.Value) (cty.Value, error) {
	return IndexFunc.Call([]cty.Value{collection, key})
}

// Length returns the number of elements in the given collection.
func Length(collection cty.Value) (cty.Value, error) {
	return LengthFunc.Call([]cty.Value{collection})
}

// Element returns a single element from a given list at the given index. If
// index is greater than the length of the list then it is wrapped modulo
// the list length.
func Element(list, index cty.Value) (cty.Value, error) {
	return ElementFunc.Call([]cty.Value{list, index})
}

// CoalesceList takes any number of list arguments and returns the first one that isn't empty.
func CoalesceList(args ...cty.Value) (cty.Value, error) {
	return CoalesceListFunc.Call(args)
}

// Compact takes a list of strings and returns a new list
// with any empty string elements removed.
func Compact(list cty.Value) (cty.Value, error) {
	return CompactFunc.Call([]cty.Value{list})
}

// Contains determines whether a given list contains a given single value
// as one of its elements.
func Contains(list, value cty.Value) (cty.Value, error) {
	return ContainsFunc.Call([]cty.Value{list, value})
}

// Distinct takes a list and returns a new list with any duplicate elements removed.
func Distinct(list cty.Value) (cty.Value, error) {
	return DistinctFunc.Call([]cty.Value{list})
}

// Chunklist splits a single list into fixed-size chunks, returning a list of lists.
func Chunklist(list, size cty.Value) (cty.Value, error) {
	return ChunklistFunc.Call([]cty.Value{list, size})
}

// Flatten takes a list and replaces any elements that are lists with a flattened
// sequence of the list contents.
func Flatten(list cty.Value) (cty.Value, error) {
	return FlattenFunc.Call([]cty.Value{list})
}

// Keys takes a map and returns a sorted list of the map keys.
func Keys(inputMap cty.Value) (cty.Value, error) {
	return KeysFunc.Call([]cty.Value{inputMap})
}

// Lookup performs a dynamic lookup into a map.
// There are three required arguments, inputMap and key, plus a defaultValue,
// which is a value to return if the given key is not found in the inputMap.
func Lookup(inputMap, key, defaultValue cty.Value) (cty.Value, error) {
	return LookupFunc.Call([]cty.Value{inputMap, key, defaultValue})
}

// Merge takes an arbitrary number of maps and returns a single map that contains
// a merged set of elements from all of the maps.
//
// If more than one given map defines the same key then the one that is later in
// the argument sequence takes precedence.
func Merge(maps ...cty.Value) (cty.Value, error) {
	return MergeFunc.Call(maps)
}

// ReverseList takes a sequence and produces a new sequence of the same length
// with all of the same elements as the given sequence but in reverse order.
func ReverseList(list cty.Value) (cty.Value, error) {
	return ReverseListFunc.Call([]cty.Value{list})
}

// SetProduct computes the Cartesian product of sets or sequences.
func SetProduct(sets ...cty.Value) (cty.Value, error) {
	return SetProductFunc.Call(sets)
}

// Slice extracts some consecutive elements from within a list.
func Slice(list, start, end cty.Value) (cty.Value, error) {
	return SliceFunc.Call([]cty.Value{list, start, end})
}

// Values returns a list of the map values, in the order of the sorted keys.
// This function only works on flat maps.
func Values(values cty.Value) (cty.Value, error) {
	return ValuesFunc.Call([]cty.Value{values})
}

// Zipmap constructs a map from a list of keys and a corresponding list of values.
func Zipmap(keys, values cty.Value) (cty.Value, error) {
	return ZipmapFunc.Call([]cty.Value{keys, values})
}
