package cty

// TestConformance recursively walks the receiver and the given other type and
// returns nil if the receiver *conforms* to the given type.
//
// Type conformance is similar to type equality but has one crucial difference:
// PseudoTypeDynamic can be used within the given type to represent that
// *any* type is allowed.
//
// If any non-conformities are found, the returned slice will be non-nil and
// contain at least one error value. It will be nil if the type is entirely
// conformant.
//
// Note that the special behavior of PseudoTypeDynamic is the *only* exception
// to normal type equality. Calling applications may wish to apply their own
// automatic conversion logic to the given data structure to create a more
// liberal notion of conformance to a type.
//
// Returned errors are usually (but not always) PathError instances that
// indicate where in the structure the error was found. If a returned error
// is of that type then the error message is written for (English-speaking)
// end-users working within the cty type system, not mentioning any Go-oriented
// implementation details.
func (t Type) TestConformance(other Type) []error {
	path := make(Path, 0)
	var errs []error
	testConformance(t, other, path, &errs)
	return errs
}

func testConformance(given Type, want Type, path Path, errs *[]error) {
	if want.Equals(DynamicPseudoType) {
		// anything goes!
		return
	}

	if given.Equals(want) {
		// Any equal types are always conformant
		return
	}

	// The remainder of this function is concerned with detecting
	// and reporting the specific non-conformance, since we wouldn't
	// have got here if the types were not divergent.
	// We treat compound structures as special so that we can report
	// specifically what is non-conforming, rather than simply returning
	// the entire type names and letting the user puzzle it out.

	if given.IsObjectType() && want.IsObjectType() {
		givenAttrs := given.AttributeTypes()
		wantAttrs := want.AttributeTypes()

		for k := range givenAttrs {
			if _, exists := wantAttrs[k]; !exists {
				*errs = append(
					*errs,
					errorf(path, "unsupported attribute %q", k),
				)
			}
		}
		for k := range wantAttrs {
			if _, exists := givenAttrs[k]; !exists {
				*errs = append(
					*errs,
					errorf(path, "missing required attribute %q", k),
				)
			}
		}

		path = append(path, nil)
		pathIdx := len(path) - 1

		for k, wantAttrType := range wantAttrs {
			if givenAttrType, exists := givenAttrs[k]; exists {
				path[pathIdx] = GetAttrStep{Name: k}
				testConformance(givenAttrType, wantAttrType, path, errs)
			}
		}

		path = path[0:pathIdx]

		return
	}

	if given.IsTupleType() && want.IsTupleType() {
		givenElems := given.TupleElementTypes()
		wantElems := want.TupleElementTypes()

		if len(givenElems) != len(wantElems) {
			*errs = append(
				*errs,
				errorf(path, "%d elements are required, but got %d", len(wantElems), len(givenElems)),
			)
			return
		}

		path = append(path, nil)
		pathIdx := len(path) - 1

		for i, wantElemType := range wantElems {
			givenElemType := givenElems[i]
			path[pathIdx] = IndexStep{Key: NumberIntVal(int64(i))}
			testConformance(givenElemType, wantElemType, path, errs)
		}

		path = path[0:pathIdx]

		return
	}

	if given.IsListType() && want.IsListType() {
		path = append(path, IndexStep{Key: UnknownVal(Number)})
		pathIdx := len(path) - 1
		testConformance(given.ElementType(), want.ElementType(), path, errs)
		path = path[0:pathIdx]
		return
	}

	if given.IsMapType() && want.IsMapType() {
		path = append(path, IndexStep{Key: UnknownVal(String)})
		pathIdx := len(path) - 1
		testConformance(given.ElementType(), want.ElementType(), path, errs)
		path = path[0:pathIdx]
		return
	}

	if given.IsSetType() && want.IsSetType() {
		path = append(path, IndexStep{Key: UnknownVal(given.ElementType())})
		pathIdx := len(path) - 1
		testConformance(given.ElementType(), want.ElementType(), path, errs)
		path = path[0:pathIdx]
		return
	}

	*errs = append(
		*errs,
		errorf(path, "%s required, but received %s", want.FriendlyName(), given.FriendlyName()),
	)
}
