package convert

import (
	"github.com/zclconf/go-cty/cty"
)

// dynamicFixup deals with just-in-time conversions of values that were
// input-typed as cty.DynamicPseudoType during analysis, ensuring that
// we end up with the desired output type once the value is known, or
// failing with an error if that is not possible.
//
// This is in the spirit of the cty philosophy of optimistically assuming that
// DynamicPseudoType values will become the intended value eventually, and
// dealing with any inconsistencies during final evaluation.
func dynamicFixup(wantType cty.Type) conversion {
	return func(in cty.Value, path cty.Path) (cty.Value, error) {
		ret, err := Convert(in, wantType)
		if err != nil {
			// Re-wrap this error so that the returned path is relative
			// to the caller's original value, rather than relative to our
			// conversion value here.
			return cty.NilVal, path.NewError(err)
		}
		return ret, nil
	}
}

// dynamicPassthrough is an identity conversion that is used when the
// target type is DynamicPseudoType, indicating that the caller doesn't care
// which type is returned.
func dynamicPassthrough(in cty.Value, path cty.Path) (cty.Value, error) {
	return in, nil
}

// dynamicReplace aims to return the out type unchanged, but if it finds a
// dynamic type either directly or in any descendent elements it replaces them
// with the equivalent type from in.
//
// This function assumes that in and out are compatible from a Convert
// perspective, and will panic if it finds that they are not. For example if
// in is an object and out is a map, this function will still attempt to iterate
// through both as if they were the same.
func dynamicReplace(in, out cty.Type) cty.Type {
	if in == cty.DynamicPseudoType || in == cty.NilType {
		// Short circuit this case, there's no point worrying about this if in
		// is a dynamic type or a nil type. Out is the best we can do.
		return out
	}

	switch {
	case out == cty.DynamicPseudoType:
		// So replace out with in.
		return in
	case out.IsPrimitiveType(), out.IsCapsuleType():
		// out is not dynamic and it doesn't contain descendent elements so just
		// return it unchanged.
		return out
	case out.IsMapType():
		var elemType cty.Type

		// Maps are compatible with other maps or objects.
		if in.IsMapType() {
			elemType = dynamicReplace(in.ElementType(), out.ElementType())
		}

		if in.IsObjectType() {
			var types []cty.Type
			for _, t := range in.AttributeTypes() {
				types = append(types, t)
			}
			unifiedType, _ := unify(types, true)
			elemType = dynamicReplace(unifiedType, out.ElementType())
		}

		return cty.Map(elemType)
	case out.IsObjectType():
		// Objects are compatible with other objects and maps.
		outTypes := map[string]cty.Type{}
		if in.IsMapType() {
			for attr, attrType := range out.AttributeTypes() {
				outTypes[attr] = dynamicReplace(in.ElementType(), attrType)
			}
		}

		if in.IsObjectType() {
			for attr, attrType := range out.AttributeTypes() {
				if !in.HasAttribute(attr) {
					// If in does not have this attribute, then it is an
					// optional attribute and there is nothing we can do except
					// to return the type from out even if it is dynamic.
					outTypes[attr] = attrType
					continue
				}
				outTypes[attr] = dynamicReplace(in.AttributeType(attr), attrType)
			}
		}

		return cty.Object(outTypes)
	case out.IsSetType():
		var elemType cty.Type

		// Sets are compatible with other sets, lists, tuples.
		if in.IsSetType() || in.IsListType() {
			elemType = dynamicReplace(in.ElementType(), out.ElementType())
		}

		if in.IsTupleType() {
			unifiedType, _ := unify(in.TupleElementTypes(), true)
			elemType = dynamicReplace(unifiedType, out.ElementType())
		}

		return cty.Set(elemType)
	case out.IsListType():
		var elemType cty.Type

		// Lists are compatible with other lists, sets, and tuples.
		if in.IsSetType() || in.IsListType() {
			elemType = dynamicReplace(in.ElementType(), out.ElementType())
		}

		if in.IsTupleType() {
			unifiedType, _ := unify(in.TupleElementTypes(), true)
			elemType = dynamicReplace(unifiedType, out.ElementType())
		}

		return cty.List(elemType)
	case out.IsTupleType():
		// Tuples are only compatible with other tuples
		var types []cty.Type
		for ix := 0; ix < len(out.TupleElementTypes()); ix++ {
			types = append(types, dynamicReplace(in.TupleElementType(ix), out.TupleElementType(ix)))
		}
		return cty.Tuple(types)
	default:
		panic("unrecognized type " + out.FriendlyName())
	}
}
