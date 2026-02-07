package gocty

import (
	"math"
	"math/big"
	"reflect"

	"github.com/zclconf/go-cty/cty"
)

// FromCtyValue assigns a cty.Value to a reflect.Value, which must be a pointer,
// using a fixed set of conversion rules.
//
// This function considers its audience to be the creator of the cty Value
// given, and thus the error messages it generates are (unlike with ToCtyValue)
// presented in cty terminology that is generally appropriate to return to
// end-users in applications where cty data structures are built from
// user-provided configuration. In particular this means that if incorrect
// target types are provided by the calling application the resulting error
// messages are likely to be confusing, since we assume that the given target
// type is correct and the cty.Value is where the error lies.
//
// If an error is returned, the target data structure may have been partially
// populated, but the degree to which this is true is an implementation
// detail that the calling application should not rely on.
//
// The function will panic if given a non-pointer as the Go value target,
// since that is considered to be a bug in the calling program.
func FromCtyValue(val cty.Value, target interface{}) error {
	tVal := reflect.ValueOf(target)
	if tVal.Kind() != reflect.Ptr {
		panic("target value is not a pointer")
	}
	if tVal.IsNil() {
		panic("target value is nil pointer")
	}

	// 'path' starts off as empty but will grow for each level of recursive
	// call we make, so by the time fromCtyValue returns it is likely to have
	// unused capacity on the end of it, depending on how deeply-recursive
	// the given cty.Value is.
	path := make(cty.Path, 0)
	return fromCtyValue(val, tVal, path)
}

func fromCtyValue(val cty.Value, target reflect.Value, path cty.Path) error {
	ty := val.Type()

	deepTarget := fromCtyPopulatePtr(target, false)

	// If we're decoding into a cty.Value then we just pass through the
	// value as-is, to enable partial decoding. This is the only situation
	// where unknown values are permitted.
	if deepTarget.Kind() == reflect.Struct && deepTarget.Type().AssignableTo(valueType) {
		deepTarget.Set(reflect.ValueOf(val))
		return nil
	}

	// Lists and maps can be nil without indirection, but everything else
	// requires a pointer and we set it immediately to nil.
	// We also make an exception for capsule types because we want to handle
	// pointers specially for these.
	// (fromCtyList and fromCtyMap must therefore deal with val.IsNull, while
	// other types can assume no nulls after this point.)
	if val.IsNull() && !val.Type().IsListType() && !val.Type().IsMapType() && !val.Type().IsCapsuleType() {
		target = fromCtyPopulatePtr(target, true)
		if target.Kind() != reflect.Ptr {
			return path.NewErrorf("null value is not allowed")
		}

		target.Set(reflect.Zero(target.Type()))
		return nil
	}

	target = deepTarget

	if !val.IsKnown() {
		return path.NewErrorf("value must be known")
	}

	switch ty {
	case cty.Bool:
		return fromCtyBool(val, target, path)
	case cty.Number:
		return fromCtyNumber(val, target, path)
	case cty.String:
		return fromCtyString(val, target, path)
	}

	switch {
	case ty.IsListType():
		return fromCtyList(val, target, path)
	case ty.IsMapType():
		return fromCtyMap(val, target, path)
	case ty.IsSetType():
		return fromCtySet(val, target, path)
	case ty.IsObjectType():
		return fromCtyObject(val, target, path)
	case ty.IsTupleType():
		return fromCtyTuple(val, target, path)
	case ty.IsCapsuleType():
		return fromCtyCapsule(val, target, path)
	}

	// We should never fall out here; reaching here indicates a bug in this
	// function.
	return path.NewErrorf("unsupported source type %#v", ty)
}

func fromCtyBool(val cty.Value, target reflect.Value, path cty.Path) error {
	switch target.Kind() {

	case reflect.Bool:
		target.SetBool(val.True())
		return nil

	default:
		return likelyRequiredTypesError(path, target)

	}
}

func fromCtyNumber(val cty.Value, target reflect.Value, path cty.Path) error {
	bf := val.AsBigFloat()

	switch target.Kind() {

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return fromCtyNumberInt(bf, target, path)

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return fromCtyNumberUInt(bf, target, path)

	case reflect.Float32, reflect.Float64:
		return fromCtyNumberFloat(bf, target, path)

	case reflect.Struct:
		return fromCtyNumberBig(bf, target, path)

	default:
		return likelyRequiredTypesError(path, target)

	}
}

func fromCtyNumberInt(bf *big.Float, target reflect.Value, path cty.Path) error {
	// Doing this with switch rather than << arithmetic because << with
	// result >32-bits is not portable to 32-bit systems.
	var min int64
	var max int64
	switch target.Type().Bits() {
	case 8:
		min = math.MinInt8
		max = math.MaxInt8
	case 16:
		min = math.MinInt16
		max = math.MaxInt16
	case 32:
		min = math.MinInt32
		max = math.MaxInt32
	case 64:
		min = math.MinInt64
		max = math.MaxInt64
	default:
		panic("weird number of bits in target int")
	}

	iv, accuracy := bf.Int64()
	if accuracy != big.Exact || iv < min || iv > max {
		return path.NewErrorf("value must be a whole number, between %d and %d", min, max)
	}

	target.SetInt(iv)
	return nil
}

func fromCtyNumberUInt(bf *big.Float, target reflect.Value, path cty.Path) error {
	// Doing this with switch rather than << arithmetic because << with
	// result >32-bits is not portable to 32-bit systems.
	var max uint64
	switch target.Type().Bits() {
	case 8:
		max = math.MaxUint8
	case 16:
		max = math.MaxUint16
	case 32:
		max = math.MaxUint32
	case 64:
		max = math.MaxUint64
	default:
		panic("weird number of bits in target uint")
	}

	iv, accuracy := bf.Uint64()
	if accuracy != big.Exact || iv > max {
		return path.NewErrorf("value must be a whole number, between 0 and %d inclusive", max)
	}

	target.SetUint(iv)
	return nil
}

func fromCtyNumberFloat(bf *big.Float, target reflect.Value, path cty.Path) error {
	switch target.Kind() {
	case reflect.Float32, reflect.Float64:
		fv, accuracy := bf.Float64()
		if accuracy != big.Exact {
			// We allow the precision to be truncated as part of our conversion,
			// but we don't want to silently introduce infinities.
			if math.IsInf(fv, 0) {
				return path.NewErrorf("value must be between %f and %f inclusive", -math.MaxFloat64, math.MaxFloat64)
			}
		}
		target.SetFloat(fv)
		return nil
	default:
		panic("unsupported kind of float")
	}
}

func fromCtyNumberBig(bf *big.Float, target reflect.Value, path cty.Path) error {
	switch {

	case bigFloatType.ConvertibleTo(target.Type()):
		// Easy!
		target.Set(reflect.ValueOf(bf).Elem().Convert(target.Type()))
		return nil

	case bigIntType.ConvertibleTo(target.Type()):
		bi, accuracy := bf.Int(nil)
		if accuracy != big.Exact {
			return path.NewErrorf("value must be a whole number")
		}
		target.Set(reflect.ValueOf(bi).Elem().Convert(target.Type()))
		return nil

	default:
		return likelyRequiredTypesError(path, target)
	}
}

func fromCtyString(val cty.Value, target reflect.Value, path cty.Path) error {
	switch target.Kind() {
	case reflect.String:
		target.SetString(val.AsString())
		return nil

	default:
		return likelyRequiredTypesError(path, target)

	}
}

func fromCtyList(val cty.Value, target reflect.Value, path cty.Path) error {
	switch target.Kind() {

	case reflect.Slice:
		if val.IsNull() {
			target.Set(reflect.Zero(target.Type()))
			return nil
		}

		length := val.LengthInt()
		tv := reflect.MakeSlice(target.Type(), length, length)

		path = append(path, nil)

		i := 0
		var err error
		val.ForEachElement(func(key cty.Value, val cty.Value) bool {
			path[len(path)-1] = cty.IndexStep{
				Key: cty.NumberIntVal(int64(i)),
			}

			targetElem := tv.Index(i)
			err = fromCtyValue(val, targetElem, path)
			if err != nil {
				return true
			}

			i++
			return false
		})
		if err != nil {
			return err
		}

		path = path[:len(path)-1]

		target.Set(tv)
		return nil

	case reflect.Array:
		if val.IsNull() {
			return path.NewErrorf("null value is not allowed")
		}

		length := val.LengthInt()
		if length != target.Len() {
			return path.NewErrorf("must be a list of length %d", target.Len())
		}

		path = append(path, nil)

		i := 0
		var err error
		val.ForEachElement(func(key cty.Value, val cty.Value) bool {
			path[len(path)-1] = cty.IndexStep{
				Key: cty.NumberIntVal(int64(i)),
			}

			targetElem := target.Index(i)
			err = fromCtyValue(val, targetElem, path)
			if err != nil {
				return true
			}

			i++
			return false
		})
		if err != nil {
			return err
		}

		path = path[:len(path)-1]

		return nil

	default:
		return likelyRequiredTypesError(path, target)

	}
}

func fromCtyMap(val cty.Value, target reflect.Value, path cty.Path) error {

	switch target.Kind() {

	case reflect.Map:
		if val.IsNull() {
			target.Set(reflect.Zero(target.Type()))
			return nil
		}

		tv := reflect.MakeMap(target.Type())
		et := target.Type().Elem()

		path = append(path, nil)

		var err error
		val.ForEachElement(func(key cty.Value, val cty.Value) bool {
			path[len(path)-1] = cty.IndexStep{
				Key: key,
			}

			ks := key.AsString()

			targetElem := reflect.New(et)
			err = fromCtyValue(val, targetElem, path)

			tv.SetMapIndex(reflect.ValueOf(ks), targetElem.Elem())

			return err != nil
		})
		if err != nil {
			return err
		}

		path = path[:len(path)-1]

		target.Set(tv)
		return nil

	default:
		return likelyRequiredTypesError(path, target)

	}
}

func fromCtySet(val cty.Value, target reflect.Value, path cty.Path) error {
	switch target.Kind() {

	case reflect.Slice:
		if val.IsNull() {
			target.Set(reflect.Zero(target.Type()))
			return nil
		}

		length := val.LengthInt()
		tv := reflect.MakeSlice(target.Type(), length, length)

		i := 0
		var err error
		val.ForEachElement(func(key cty.Value, val cty.Value) bool {
			targetElem := tv.Index(i)
			err = fromCtyValue(val, targetElem, path)
			if err != nil {
				return true
			}

			i++
			return false
		})
		if err != nil {
			return err
		}

		target.Set(tv)
		return nil

	case reflect.Array:
		if val.IsNull() {
			return path.NewErrorf("null value is not allowed")
		}

		length := val.LengthInt()
		if length != target.Len() {
			return path.NewErrorf("must be a set of length %d", target.Len())
		}

		i := 0
		var err error
		val.ForEachElement(func(key cty.Value, val cty.Value) bool {
			targetElem := target.Index(i)
			err = fromCtyValue(val, targetElem, path)
			if err != nil {
				return true
			}

			i++
			return false
		})
		if err != nil {
			return err
		}

		return nil

	// TODO: decode into set.Set instance

	default:
		return likelyRequiredTypesError(path, target)

	}
}

func fromCtyObject(val cty.Value, target reflect.Value, path cty.Path) error {

	switch target.Kind() {

	case reflect.Struct:

		attrTypes := val.Type().AttributeTypes()
		targetFields := structTagIndices(target.Type())

		path = append(path, nil)

		for k, i := range targetFields {
			if _, exists := attrTypes[k]; !exists {
				// If the field in question isn't able to represent nil,
				// that's an error.
				fk := target.Field(i).Kind()
				switch fk {
				case reflect.Ptr, reflect.Slice, reflect.Map, reflect.Interface:
					// okay
				default:
					return path.NewErrorf("missing required attribute %q", k)
				}
			}
		}

		for k := range attrTypes {
			path[len(path)-1] = cty.GetAttrStep{
				Name: k,
			}

			fieldIdx, exists := targetFields[k]
			if !exists {
				return path.NewErrorf("unsupported attribute %q", k)
			}

			ev := val.GetAttr(k)

			targetField := target.Field(fieldIdx)
			err := fromCtyValue(ev, targetField, path)
			if err != nil {
				return err
			}
		}

		path = path[:len(path)-1]

		return nil

	default:
		return likelyRequiredTypesError(path, target)

	}
}

func fromCtyTuple(val cty.Value, target reflect.Value, path cty.Path) error {

	switch target.Kind() {

	case reflect.Struct:

		elemTypes := val.Type().TupleElementTypes()
		fieldCount := target.Type().NumField()

		if fieldCount != len(elemTypes) {
			return path.NewErrorf("a tuple of %d elements is required", fieldCount)
		}

		path = append(path, nil)

		for i := range elemTypes {
			path[len(path)-1] = cty.IndexStep{
				Key: cty.NumberIntVal(int64(i)),
			}

			ev := val.Index(cty.NumberIntVal(int64(i)))

			targetField := target.Field(i)
			err := fromCtyValue(ev, targetField, path)
			if err != nil {
				return err
			}
		}

		path = path[:len(path)-1]

		return nil

	default:
		return likelyRequiredTypesError(path, target)

	}
}

func fromCtyCapsule(val cty.Value, target reflect.Value, path cty.Path) error {

	if target.Kind() == reflect.Ptr {
		// Walk through indirection until we get to the last pointer,
		// which we might set to null below.
		target = fromCtyPopulatePtr(target, true)

		if val.IsNull() {
			target.Set(reflect.Zero(target.Type()))
			return nil
		}

		// Since a capsule contains a pointer to an object, we'll preserve
		// that pointer on the way out and thus allow the caller to recover
		// the original object, rather than a copy of it.

		eType := val.Type().EncapsulatedType()

		if !eType.AssignableTo(target.Elem().Type()) {
			// Our interface contract promises that we won't expose Go
			// implementation details in error messages, so we need to keep
			// this vague. This can only arise if a calling application has
			// more than one capsule type in play and a user mixes them up.
			return path.NewErrorf("incorrect type %s", val.Type().FriendlyName())
		}

		target.Set(reflect.ValueOf(val.EncapsulatedValue()))

		return nil
	} else {
		if val.IsNull() {
			return path.NewErrorf("null value is not allowed")
		}

		// If our target isn't a pointer then we will attempt to copy
		// the encapsulated value into it.

		eType := val.Type().EncapsulatedType()

		if !eType.AssignableTo(target.Type()) {
			// Our interface contract promises that we won't expose Go
			// implementation details in error messages, so we need to keep
			// this vague. This can only arise if a calling application has
			// more than one capsule type in play and a user mixes them up.
			return path.NewErrorf("incorrect type %s", val.Type().FriendlyName())
		}

		// We know that EncapsulatedValue is always a pointer, so we
		// can safely call .Elem on its reflect.Value.
		target.Set(reflect.ValueOf(val.EncapsulatedValue()).Elem())

		return nil
	}

}

// fromCtyPopulatePtr recognizes when target is a pointer type and allocates
// a value to assign to that pointer, which it returns.
//
// If the given value has multiple levels of indirection, like **int, these
// will be processed in turn so that the return value is guaranteed to be
// a non-pointer.
//
// As an exception, if decodingNull is true then the returned value will be
// the final level of pointer, if any, so that the caller can assign it
// as nil to represent a null value. If the given target value is not a pointer
// at all then the returned value will be just the given target, so the caller
// must test if the returned value is a pointer before trying to assign nil
// to it.
func fromCtyPopulatePtr(target reflect.Value, decodingNull bool) reflect.Value {
	for {
		if target.Kind() == reflect.Interface && !target.IsNil() {
			e := target.Elem()
			if e.Kind() == reflect.Ptr && !e.IsNil() && (!decodingNull || e.Elem().Kind() == reflect.Ptr) {
				target = e
			}
		}

		if target.Kind() != reflect.Ptr {
			break
		}

		// Stop early if we're decodingNull and we've found our last indirection
		if target.Elem().Kind() != reflect.Ptr && decodingNull && target.CanSet() {
			break
		}

		if target.IsNil() {
			target.Set(reflect.New(target.Type().Elem()))
		}

		target = target.Elem()
	}
	return target
}

// likelyRequiredTypesError returns an error that states which types are
// acceptable by making some assumptions about what types we support for
// each target Go kind. It's not a precise science but it allows us to return
// an error message that is cty-user-oriented rather than Go-oriented.
//
// Generally these error messages should be a matter of last resort, since
// the calling application should be validating user-provided value types
// before decoding anyway.
func likelyRequiredTypesError(path cty.Path, target reflect.Value) error {
	switch target.Kind() {

	case reflect.Bool:
		return path.NewErrorf("bool value is required")

	case reflect.String:
		return path.NewErrorf("string value is required")

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		fallthrough
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		fallthrough
	case reflect.Float32, reflect.Float64:
		return path.NewErrorf("number value is required")

	case reflect.Slice, reflect.Array:
		return path.NewErrorf("list or set value is required")

	case reflect.Map:
		return path.NewErrorf("map or object value is required")

	case reflect.Struct:
		switch {

		case target.Type().AssignableTo(bigFloatType) || target.Type().AssignableTo(bigIntType):
			return path.NewErrorf("number value is required")

		case target.Type().AssignableTo(setType):
			return path.NewErrorf("set or list value is required")

		default:
			return path.NewErrorf("object or tuple value is required")

		}

	default:
		// We should avoid getting into this path, since this error
		// message is rather useless.
		return path.NewErrorf("incorrect type")

	}
}
