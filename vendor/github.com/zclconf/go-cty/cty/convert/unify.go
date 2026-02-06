package convert

import (
	"github.com/zclconf/go-cty/cty"
)

// The current unify implementation is somewhat inefficient, but we accept this
// under the assumption that it will generally be used with small numbers of
// types and with types of reasonable complexity. However, it does have a
// "happy path" where all of the given types are equal.
//
// This function is likely to have poor performance in cases where any given
// types are very complex (lots of deeply-nested structures) or if the list
// of types itself is very large. In particular, it will walk the nested type
// structure under the given types several times, especially when given a
// list of types for which unification is not possible, since each permutation
// will be tried to determine that result.
func unify(types []cty.Type, unsafe bool) (cty.Type, []Conversion) {
	if len(types) == 0 {
		// Degenerate case
		return cty.NilType, nil
	}

	// If all of the given types are of the same structural kind, we may be
	// able to construct a new type that they can all be unified to, even if
	// that is not one of the given types. We must try this before the general
	// behavior below because in unsafe mode we can convert an object type to
	// a subset of that type, which would be a much less useful conversion for
	// unification purposes.
	{
		mapCt := 0
		listCt := 0
		setCt := 0
		objectCt := 0
		tupleCt := 0
		dynamicCt := 0
		for _, ty := range types {
			switch {
			case ty.IsMapType():
				mapCt++
			case ty.IsListType():
				listCt++
			case ty.IsSetType():
				setCt++
			case ty.IsObjectType():
				objectCt++
			case ty.IsTupleType():
				tupleCt++
			case ty == cty.DynamicPseudoType:
				dynamicCt++
			default:
				break
			}
		}
		switch {
		case mapCt > 0 && (mapCt+dynamicCt) == len(types):
			return unifyCollectionTypes(cty.Map, types, unsafe, dynamicCt > 0)

		case mapCt > 0 && (mapCt+objectCt+dynamicCt) == len(types):
			// Objects often contain map data, but are not directly typed as
			// such due to language constructs or function types. Try to unify
			// them as maps first before falling back to heterogeneous type
			// conversion.
			ty, convs := unifyObjectsAsMaps(types, unsafe)
			// If we got a map back, we know the unification was successful.
			if ty.IsMapType() {
				return ty, convs
			}
		case listCt > 0 && (listCt+dynamicCt) == len(types):
			return unifyCollectionTypes(cty.List, types, unsafe, dynamicCt > 0)
		case listCt > 0 && (listCt+tupleCt+dynamicCt) == len(types):
			// Tuples are often lists in disguise, and we may be able to
			// unify them as such.
			ty, convs := unifyTuplesAsList(types, unsafe)
			// if we got a list back, we know the unification was successful.
			// Otherwise we will fall back to the heterogeneous type codepath.
			if ty.IsListType() {
				return ty, convs
			}
		case setCt > 0 && (setCt+dynamicCt) == len(types):
			return unifyCollectionTypes(cty.Set, types, unsafe, dynamicCt > 0)
		case objectCt > 0 && (objectCt+dynamicCt) == len(types):
			return unifyObjectTypes(types, unsafe, dynamicCt > 0)
		case tupleCt > 0 && (tupleCt+dynamicCt) == len(types):
			return unifyTupleTypes(types, unsafe, dynamicCt > 0)
		case objectCt > 0 && tupleCt > 0:
			// Can never unify object and tuple types since they have incompatible kinds
			return cty.NilType, nil
		}
	}

	prefOrder := sortTypes(types)

	// sortTypes gives us an order where earlier items are preferable as
	// our result type. We'll now walk through these and choose the first
	// one we encounter for which conversions exist for all source types.
	conversions := make([]Conversion, len(types))
Preferences:
	for _, wantTypeIdx := range prefOrder {
		wantType := types[wantTypeIdx]
		for i, tryType := range types {
			if i == wantTypeIdx {
				// Don't need to convert our wanted type to itself
				conversions[i] = nil
				continue
			}

			if tryType.Equals(wantType) {
				conversions[i] = nil
				continue
			}

			if unsafe {
				conversions[i] = GetConversionUnsafe(tryType, wantType)
			} else {
				conversions[i] = GetConversion(tryType, wantType)
			}

			if conversions[i] == nil {
				// wantType is not a suitable unification type, so we'll
				// try the next one in our preference order.
				continue Preferences
			}
		}

		return wantType, conversions
	}

	// If we fall out here, no unification is possible
	return cty.NilType, nil
}

// unifyTuplesAsList attempts to first see if the tuples unify as lists, then
// re-unifies the given types with the list in place of the tuples.
func unifyTuplesAsList(types []cty.Type, unsafe bool) (cty.Type, []Conversion) {
	var tuples []cty.Type
	var tupleIdxs []int
	for i, t := range types {
		if t.IsTupleType() {
			tuples = append(tuples, t)
			tupleIdxs = append(tupleIdxs, i)
		}
	}

	ty, tupleConvs := unifyTupleTypesToList(tuples, unsafe)
	if !ty.IsListType() {
		return cty.NilType, nil
	}

	// the tuples themselves unified as a list, get the overall
	// unification with this list type instead of the tuple.
	// make a copy of the types, so we can fallback to the standard
	// codepath if something went wrong
	listed := make([]cty.Type, len(types))
	copy(listed, types)
	for _, idx := range tupleIdxs {
		listed[idx] = ty
	}

	newTy, convs := unify(listed, unsafe)
	if !newTy.IsListType() {
		return cty.NilType, nil
	}

	// we have a good conversion, wrap the nested tuple conversions.
	// We know the tuple conversion is not nil, because we went from tuple to
	// list
	for i, idx := range tupleIdxs {
		listConv := convs[idx]
		tupleConv := tupleConvs[i]

		if listConv == nil {
			convs[idx] = tupleConv
			continue
		}

		convs[idx] = func(in cty.Value) (out cty.Value, err error) {
			out, err = tupleConv(in)
			if err != nil {
				return out, err
			}

			return listConv(in)
		}
	}

	return newTy, convs
}

// unifyObjectsAsMaps attempts to first see if the objects unify as maps, then
// re-unifies the given types with the map in place of the objects.
func unifyObjectsAsMaps(types []cty.Type, unsafe bool) (cty.Type, []Conversion) {
	var objs []cty.Type
	var objIdxs []int
	for i, t := range types {
		if t.IsObjectType() {
			objs = append(objs, t)
			objIdxs = append(objIdxs, i)
		}
	}

	ty, objConvs := unifyObjectTypesToMap(objs, unsafe)
	if !ty.IsMapType() {
		return cty.NilType, nil
	}

	// the objects themselves unified as a map, get the overall
	// unification with this map type instead of the object.
	// Make a copy of the types, so we can fallback to the standard codepath if
	// something went wrong without changing the original types.
	mapped := make([]cty.Type, len(types))
	copy(mapped, types)
	for _, idx := range objIdxs {
		mapped[idx] = ty
	}

	newTy, convs := unify(mapped, unsafe)
	if !newTy.IsMapType() {
		return cty.NilType, nil
	}

	// we have a good conversion, so wrap the nested object conversions.
	// We know the object conversion is not nil, because we went from object to
	// map.
	for i, idx := range objIdxs {
		mapConv := convs[idx]
		objConv := objConvs[i]

		if mapConv == nil {
			convs[idx] = objConv
			continue
		}

		convs[idx] = func(in cty.Value) (out cty.Value, err error) {
			out, err = objConv(in)
			if err != nil {
				return out, err
			}

			return mapConv(in)
		}
	}

	return newTy, convs
}

func unifyCollectionTypes(collectionType func(cty.Type) cty.Type, types []cty.Type, unsafe bool, hasDynamic bool) (cty.Type, []Conversion) {
	// If we had any dynamic types in the input here then we can't predict
	// what path we'll take through here once these become known types, so
	// we'll conservatively produce DynamicVal for these.
	if hasDynamic {
		return unifyAllAsDynamic(types)
	}

	elemTypes := make([]cty.Type, 0, len(types))
	for _, ty := range types {
		elemTypes = append(elemTypes, ty.ElementType())
	}
	retElemType, _ := unify(elemTypes, unsafe)
	if retElemType == cty.NilType {
		return cty.NilType, nil
	}

	retTy := collectionType(retElemType)

	conversions := make([]Conversion, len(types))
	for i, ty := range types {
		if ty.Equals(retTy) {
			continue
		}
		if unsafe {
			conversions[i] = GetConversionUnsafe(ty, retTy)
		} else {
			conversions[i] = GetConversion(ty, retTy)
		}
		if conversions[i] == nil {
			// Shouldn't be reachable, since we were able to unify
			return cty.NilType, nil
		}
	}

	return retTy, conversions
}

func unifyObjectTypes(types []cty.Type, unsafe bool, hasDynamic bool) (cty.Type, []Conversion) {
	// If we had any dynamic types in the input here then we can't predict
	// what path we'll take through here once these become known types, so
	// we'll conservatively produce DynamicVal for these.
	if hasDynamic {
		return unifyAllAsDynamic(types)
	}

	// There are two different ways we can succeed here:
	// - If all of the given object types have the same set of attribute names
	//   and the corresponding types are all unifyable, then we construct that
	//   type.
	// - If the given object types have different attribute names or their
	//   corresponding types are not unifyable, we'll instead try to unify
	//   all of the attribute types together to produce a map type.
	//
	// Our unification behavior is intentionally stricter than our conversion
	// behavior for subset object types because user intent is different with
	// unification use-cases: it makes sense to allow {"foo":true} to convert
	// to emptyobjectval, but unifying an object with an attribute with the
	// empty object type should be an error because unifying to the empty
	// object type would be suprising and useless.

	firstAttrs := types[0].AttributeTypes()
	for _, ty := range types[1:] {
		thisAttrs := ty.AttributeTypes()
		if len(thisAttrs) != len(firstAttrs) {
			// If number of attributes is different then there can be no
			// object type in common.
			return unifyObjectTypesToMap(types, unsafe)
		}
		for name := range thisAttrs {
			if _, ok := firstAttrs[name]; !ok {
				// If attribute names don't exactly match then there can be
				// no object type in common.
				return unifyObjectTypesToMap(types, unsafe)
			}
		}
	}

	// If we get here then we've proven that all of the given object types
	// have exactly the same set of attribute names, though the types may
	// differ.
	retAtys := make(map[string]cty.Type)
	atysAcross := make([]cty.Type, len(types))
	for name := range firstAttrs {
		for i, ty := range types {
			atysAcross[i] = ty.AttributeType(name)
		}
		retAtys[name], _ = unify(atysAcross, unsafe)
		if retAtys[name] == cty.NilType {
			// Cannot unify this attribute alone, which means that unification
			// of everything down to a map type can't be possible either.
			return cty.NilType, nil
		}
	}
	retTy := cty.Object(retAtys)

	conversions := make([]Conversion, len(types))
	for i, ty := range types {
		if ty.Equals(retTy) {
			continue
		}
		if unsafe {
			conversions[i] = GetConversionUnsafe(ty, retTy)
		} else {
			conversions[i] = GetConversion(ty, retTy)
		}
		if conversions[i] == nil {
			// Shouldn't be reachable, since we were able to unify
			return unifyObjectTypesToMap(types, unsafe)
		}
	}

	return retTy, conversions
}

func unifyObjectTypesToMap(types []cty.Type, unsafe bool) (cty.Type, []Conversion) {
	// This is our fallback case for unifyObjectTypes, where we see if we can
	// construct a map type that can accept all of the attribute types.

	var atys []cty.Type
	for _, ty := range types {
		for _, aty := range ty.AttributeTypes() {
			atys = append(atys, aty)
		}
	}

	ety, _ := unify(atys, unsafe)
	if ety == cty.NilType {
		return cty.NilType, nil
	}

	retTy := cty.Map(ety)
	conversions := make([]Conversion, len(types))
	for i, ty := range types {
		if ty.Equals(retTy) {
			continue
		}
		if unsafe {
			conversions[i] = GetConversionUnsafe(ty, retTy)
		} else {
			conversions[i] = GetConversion(ty, retTy)
		}
		if conversions[i] == nil {
			return cty.NilType, nil
		}
	}
	return retTy, conversions
}

func unifyTupleTypes(types []cty.Type, unsafe bool, hasDynamic bool) (cty.Type, []Conversion) {
	// If we had any dynamic types in the input here then we can't predict
	// what path we'll take through here once these become known types, so
	// we'll conservatively produce DynamicVal for these.
	if hasDynamic {
		return unifyAllAsDynamic(types)
	}

	// There are two different ways we can succeed here:
	// - If all of the given tuple types have the same sequence of element types
	//   and the corresponding types are all unifyable, then we construct that
	//   type.
	// - If the given tuple types have different element types or their
	//   corresponding types are not unifyable, we'll instead try to unify
	//   all of the elements types together to produce a list type.

	firstEtys := types[0].TupleElementTypes()
	for _, ty := range types[1:] {
		thisEtys := ty.TupleElementTypes()
		if len(thisEtys) != len(firstEtys) {
			// If number of elements is different then there can be no
			// tuple type in common.
			return unifyTupleTypesToList(types, unsafe)
		}
	}

	// If we get here then we've proven that all of the given tuple types
	// have the same number of elements, though the types may differ.
	retEtys := make([]cty.Type, len(firstEtys))
	atysAcross := make([]cty.Type, len(types))
	for idx := range firstEtys {
		for tyI, ty := range types {
			atysAcross[tyI] = ty.TupleElementTypes()[idx]
		}
		retEtys[idx], _ = unify(atysAcross, unsafe)
		if retEtys[idx] == cty.NilType {
			// Cannot unify this element alone, which means that unification
			// of everything down to a map type can't be possible either.
			return cty.NilType, nil
		}
	}
	retTy := cty.Tuple(retEtys)

	conversions := make([]Conversion, len(types))
	for i, ty := range types {
		if ty.Equals(retTy) {
			continue
		}
		if unsafe {
			conversions[i] = GetConversionUnsafe(ty, retTy)
		} else {
			conversions[i] = GetConversion(ty, retTy)
		}
		if conversions[i] == nil {
			return unifyTupleTypesToList(types, unsafe)
		}
	}

	return retTy, conversions
}

func unifyTupleTypesToList(types []cty.Type, unsafe bool) (cty.Type, []Conversion) {
	// This is our fallback case for unifyTupleTypes, where we see if we can
	// construct a list type that can accept all of the element types.

	var etys []cty.Type
	for _, ty := range types {
		for _, ety := range ty.TupleElementTypes() {
			etys = append(etys, ety)
		}
	}

	ety, _ := unify(etys, unsafe)
	if ety == cty.NilType {
		return cty.NilType, nil
	}

	retTy := cty.List(ety)
	conversions := make([]Conversion, len(types))
	for i, ty := range types {
		if ty.Equals(retTy) {
			continue
		}
		if unsafe {
			conversions[i] = GetConversionUnsafe(ty, retTy)
		} else {
			conversions[i] = GetConversion(ty, retTy)
		}
		if conversions[i] == nil {
			// no conversion was found
			return cty.NilType, nil
		}
	}
	return retTy, conversions
}

func unifyAllAsDynamic(types []cty.Type) (cty.Type, []Conversion) {
	conversions := make([]Conversion, len(types))
	for i := range conversions {
		conversions[i] = func(cty.Value) (cty.Value, error) {
			return cty.DynamicVal, nil
		}
	}
	return cty.DynamicPseudoType, conversions
}
