package convert

import (
	"github.com/zclconf/go-cty/cty"
)

// conversionCollectionToList returns a conversion that will apply the given
// conversion to all of the elements of a collection (something that supports
// ForEachElement and LengthInt) and then returns the result as a list.
//
// "conv" can be nil if the elements are expected to already be of the
// correct type and just need to be re-wrapped into a list. (For example,
// if we're converting from a set into a list of the same element type.)
func conversionCollectionToList(ety cty.Type, conv conversion) conversion {
	return func(val cty.Value, path cty.Path) (cty.Value, error) {
		if !val.Length().IsKnown() {
			// If the input collection has an unknown length (which is true
			// for a set containing unknown values) then our result must be
			// an unknown list, because we can't predict how many elements
			// the resulting list should have.
			return cty.UnknownVal(cty.List(val.Type().ElementType())), nil
		}

		elems := make([]cty.Value, 0, val.LengthInt())
		i := int64(0)
		elemPath := append(path.Copy(), nil)
		it := val.ElementIterator()
		for it.Next() {
			_, val := it.Element()
			var err error

			elemPath[len(elemPath)-1] = cty.IndexStep{
				Key: cty.NumberIntVal(i),
			}

			if conv != nil {
				val, err = conv(val, elemPath)
				if err != nil {
					return cty.NilVal, err
				}
			}

			if val.IsNull() {
				val = cty.NullVal(val.Type().WithoutOptionalAttributesDeep())
			}

			elems = append(elems, val)

			i++
		}

		if len(elems) == 0 {
			// Prefer a concrete type over a dynamic type when returning an
			// empty list
			if ety == cty.DynamicPseudoType {
				return cty.ListValEmpty(val.Type().ElementType()), nil
			}
			return cty.ListValEmpty(ety.WithoutOptionalAttributesDeep()), nil
		}

		if !cty.CanListVal(elems) {
			return cty.NilVal, path.NewErrorf("element types must all match for conversion to list")
		}

		return cty.ListVal(elems), nil
	}
}

// conversionCollectionToSet returns a conversion that will apply the given
// conversion to all of the elements of a collection (something that supports
// ForEachElement and LengthInt) and then returns the result as a set.
//
// "conv" can be nil if the elements are expected to already be of the
// correct type and just need to be re-wrapped into a set. (For example,
// if we're converting from a list into a set of the same element type.)
func conversionCollectionToSet(ety cty.Type, conv conversion) conversion {
	return func(val cty.Value, path cty.Path) (cty.Value, error) {
		elems := make([]cty.Value, 0, val.LengthInt())
		i := int64(0)
		elemPath := append(path.Copy(), nil)
		it := val.ElementIterator()
		for it.Next() {
			_, val := it.Element()
			var err error

			elemPath[len(elemPath)-1] = cty.IndexStep{
				Key: cty.NumberIntVal(i),
			}

			if conv != nil {
				val, err = conv(val, elemPath)
				if err != nil {
					return cty.NilVal, err
				}
			}

			if val.IsNull() {
				val = cty.NullVal(val.Type().WithoutOptionalAttributesDeep())
			}

			elems = append(elems, val)

			i++
		}

		if len(elems) == 0 {
			// Prefer a concrete type over a dynamic type when returning an
			// empty set
			if ety == cty.DynamicPseudoType {
				return cty.SetValEmpty(val.Type().ElementType()), nil
			}
			return cty.SetValEmpty(ety.WithoutOptionalAttributesDeep()), nil
		}

		if !cty.CanSetVal(elems) {
			return cty.NilVal, path.NewErrorf("element types must all match for conversion to set")
		}

		return cty.SetVal(elems), nil
	}
}

// conversionCollectionToMap returns a conversion that will apply the given
// conversion to all of the elements of a collection (something that supports
// ForEachElement and LengthInt) and then returns the result as a map.
//
// "conv" can be nil if the elements are expected to already be of the
// correct type and just need to be re-wrapped into a map.
func conversionCollectionToMap(ety cty.Type, conv conversion) conversion {
	return func(val cty.Value, path cty.Path) (cty.Value, error) {
		elems := make(map[string]cty.Value, 0)
		elemPath := append(path.Copy(), nil)
		it := val.ElementIterator()
		for it.Next() {
			key, val := it.Element()
			var err error

			elemPath[len(elemPath)-1] = cty.IndexStep{
				Key: key,
			}

			keyStr, err := Convert(key, cty.String)
			if err != nil {
				// Should never happen, because keys can only be numbers or
				// strings and both can convert to string.
				return cty.DynamicVal, elemPath.NewErrorf("cannot convert key type %s to string for map", key.Type().FriendlyName())
			}

			if conv != nil {
				val, err = conv(val, elemPath)
				if err != nil {
					return cty.NilVal, err
				}
			}

			elems[keyStr.AsString()] = val
		}

		if len(elems) == 0 {
			// Prefer a concrete type over a dynamic type when returning an
			// empty map
			if ety == cty.DynamicPseudoType {
				return cty.MapValEmpty(val.Type().ElementType()), nil
			}
			return cty.MapValEmpty(ety), nil
		}

		if ety.IsCollectionType() || ety.IsObjectType() {
			var err error
			if elems, err = conversionUnifyCollectionElements(elems, path, false); err != nil {
				return cty.NilVal, err
			}
		}

		if !cty.CanMapVal(elems) {
			return cty.NilVal, path.NewErrorf("element types must all match for conversion to map")
		}

		return cty.MapVal(elems), nil
	}
}

// conversionTupleToSet returns a conversion that will take a value of the
// given tuple type and return a set of the given element type.
//
// Will panic if the given tupleType isn't actually a tuple type.
func conversionTupleToSet(tupleType cty.Type, setEty cty.Type, unsafe bool) conversion {
	tupleEtys := tupleType.TupleElementTypes()

	if len(tupleEtys) == 0 {
		// Empty tuple short-circuit
		return func(val cty.Value, path cty.Path) (cty.Value, error) {
			return cty.SetValEmpty(setEty.WithoutOptionalAttributesDeep()), nil
		}
	}

	if setEty == cty.DynamicPseudoType {
		// This is a special case where the caller wants us to find
		// a suitable single type that all elements can convert to, if
		// possible.
		setEty, _ = unify(tupleEtys, unsafe)
		if setEty == cty.NilType {
			return nil
		}

		// If the set element type after unification is still the dynamic
		// type, the only way this can result in a valid set is if all values
		// are of dynamic type
		if setEty == cty.DynamicPseudoType {
			for _, tupleEty := range tupleEtys {
				if !tupleEty.Equals(cty.DynamicPseudoType) {
					return nil
				}
			}
		}
	}

	elemConvs := make([]conversion, len(tupleEtys))
	for i, tupleEty := range tupleEtys {
		if tupleEty.Equals(setEty) {
			// no conversion required
			continue
		}

		elemConvs[i] = getConversion(tupleEty, setEty, unsafe)
		if elemConvs[i] == nil {
			// If any of our element conversions are impossible, then the our
			// whole conversion is impossible.
			return nil
		}
	}

	// If we fall out here then a conversion is possible, using the
	// element conversions in elemConvs
	return func(val cty.Value, path cty.Path) (cty.Value, error) {
		elems := make([]cty.Value, 0, len(elemConvs))
		elemPath := append(path.Copy(), nil)
		i := int64(0)
		it := val.ElementIterator()
		for it.Next() {
			_, val := it.Element()
			var err error

			elemPath[len(elemPath)-1] = cty.IndexStep{
				Key: cty.NumberIntVal(i),
			}

			conv := elemConvs[i]
			if conv != nil {
				val, err = conv(val, elemPath)
				if err != nil {
					return cty.NilVal, err
				}
			}

			if val.IsNull() {
				val = cty.NullVal(val.Type().WithoutOptionalAttributesDeep())
			}

			elems = append(elems, val)

			i++
		}

		if !cty.CanSetVal(elems) {
			return cty.NilVal, path.NewErrorf("element types must all match for conversion to set")
		}

		return cty.SetVal(elems), nil
	}
}

// conversionTupleToList returns a conversion that will take a value of the
// given tuple type and return a list of the given element type.
//
// Will panic if the given tupleType isn't actually a tuple type.
func conversionTupleToList(tupleType cty.Type, listEty cty.Type, unsafe bool) conversion {
	tupleEtys := tupleType.TupleElementTypes()

	if len(tupleEtys) == 0 {
		// Empty tuple short-circuit
		return func(val cty.Value, path cty.Path) (cty.Value, error) {
			return cty.ListValEmpty(listEty.WithoutOptionalAttributesDeep()), nil
		}
	}

	if listEty == cty.DynamicPseudoType {
		// This is a special case where the caller wants us to find
		// a suitable single type that all elements can convert to, if
		// possible.
		listEty, _ = unify(tupleEtys, unsafe)
		if listEty == cty.NilType {
			return nil
		}

		// If the list element type after unification is still the dynamic
		// type, the only way this can result in a valid list is if all values
		// are of dynamic type
		if listEty == cty.DynamicPseudoType {
			for _, tupleEty := range tupleEtys {
				if !tupleEty.Equals(cty.DynamicPseudoType) {
					return nil
				}
			}
		}
	}

	elemConvs := make([]conversion, len(tupleEtys))
	for i, tupleEty := range tupleEtys {
		if tupleEty.Equals(listEty) {
			// no conversion required
			continue
		}

		elemConvs[i] = getConversion(tupleEty, listEty, unsafe)
		if elemConvs[i] == nil {
			// If any of our element conversions are impossible, then the our
			// whole conversion is impossible.
			return nil
		}
	}

	// If we fall out here then a conversion is possible, using the
	// element conversions in elemConvs
	return func(val cty.Value, path cty.Path) (cty.Value, error) {
		elems := make([]cty.Value, 0, len(elemConvs))
		elemTys := make([]cty.Type, 0, len(elems))
		elemPath := append(path.Copy(), nil)
		i := int64(0)
		it := val.ElementIterator()
		for it.Next() {
			_, val := it.Element()
			var err error

			elemPath[len(elemPath)-1] = cty.IndexStep{
				Key: cty.NumberIntVal(i),
			}

			conv := elemConvs[i]
			if conv != nil {
				val, err = conv(val, elemPath)
				if err != nil {
					return cty.NilVal, err
				}
			}
			elems = append(elems, val)
			elemTys = append(elemTys, val.Type())

			i++
		}

		elems, err := conversionUnifyListElements(elems, elemPath, unsafe)
		if err != nil {
			return cty.NilVal, err
		}

		if !cty.CanListVal(elems) {
			return cty.NilVal, path.NewErrorf("element types must all match for conversion to list")
		}

		return cty.ListVal(elems), nil
	}
}

// conversionObjectToMap returns a conversion that will take a value of the
// given object type and return a map of the given element type.
//
// Will panic if the given objectType isn't actually an object type.
func conversionObjectToMap(objectType cty.Type, mapEty cty.Type, unsafe bool) conversion {
	objectAtys := objectType.AttributeTypes()

	if len(objectAtys) == 0 {
		// Empty object short-circuit
		return func(val cty.Value, path cty.Path) (cty.Value, error) {
			return cty.MapValEmpty(mapEty.WithoutOptionalAttributesDeep()), nil
		}
	}

	if mapEty == cty.DynamicPseudoType {
		// This is a special case where the caller wants us to find
		// a suitable single type that all elements can convert to, if
		// possible.
		objectAtysList := make([]cty.Type, 0, len(objectAtys))
		for _, aty := range objectAtys {
			objectAtysList = append(objectAtysList, aty)
		}
		mapEty, _ = unify(objectAtysList, unsafe)
		if mapEty == cty.NilType {
			return nil
		}
	}

	elemConvs := make(map[string]conversion, len(objectAtys))
	for name, objectAty := range objectAtys {
		if objectAty.Equals(mapEty) {
			// no conversion required
			continue
		}

		elemConvs[name] = getConversion(objectAty, mapEty, unsafe)
		if elemConvs[name] == nil {
			// If any of our element conversions are impossible, then the our
			// whole conversion is impossible.
			return nil
		}
	}

	// If we fall out here then a conversion is possible, using the
	// element conversions in elemConvs
	return func(val cty.Value, path cty.Path) (cty.Value, error) {
		elems := make(map[string]cty.Value, len(elemConvs))
		elemPath := append(path.Copy(), nil)
		it := val.ElementIterator()
		for it.Next() {
			name, val := it.Element()
			var err error

			elemPath[len(elemPath)-1] = cty.IndexStep{
				Key: name,
			}

			conv := elemConvs[name.AsString()]
			if conv != nil {
				val, err = conv(val, elemPath)
				if err != nil {
					return cty.NilVal, err
				}
			}
			elems[name.AsString()] = val
		}

		if mapEty.IsCollectionType() || mapEty.IsObjectType() {
			var err error
			if elems, err = conversionUnifyCollectionElements(elems, path, unsafe); err != nil {
				return cty.NilVal, err
			}
		}

		if !cty.CanMapVal(elems) {
			return cty.NilVal, path.NewErrorf("attribute types must all match for conversion to map")
		}

		return cty.MapVal(elems), nil
	}
}

// conversionMapToObject returns a conversion that will take a value of the
// given map type and return an object of the given type. The object attribute
// types must all be compatible with the map element type.
//
// Will panic if the given mapType and objType are not maps and objects
// respectively.
func conversionMapToObject(mapType cty.Type, objType cty.Type, unsafe bool) conversion {
	objectAtys := objType.AttributeTypes()
	mapEty := mapType.ElementType()

	elemConvs := make(map[string]conversion, len(objectAtys))
	for name, objectAty := range objectAtys {
		if objectAty.Equals(mapEty) {
			// no conversion required
			continue
		}

		elemConvs[name] = getConversion(mapEty, objectAty, unsafe)
		if elemConvs[name] == nil {
			// This means that this conversion is impossible. Typically, we
			// would give up at this point and declare the whole conversion
			// impossible. But, if this attribute is optional then maybe we will
			// be able to do this conversion anyway provided the actual concrete
			// map doesn't have this value set.
			//
			// We only do this in "unsafe" mode, because we cannot guarantee
			// that the returned conversion will actually succeed once applied.
			if objType.AttributeOptional(name) && unsafe {
				// This attribute is optional, so let's leave this conversion in
				// as a nil, and we can error later if we actually have to
				// convert this.
				continue
			}

			// Otherwise, give up. This conversion is impossible as we have a
			// required attribute that doesn't match the map's inner type.
			return nil
		}
	}

	// If we fall out here then a conversion may be possible, using the
	// element conversions in elemConvs
	return func(val cty.Value, path cty.Path) (cty.Value, error) {
		elems := make(map[string]cty.Value, len(elemConvs))
		elemPath := append(path.Copy(), nil)
		it := val.ElementIterator()
		for it.Next() {
			name, val := it.Element()

			// if there is no corresponding attribute, we skip this key
			if _, ok := objectAtys[name.AsString()]; !ok {
				continue
			}

			var err error

			elemPath[len(elemPath)-1] = cty.IndexStep{
				Key: name,
			}

			// There are 3 cases here:
			//   1. This attribute is not in elemConvs
			//   2. This attribute is in elemConvs and is not nil
			//   3. This attribute is in elemConvs and is nil.

			// In case 1, we do not enter any of the branches below. This case
			// means the attribute type is the same between the map and the
			// object, and we don't need to do any conversion.

			if conv, ok := elemConvs[name.AsString()]; conv != nil {
				// This is case 2. The attribute type is different between the
				// map and the object, and we know how to convert between them.
				// So, we reset val to be the converted value and carry on.
				val, err = conv(val, elemPath)
				if err != nil {
					return cty.NilVal, err
				}
			} else if ok {
				// This is case 3 and it is an error. The attribute types are
				// different between the map and the object, but we cannot
				// convert between them.
				//
				// Now typically, this would be picked earlier on when we were
				// building elemConvs. However, in the case of optional
				// attributes there was a chance we could still convert the
				// overall object even if this particular attribute was not
				// convertable. This is because it could have not been set in
				// the map, and we could skip over it here and set a null value.
				//
				// Since we reached this branch, we know that map did actually
				// contain a non-convertable optional attribute. This means we
				// error.
				return cty.NilVal, path.NewErrorf("map element type is incompatible with attribute %q: %s", name.AsString(), MismatchMessage(val.Type(), objType.AttributeType(name.AsString())))
			}

			if val.IsNull() {
				val = cty.NullVal(val.Type().WithoutOptionalAttributesDeep())
			}

			elems[name.AsString()] = val
		}

		for name, aty := range objectAtys {
			if _, exists := elems[name]; !exists {
				if optional := objType.AttributeOptional(name); optional {
					elems[name] = cty.NullVal(aty)
				} else {
					return cty.NilVal, path.NewErrorf("map has no element for required attribute %q", name)
				}
			}
		}

		return cty.ObjectVal(elems), nil
	}
}

func conversionUnifyCollectionElements(elems map[string]cty.Value, path cty.Path, unsafe bool) (map[string]cty.Value, error) {
	elemTypes := make([]cty.Type, 0, len(elems))
	for _, elem := range elems {
		elemTypes = append(elemTypes, elem.Type())
	}
	unifiedType, _ := unify(elemTypes, unsafe)
	if unifiedType == cty.NilType {
		return nil, path.NewErrorf("cannot find a common base type for all elements")
	}

	unifiedElems := make(map[string]cty.Value)
	elemPath := append(path.Copy(), nil)

	for name, elem := range elems {
		if elem.Type().Equals(unifiedType) {
			unifiedElems[name] = elem
			continue
		}
		conv := getConversion(elem.Type(), unifiedType, unsafe)
		if conv == nil {
		}
		elemPath[len(elemPath)-1] = cty.IndexStep{
			Key: cty.StringVal(name),
		}
		val, err := conv(elem, elemPath)
		if err != nil {
			return nil, err
		}
		unifiedElems[name] = val
	}

	return unifiedElems, nil
}

func conversionUnifyListElements(elems []cty.Value, path cty.Path, unsafe bool) ([]cty.Value, error) {
	elemTypes := make([]cty.Type, len(elems))
	for i, elem := range elems {
		elemTypes[i] = elem.Type()
	}
	unifiedType, _ := unify(elemTypes, unsafe)
	if unifiedType == cty.NilType {
		return nil, path.NewErrorf("cannot find a common base type for all elements")
	}

	ret := make([]cty.Value, len(elems))
	elemPath := append(path.Copy(), nil)

	for i, elem := range elems {
		if elem.Type().Equals(unifiedType) {
			ret[i] = elem
			continue
		}
		conv := getConversion(elem.Type(), unifiedType, unsafe)
		if conv == nil {
		}
		elemPath[len(elemPath)-1] = cty.IndexStep{
			Key: cty.NumberIntVal(int64(i)),
		}
		val, err := conv(elem, elemPath)
		if err != nil {
			return nil, err
		}
		ret[i] = val
	}

	return ret, nil
}
