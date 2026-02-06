package convert

import (
	"github.com/zclconf/go-cty/cty"
)

// conversion is an internal variant of Conversion that carries around
// a cty.Path to be used in error responses.
type conversion func(cty.Value, cty.Path) (cty.Value, error)

func getConversion(in cty.Type, out cty.Type, unsafe bool) conversion {
	conv := getConversionKnown(in, out, unsafe)
	if conv == nil {
		return nil
	}

	// Wrap the conversion in some standard checks that we don't want to
	// have to repeat in every conversion function.
	var ret conversion
	ret = func(in cty.Value, path cty.Path) (cty.Value, error) {
		if in.IsMarked() {
			// We must unmark during the conversion and then re-apply the
			// same marks to the result.
			in, inMarks := in.Unmark()
			v, err := ret(in, path)
			if v != cty.NilVal {
				v = v.WithMarks(inMarks)
			}
			return v, err
		}

		if out == cty.DynamicPseudoType {
			// Conversion to DynamicPseudoType always just passes through verbatim.
			return in, nil
		}
		if isKnown, isNull := in.IsKnown(), in.IsNull(); !isKnown || isNull {
			// Avoid constructing unknown or null values with types which
			// include optional attributes. Known or non-null object values
			// will be passed to a conversion function which drops the optional
			// attributes from the type. Unknown and null pass through values
			// must do the same to ensure that homogeneous collections have a
			// single element type.
			out = out.WithoutOptionalAttributesDeep()

			if !isKnown {
				return prepareUnknownResult(in.Range(), dynamicReplace(in.Type(), out)), nil
			}

			if isNull {
				// We'll pass through nulls, albeit type converted, and let
				// the caller deal with whatever handling they want to do in
				// case null values are considered valid in some applications.
				return cty.NullVal(dynamicReplace(in.Type(), out)), nil
			}
		}

		return conv(in, path)
	}

	return ret
}

func getConversionKnown(in cty.Type, out cty.Type, unsafe bool) conversion {
	switch {

	case out == cty.DynamicPseudoType:
		// Conversion *to* DynamicPseudoType means that the caller wishes
		// to allow any type in this position, so we'll produce a do-nothing
		// conversion that just passes through the value as-is.
		return dynamicPassthrough

	case unsafe && in == cty.DynamicPseudoType:
		// Conversion *from* DynamicPseudoType means that we have a value
		// whose type isn't yet known during type checking. For these we will
		// assume that conversion will succeed and deal with any errors that
		// result (which is why we can only do this when "unsafe" is set).
		return dynamicFixup(out)

	case in.IsPrimitiveType() && out.IsPrimitiveType():
		conv := primitiveConversionsSafe[in][out]
		if conv != nil {
			return conv
		}
		if unsafe {
			return primitiveConversionsUnsafe[in][out]
		}
		return nil

	case out.IsObjectType() && in.IsObjectType():
		return conversionObjectToObject(in, out, unsafe)

	case out.IsTupleType() && in.IsTupleType():
		return conversionTupleToTuple(in, out, unsafe)

	case out.IsListType() && (in.IsListType() || in.IsSetType()):
		inEty := in.ElementType()
		outEty := out.ElementType()
		if inEty.Equals(outEty) {
			// This indicates that we're converting from list to set with
			// the same element type, so we don't need an element converter.
			return conversionCollectionToList(outEty, nil)
		}

		convEty := getConversion(inEty, outEty, unsafe)
		if convEty == nil {
			return nil
		}
		return conversionCollectionToList(outEty, convEty)

	case out.IsSetType() && (in.IsListType() || in.IsSetType()):
		if in.IsListType() && !unsafe {
			// Conversion from list to map is unsafe because it will lose
			// information: the ordering will not be preserved, and any
			// duplicate elements will be conflated.
			return nil
		}
		inEty := in.ElementType()
		outEty := out.ElementType()
		convEty := getConversion(inEty, outEty, unsafe)
		if inEty.Equals(outEty) {
			// This indicates that we're converting from set to list with
			// the same element type, so we don't need an element converter.
			return conversionCollectionToSet(outEty, nil)
		}

		if convEty == nil {
			return nil
		}
		return conversionCollectionToSet(outEty, convEty)

	case out.IsMapType() && in.IsMapType():
		inEty := in.ElementType()
		outEty := out.ElementType()
		convEty := getConversion(inEty, outEty, unsafe)
		if convEty == nil {
			return nil
		}
		return conversionCollectionToMap(outEty, convEty)

	case out.IsListType() && in.IsTupleType():
		outEty := out.ElementType()
		return conversionTupleToList(in, outEty, unsafe)

	case out.IsSetType() && in.IsTupleType():
		outEty := out.ElementType()
		return conversionTupleToSet(in, outEty, unsafe)

	case out.IsMapType() && in.IsObjectType():
		outEty := out.ElementType()
		return conversionObjectToMap(in, outEty, unsafe)

	case out.IsObjectType() && in.IsMapType():
		if !unsafe {
			// Converting a map to an object is an "unsafe" conversion,
			// because we don't know if all the map keys will correspond to
			// object attributes.
			return nil
		}
		return conversionMapToObject(in, out, unsafe)

	case in.IsCapsuleType() || out.IsCapsuleType():
		if !unsafe {
			// Capsule types can only participate in "unsafe" conversions,
			// because we don't know enough about their conversion behaviors
			// to be sure that they will always be safe.
			return nil
		}
		if in.Equals(out) {
			// conversion to self is never allowed
			return nil
		}
		if out.IsCapsuleType() {
			if fn := out.CapsuleOps().ConversionTo; fn != nil {
				if conv := conversionToCapsule(in, out, fn); conv != nil {
					return conv
				}
			}
		}
		if in.IsCapsuleType() {
			if fn := in.CapsuleOps().ConversionFrom; fn != nil {
				if conv := conversionFromCapsule(in, out, fn); conv != nil {
					return conv
				}
			}
		}
		// No conversion operation is available, then.
		return nil

	default:
		return nil

	}
}

// retConversion wraps a conversion (internal type) so it can be returned
// as a Conversion (public type).
func retConversion(conv conversion) Conversion {
	if conv == nil {
		return nil
	}

	return func(in cty.Value) (cty.Value, error) {
		return conv(in, cty.Path(nil))
	}
}

// prepareUnknownResult can apply value refinements to a returned unknown value
// in certain cases where characteristics of the source value or type can
// transfer into range constraints on the result value.
func prepareUnknownResult(sourceRange cty.ValueRange, targetTy cty.Type) cty.Value {
	sourceTy := sourceRange.TypeConstraint()

	ret := cty.UnknownVal(targetTy)
	if sourceRange.DefinitelyNotNull() {
		ret = ret.RefineNotNull()
	}

	switch {
	case sourceTy.IsObjectType() && targetTy.IsMapType():
		// A map built from an object type always has the same number of
		// elements as the source type has attributes.
		return ret.Refine().CollectionLength(len(sourceTy.AttributeTypes())).NewValue()
	case sourceTy.IsTupleType() && targetTy.IsListType():
		// A list built from a typle type always has the same number of
		// elements as the source type has elements.
		return ret.Refine().CollectionLength(sourceTy.Length()).NewValue()
	case sourceTy.IsTupleType() && targetTy.IsSetType():
		// When building a set from a tuple type we can't exactly constrain
		// the length because some elements might coalesce, but we can
		// guarantee an upper limit. We can also guarantee at least one
		// element if the tuple isn't empty.
		switch l := sourceTy.Length(); l {
		case 0, 1:
			return ret.Refine().CollectionLength(l).NewValue()
		default:
			return ret.Refine().
				CollectionLengthLowerBound(1).
				CollectionLengthUpperBound(sourceTy.Length()).
				NewValue()
		}
	case sourceTy.IsCollectionType() && targetTy.IsCollectionType():
		// NOTE: We only reach this function if there is an available
		// conversion between the source and target type, so we don't
		// need to repeat element type compatibility checks and such here.
		//
		// If the source value already has a refined length then we'll
		// transfer those refinements to the result, because conversion
		// does not change length (aside from set element coalescing).
		b := ret.Refine()
		if targetTy.IsSetType() {
			if sourceRange.LengthLowerBound() > 0 {
				// If the source has at least one element then the result
				// must always have at least one too, because value coalescing
				// cannot totally empty the set.
				b = b.CollectionLengthLowerBound(1)
			}
		} else {
			b = b.CollectionLengthLowerBound(sourceRange.LengthLowerBound())
		}
		b = b.CollectionLengthUpperBound(sourceRange.LengthUpperBound())
		return b.NewValue()
	default:
		return ret
	}

}
