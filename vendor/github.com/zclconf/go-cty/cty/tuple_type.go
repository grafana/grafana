package cty

import (
	"fmt"
)

type typeTuple struct {
	typeImplSigil
	ElemTypes []Type
}

// Tuple creates a tuple type with the given element types.
//
// After a slice is passed to this function the caller must no longer access
// the underlying array, since ownership is transferred to this library.
func Tuple(elemTypes []Type) Type {
	return Type{
		typeTuple{
			ElemTypes: elemTypes,
		},
	}
}

func (t typeTuple) Equals(other Type) bool {
	if ot, ok := other.typeImpl.(typeTuple); ok {
		if len(t.ElemTypes) != len(ot.ElemTypes) {
			// Fast path: if we don't have the same number of elements
			// then we can't possibly be equal.
			return false
		}

		for i, ty := range t.ElemTypes {
			oty := ot.ElemTypes[i]
			if !ok {
				return false
			}
			if !oty.Equals(ty) {
				return false
			}
		}

		return true
	}
	return false
}

func (t typeTuple) FriendlyName(mode friendlyTypeNameMode) string {
	// There isn't really a friendly way to write a tuple type due to its
	// complexity, so we'll just do something English-ish. Callers will
	// probably want to make some extra effort to avoid ever printing out
	// a tuple type FriendlyName in its entirety. For example, could
	// produce an error message by diffing two object types and saying
	// something like "Expected attribute foo to be string, but got number".
	// TODO: Finish this
	return "tuple"
}

func (t typeTuple) GoString() string {
	if len(t.ElemTypes) == 0 {
		return "cty.EmptyTuple"
	}
	return fmt.Sprintf("cty.Tuple(%#v)", t.ElemTypes)
}

// EmptyTuple is a shorthand for Tuple([]Type{}), to more easily talk about
// the empty tuple type.
var EmptyTuple Type

// EmptyTupleVal is the only possible non-null, non-unknown value of type
// EmptyTuple.
var EmptyTupleVal Value

func init() {
	EmptyTuple = Tuple([]Type{})
	EmptyTupleVal = Value{
		ty: EmptyTuple,
		v:  []interface{}{},
	}
}

// IsTupleType returns true if the given type is an object type, regardless
// of its element type.
func (t Type) IsTupleType() bool {
	_, ok := t.typeImpl.(typeTuple)
	return ok
}

// Length returns the number of elements of the receiving tuple type.
// Will panic if the reciever isn't a tuple type; use IsTupleType to determine
// whether this operation will succeed.
func (t Type) Length() int {
	if ot, ok := t.typeImpl.(typeTuple); ok {
		return len(ot.ElemTypes)
	}
	panic("Length on non-tuple Type")
}

// TupleElementType returns the type of the element with the given index. Will
// panic if the receiver is not a tuple type (use IsTupleType to confirm)
// or if the index is out of range (use Length to confirm).
func (t Type) TupleElementType(idx int) Type {
	if ot, ok := t.typeImpl.(typeTuple); ok {
		return ot.ElemTypes[idx]
	}
	panic("TupleElementType on non-tuple Type")
}

// TupleElementTypes returns a slice of the recieving tuple type's element
// types. Will panic if the receiver is not a tuple type (use IsTupleType
// to confirm).
//
// The returned slice is part of the internal state of the type, and is provided
// for read access only. It is forbidden for any caller to modify the
// underlying array. For many purposes the element-related methods of Value
// are more appropriate and more convenient to use.
func (t Type) TupleElementTypes() []Type {
	if ot, ok := t.typeImpl.(typeTuple); ok {
		return ot.ElemTypes
	}
	panic("TupleElementTypes on non-tuple Type")
}
