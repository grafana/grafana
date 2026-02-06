package convert

import (
	"github.com/zclconf/go-cty/cty"
)

// compareTypes implements a preference order for unification.
//
// The result of this method is not useful for anything other than unification
// preferences, since it assumes that the caller will verify that any suggested
// conversion is actually possible and it is thus able to to make certain
// optimistic assumptions.
func compareTypes(a cty.Type, b cty.Type) int {

	// DynamicPseudoType always has lowest preference, because anything can
	// convert to it (it acts as a placeholder for "any type") and we want
	// to optimistically assume that any dynamics will converge on matching
	// their neighbors.
	if a == cty.DynamicPseudoType || b == cty.DynamicPseudoType {
		if a != cty.DynamicPseudoType {
			return -1
		}
		if b != cty.DynamicPseudoType {
			return 1
		}
		return 0
	}

	if a.IsPrimitiveType() && b.IsPrimitiveType() {
		// String is a supertype of all primitive types, because we can
		// represent all primitive values as specially-formatted strings.
		if a == cty.String || b == cty.String {
			if a != cty.String {
				return 1
			}
			if b != cty.String {
				return -1
			}
			return 0
		}
	}

	if a.IsListType() && b.IsListType() {
		return compareTypes(a.ElementType(), b.ElementType())
	}
	if a.IsSetType() && b.IsSetType() {
		return compareTypes(a.ElementType(), b.ElementType())
	}
	if a.IsMapType() && b.IsMapType() {
		return compareTypes(a.ElementType(), b.ElementType())
	}

	// From this point on we may have swapped the two items in order to
	// simplify our cases. Therefore any non-zero return after this point
	// must be multiplied by "swap" to potentially invert the return value
	// if needed.
	swap := 1
	switch {
	case a.IsTupleType() && b.IsListType():
		fallthrough
	case a.IsObjectType() && b.IsMapType():
		fallthrough
	case a.IsSetType() && b.IsTupleType():
		fallthrough
	case a.IsSetType() && b.IsListType():
		a, b = b, a
		swap = -1
	}

	if b.IsSetType() && (a.IsTupleType() || a.IsListType()) {
		// We'll just optimistically assume that the element types are
		// unifyable/convertible, and let a second recursive pass
		// figure out how to make that so.
		return -1 * swap
	}

	if a.IsListType() && b.IsTupleType() {
		// We'll just optimistically assume that the tuple's element types
		// can be unified into something compatible with the list's element
		// type.
		return -1 * swap
	}

	if a.IsMapType() && b.IsObjectType() {
		// We'll just optimistically assume that the object's attribute types
		// can be unified into something compatible with the map's element
		// type.
		return -1 * swap
	}

	// For object and tuple types, comparing two types doesn't really tell
	// the whole story because it may be possible to construct a new type C
	// that is the supertype of both A and B by unifying each attribute/element
	// separately. That possibility is handled by Unify as a follow-up if
	// type sorting is insufficient to produce a valid result.
	//
	// Here we will take care of the simple possibilities where no new type
	// is needed.
	if a.IsObjectType() && b.IsObjectType() {
		atysA := a.AttributeTypes()
		atysB := b.AttributeTypes()

		if len(atysA) != len(atysB) {
			return 0
		}

		hasASuper := false
		hasBSuper := false
		for k := range atysA {
			if _, has := atysB[k]; !has {
				return 0
			}

			cmp := compareTypes(atysA[k], atysB[k])
			if cmp < 0 {
				hasASuper = true
			} else if cmp > 0 {
				hasBSuper = true
			}
		}

		switch {
		case hasASuper && hasBSuper:
			return 0
		case hasASuper:
			return -1 * swap
		case hasBSuper:
			return 1 * swap
		default:
			return 0
		}
	}
	if a.IsTupleType() && b.IsTupleType() {
		etysA := a.TupleElementTypes()
		etysB := b.TupleElementTypes()

		if len(etysA) != len(etysB) {
			return 0
		}

		hasASuper := false
		hasBSuper := false
		for i := range etysA {
			cmp := compareTypes(etysA[i], etysB[i])
			if cmp < 0 {
				hasASuper = true
			} else if cmp > 0 {
				hasBSuper = true
			}
		}

		switch {
		case hasASuper && hasBSuper:
			return 0
		case hasASuper:
			return -1 * swap
		case hasBSuper:
			return 1 * swap
		default:
			return 0
		}
	}

	return 0
}
