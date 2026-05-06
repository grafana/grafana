package cty

import (
	"fmt"
)

// TypeList instances represent specific list types. Each distinct ElementType
// creates a distinct, non-equal list type.
type typeMap struct {
	typeImplSigil
	ElementTypeT Type
}

// Map creates a map type with the given element Type.
//
// Map types are CollectionType implementations.
func Map(elem Type) Type {
	return Type{
		typeMap{
			ElementTypeT: elem,
		},
	}
}

// Equals returns true if the other Type is a map whose element type is
// equal to that of the receiver.
func (t typeMap) Equals(other Type) bool {
	ot, isMap := other.typeImpl.(typeMap)
	if !isMap {
		return false
	}

	return t.ElementTypeT.Equals(ot.ElementTypeT)
}

func (t typeMap) FriendlyName(mode friendlyTypeNameMode) string {
	elemName := t.ElementTypeT.friendlyNameMode(mode)
	if mode == friendlyTypeConstraintName {
		if t.ElementTypeT == DynamicPseudoType {
			elemName = "any single type"
		}
	}
	return "map of " + elemName
}

func (t typeMap) ElementType() Type {
	return t.ElementTypeT
}

func (t typeMap) GoString() string {
	return fmt.Sprintf("cty.Map(%#v)", t.ElementTypeT)
}

// IsMapType returns true if the given type is a map type, regardless of its
// element type.
func (t Type) IsMapType() bool {
	_, ok := t.typeImpl.(typeMap)
	return ok
}

// MapElementType is a convenience method that checks if the given type is
// a map type, returning a pointer to its element type if so and nil
// otherwise. This is intended to allow convenient conditional branches,
// like so:
//
//     if et := t.MapElementType(); et != nil {
//         // Do something with *et
//     }
func (t Type) MapElementType() *Type {
	if lt, ok := t.typeImpl.(typeMap); ok {
		return &lt.ElementTypeT
	}
	return nil
}
