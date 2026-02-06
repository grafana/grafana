package cty

import (
	"fmt"
	"reflect"
)

type capsuleType struct {
	typeImplSigil
	Name   string
	GoType reflect.Type
	Ops    *CapsuleOps
}

func (t *capsuleType) Equals(other Type) bool {
	if otherP, ok := other.typeImpl.(*capsuleType); ok {
		// capsule types compare by pointer identity
		return otherP == t
	}
	return false
}

func (t *capsuleType) FriendlyName(mode friendlyTypeNameMode) string {
	return t.Name
}

func (t *capsuleType) GoString() string {
	impl := t.Ops.TypeGoString
	if impl == nil {
		// To get a useful representation of our native type requires some
		// shenanigans.
		victimVal := reflect.Zero(t.GoType)
		if t.Ops == noCapsuleOps {
			return fmt.Sprintf("cty.Capsule(%q, reflect.TypeOf(%#v))", t.Name, victimVal.Interface())
		} else {
			// Including the operations in the output will make this _very_ long,
			// so in practice any capsule type with ops ought to provide a
			// TypeGoString function to override this with something more
			// reasonable.
			return fmt.Sprintf("cty.CapsuleWithOps(%q, reflect.TypeOf(%#v), %#v)", t.Name, victimVal.Interface(), t.Ops)
		}
	}
	return impl(t.GoType)
}

// Capsule creates a new Capsule type.
//
// A Capsule type is a special type that can be used to transport arbitrary
// Go native values of a given type through the cty type system. A language
// that uses cty as its type system might, for example, provide functions
// that return capsule-typed values and then other functions that operate
// on those values.
//
// From cty's perspective, Capsule types have a few interesting characteristics,
// described in the following paragraphs.
//
// Each capsule type has an associated Go native type that it is able to
// transport. Capsule types compare by identity, so each call to the
// Capsule function creates an entirely-distinct cty Type, even if two calls
// use the same native type.
//
// Each capsule-typed value contains a pointer to a value of the given native
// type. A capsule-typed value by default supports no operations except
// equality, and equality is implemented by pointer identity of the
// encapsulated pointer. A capsule type can optionally have its own
// implementations of certain operations if it is created with CapsuleWithOps
// instead of Capsule.
//
// The given name is used as the new type's "friendly name". This can be any
// string in principle, but will usually be a short, all-lowercase name aimed
// at users of the embedding language (i.e. not mention Go-specific details)
// and will ideally not create ambiguity with any predefined cty type.
//
// Capsule types are never introduced by any standard cty operation, so a
// calling application opts in to including them within its own type system
// by creating them and introducing them via its own functions. At that point,
// the application is responsible for dealing with any capsule-typed values
// that might be returned.
func Capsule(name string, nativeType reflect.Type) Type {
	return Type{
		&capsuleType{
			Name:   name,
			GoType: nativeType,
			Ops:    noCapsuleOps,
		},
	}
}

// CapsuleWithOps is like Capsule except the caller may provide an object
// representing some overloaded operation implementations to associate with
// the given capsule type.
//
// All of the other caveats and restrictions for capsule types still apply, but
// overloaded operations can potentially help a capsule type participate better
// in cty operations.
func CapsuleWithOps(name string, nativeType reflect.Type, ops *CapsuleOps) Type {
	// Copy the operations to make sure the caller can't modify them after
	// we're constructed.
	ourOps := *ops
	ourOps.assertValid()

	return Type{
		&capsuleType{
			Name:   name,
			GoType: nativeType,
			Ops:    &ourOps,
		},
	}
}

// IsCapsuleType returns true if this type is a capsule type, as created
// by cty.Capsule .
func (t Type) IsCapsuleType() bool {
	_, ok := t.typeImpl.(*capsuleType)
	return ok
}

// EncapsulatedType returns the encapsulated native type of a capsule type,
// or panics if the receiver is not a Capsule type.
//
// Is IsCapsuleType to determine if this method is safe to call.
func (t Type) EncapsulatedType() reflect.Type {
	impl, ok := t.typeImpl.(*capsuleType)
	if !ok {
		panic("not a capsule type")
	}
	return impl.GoType
}
