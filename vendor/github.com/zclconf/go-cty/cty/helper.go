package cty

import (
	"fmt"
)

// anyUnknown is a helper to easily check if a set of values contains any
// unknowns, for operations that short-circuit to return unknown in that case.
func anyUnknown(values ...Value) bool {
	for _, val := range values {
		if _, unknown := val.v.(*unknownType); unknown {
			return true
		}
	}
	return false
}

// typeCheck tests whether all of the given values belong to the given type.
// If the given types are a mixture of the given type and the dynamic
// pseudo-type then a short-circuit dynamic value is returned. If the given
// values are all of the correct type but at least one is unknown then
// a short-circuit unknown value is returned. If any other types appear then
// an error is returned. Otherwise (finally!) the result is nil, nil.
func typeCheck(required Type, ret Type, values ...Value) (shortCircuit *Value, err error) {
	hasDynamic := false
	hasUnknown := false

	for i, val := range values {
		if val.ty == DynamicPseudoType {
			hasDynamic = true
			continue
		}

		if !val.Type().Equals(required) {
			return nil, fmt.Errorf(
				"type mismatch: want %s but value %d is %s",
				required.FriendlyName(),
				i, val.ty.FriendlyName(),
			)
		}

		if _, unknown := val.v.(*unknownType); unknown {
			hasUnknown = true
		}
	}

	if hasDynamic {
		return &DynamicVal, nil
	}

	if hasUnknown {
		ret := UnknownVal(ret)
		return &ret, nil
	}

	return nil, nil
}

// mustTypeCheck is a wrapper around typeCheck that immediately panics if
// any error is returned.
func mustTypeCheck(required Type, ret Type, values ...Value) *Value {
	shortCircuit, err := typeCheck(required, ret, values...)
	if err != nil {
		panic(err)
	}
	return shortCircuit
}

// shortCircuitForceType takes the return value from mustTypeCheck and
// replaces it with an unknown of the given type if the original value was
// DynamicVal.
//
// This is useful for operations that are specified to always return a
// particular type, since then a dynamic result can safely be "upgrade" to
// a strongly-typed unknown, which then allows subsequent operations to
// be actually type-checked.
//
// It is safe to use this only if the operation in question is defined as
// returning either a value of the given type or panicking, since we know
// then that subsequent operations won't run if the operation panics.
//
// If the given short-circuit value is *not* DynamicVal then it must be
// of the given type, or this function will panic.
func forceShortCircuitType(shortCircuit *Value, ty Type) *Value {
	if shortCircuit == nil {
		return nil
	}

	if shortCircuit.ty == DynamicPseudoType {
		ret := UnknownVal(ty)
		return &ret
	}

	if !shortCircuit.ty.Equals(ty) {
		panic("forceShortCircuitType got value of wrong type")
	}

	return shortCircuit
}
