package cty

import (
	"fmt"
)

// TypeList instances represent specific list types. Each distinct ElementType
// creates a distinct, non-equal list type.
type typeList struct {
	typeImplSigil
	ElementTypeT Type
}

// List creates a map type with the given element Type.
//
// List types are CollectionType implementations.
func List(elem Type) Type {
	return Type{
		typeList{
			ElementTypeT: elem,
		},
	}
}

// Equals returns true if the other Type is a list whose element type is
// equal to that of the receiver.
func (t typeList) Equals(other Type) bool {
	ot, isList := other.typeImpl.(typeList)
	if !isList {
		return false
	}

	return t.ElementTypeT.Equals(ot.ElementTypeT)
}

func (t typeList) FriendlyName(mode friendlyTypeNameMode) string {
	elemName := t.ElementTypeT.friendlyNameMode(mode)
	if mode == friendlyTypeConstraintName {
		if t.ElementTypeT == DynamicPseudoType {
			elemName = "any single type"
		}
	}
	return "list of " + elemName
}

func (t typeList) ElementType() Type {
	return t.ElementTypeT
}

func (t typeList) GoString() string {
	return fmt.Sprintf("cty.List(%#v)", t.ElementTypeT)
}

// IsListType returns true if the given type is a list type, regardless of its
// element type.
func (t Type) IsListType() bool {
	_, ok := t.typeImpl.(typeList)
	return ok
}

// ListElementType is a convenience method that checks if the given type is
// a list type, returning a pointer to its element type if so and nil
// otherwise. This is intended to allow convenient conditional branches,
// like so:
//
//     if et := t.ListElementType(); et != nil {
//         // Do something with *et
//     }
func (t Type) ListElementType() *Type {
	if lt, ok := t.typeImpl.(typeList); ok {
		return &lt.ElementTypeT
	}
	return nil
}
