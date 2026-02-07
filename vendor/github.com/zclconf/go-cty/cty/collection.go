package cty

import (
	"errors"
)

type collectionTypeImpl interface {
	ElementType() Type
}

// IsCollectionType returns true if the given type supports the operations
// that are defined for all collection types.
func (t Type) IsCollectionType() bool {
	_, ok := t.typeImpl.(collectionTypeImpl)
	return ok
}

// ElementType returns the element type of the receiver if it is a collection
// type, or panics if it is not. Use IsCollectionType first to test whether
// this method will succeed.
func (t Type) ElementType() Type {
	if ct, ok := t.typeImpl.(collectionTypeImpl); ok {
		return ct.ElementType()
	}
	panic(errors.New("not a collection type"))
}

// ElementCallback is a callback type used for iterating over elements of
// collections and attributes of objects.
//
// The types of key and value depend on what type is being iterated over.
// Return true to stop iterating after the current element, or false to
// continue iterating.
type ElementCallback func(key Value, val Value) (stop bool)
