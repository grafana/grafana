package cty

// Value represents a value of a particular type, and is the interface by
// which operations are executed on typed values.
//
// Value has two different classes of method. Operation methods stay entirely
// within the type system (methods accept and return Value instances) and
// are intended for use in implementing a language in terms of cty, while
// integration methods either enter or leave the type system, working with
// native Go values. Operation methods are guaranteed to support all of the
// expected short-circuit behavior for unknown and dynamic values, while
// integration methods may not.
//
// The philosophy for the operations API is that it's the caller's
// responsibility to ensure that the given types and values satisfy the
// specified invariants during a separate type check, so that the caller is
// able to return errors to its user from the application's own perspective.
//
// Consequently the design of these methods assumes such checks have already
// been done and panics if any invariants turn out not to be satisfied. These
// panic errors are not intended to be handled, but rather indicate a bug in
// the calling application that should be fixed with more checks prior to
// executing operations.
//
// A related consequence of this philosophy is that no automatic type
// conversions are done. If a method specifies that its argument must be
// number then it's the caller's responsibility to do that conversion before
// the call, thus allowing the application to have more constrained conversion
// rules than are offered by the built-in converter where necessary.
type Value struct {
	ty Type
	v  interface{}
}

// Type returns the type of the value.
func (val Value) Type() Type {
	return val.ty
}

// IsKnown returns true if the value is known. That is, if it is not
// the result of the unknown value constructor Unknown(...), and is not
// the result of an operation on another unknown value.
//
// Unknown values are only produced either directly or as a result of
// operating on other unknown values, and so an application that never
// introduces Unknown values can be guaranteed to never receive any either.
func (val Value) IsKnown() bool {
	if val.IsMarked() {
		return val.unmarkForce().IsKnown()
	}
	_, unknown := val.v.(*unknownType)
	return !unknown
}

// IsNull returns true if the value is null. Values of any type can be
// null, but any operations on a null value will panic. No operation ever
// produces null, so an application that never introduces Null values can
// be guaranteed to never receive any either.
func (val Value) IsNull() bool {
	if val.IsMarked() {
		return val.unmarkForce().IsNull()
	}
	return val.v == nil
}

// NilVal is an invalid Value that can be used as a placeholder when returning
// with an error from a function that returns (Value, error).
//
// NilVal is *not* a valid error and so no operations may be performed on it.
// Any attempt to use it will result in a panic.
//
// This should not be confused with the idea of a Null value, as returned by
// NullVal. NilVal is a nil within the *Go* type system, and is invalid in
// the cty type system. Null values *do* exist in the cty type system.
var NilVal = Value{
	ty: Type{typeImpl: nil},
	v:  nil,
}

// IsWhollyKnown is an extension of IsKnown that also recursively checks
// inside collections and structures to see if there are any nested unknown
// values.
func (val Value) IsWhollyKnown() bool {
	if val.IsMarked() {
		return val.unmarkForce().IsWhollyKnown()
	}

	if !val.IsKnown() {
		return false
	}

	if val.IsNull() {
		// Can't recurse into a null, so we're done
		return true
	}

	switch {
	case val.CanIterateElements():
		for it := val.ElementIterator(); it.Next(); {
			_, ev := it.Element()
			if !ev.IsWhollyKnown() {
				return false
			}
		}
		return true
	default:
		return true
	}
}

// HasWhollyKnownType checks if the value is dynamic, or contains any nested
// DynamicVal. This implies that both the value is not known, and the final
// type may change.
func (val Value) HasWhollyKnownType() bool {
	// a null dynamic type is known
	if val.IsNull() {
		return true
	}

	// an unknown DynamicPseudoType is a DynamicVal, but we don't want to
	// check that value for equality here, since this method is used within the
	// equality check.
	if !val.IsKnown() && val.ty == DynamicPseudoType {
		return false
	}

	if val.CanIterateElements() {
		// if the value is not known, then we can look directly at the internal
		// types
		if !val.IsKnown() {
			return !val.ty.HasDynamicTypes()
		}

		for it := val.ElementIterator(); it.Next(); {
			_, ev := it.Element()
			if !ev.HasWhollyKnownType() {
				return false
			}
		}
	}

	return true
}
