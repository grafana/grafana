package cty

// Type represents value types within the type system.
//
// This is a closed interface type, meaning that only the concrete
// implementations provided within this package are considered valid.
type Type struct {
	typeImpl
}

type typeImpl interface {
	// isTypeImpl is a do-nothing method that exists only to express
	// that a type is an implementation of typeImpl.
	isTypeImpl() typeImplSigil

	// Equals returns true if the other given Type exactly equals the
	// receiver Type.
	Equals(other Type) bool

	// FriendlyName returns a human-friendly *English* name for the given
	// type.
	FriendlyName(mode friendlyTypeNameMode) string

	// GoString implements the GoStringer interface from package fmt.
	GoString() string
}

// Base implementation of Type to embed into concrete implementations
// to signal that they are implementations of Type.
type typeImplSigil struct{}

func (t typeImplSigil) isTypeImpl() typeImplSigil {
	return typeImplSigil{}
}

// Equals returns true if the other given Type exactly equals the receiver
// type.
func (t Type) Equals(other Type) bool {
	if t == NilType || other == NilType {
		return t == other
	}
	return t.typeImpl.Equals(other)
}

// FriendlyName returns a human-friendly *English* name for the given type.
func (t Type) FriendlyName() string {
	return t.typeImpl.FriendlyName(friendlyTypeName)
}

// FriendlyNameForConstraint is similar to FriendlyName except that the
// result is specialized for describing type _constraints_ rather than types
// themselves. This is more appropriate when reporting that a particular value
// does not conform to an expected type constraint.
//
// In particular, this function uses the term "any type" to refer to
// cty.DynamicPseudoType, rather than "dynamic" as returned by FriendlyName.
func (t Type) FriendlyNameForConstraint() string {
	return t.typeImpl.FriendlyName(friendlyTypeConstraintName)
}

// friendlyNameMode is an internal combination of the various FriendlyName*
// variants that just directly takes a mode, for easy passthrough for
// recursive name construction.
func (t Type) friendlyNameMode(mode friendlyTypeNameMode) string {
	return t.typeImpl.FriendlyName(mode)
}

// GoString returns a string approximating how the receiver type would be
// expressed in Go source code.
func (t Type) GoString() string {
	if t.typeImpl == nil {
		return "cty.NilType"
	}

	return t.typeImpl.GoString()
}

// NilType is an invalid type used when a function is returning an error
// and has no useful type to return. It should not be used and any methods
// called on it will panic.
var NilType = Type{}

// HasDynamicTypes returns true either if the receiver is itself
// DynamicPseudoType or if it is a compound type whose descendent elements
// are DynamicPseudoType.
func (t Type) HasDynamicTypes() bool {
	switch {
	case t == DynamicPseudoType:
		return true
	case t.IsPrimitiveType():
		return false
	case t.IsCollectionType():
		return t.ElementType().HasDynamicTypes()
	case t.IsObjectType():
		attrTypes := t.AttributeTypes()
		for _, at := range attrTypes {
			if at.HasDynamicTypes() {
				return true
			}
		}
		return false
	case t.IsTupleType():
		elemTypes := t.TupleElementTypes()
		for _, et := range elemTypes {
			if et.HasDynamicTypes() {
				return true
			}
		}
		return false
	case t.IsCapsuleType():
		return false
	default:
		// Should never happen, since above should be exhaustive
		panic("HasDynamicTypes does not support the given type")
	}
}

// WithoutOptionalAttributesDeep returns a type equivalent to the receiver but
// with any objects with optional attributes converted into fully concrete
// object types. This operation is applied recursively.
func (t Type) WithoutOptionalAttributesDeep() Type {
	switch {
	case t == DynamicPseudoType, t.IsPrimitiveType(), t.IsCapsuleType():
		return t
	case t.IsMapType():
		return Map(t.ElementType().WithoutOptionalAttributesDeep())
	case t.IsListType():
		return List(t.ElementType().WithoutOptionalAttributesDeep())
	case t.IsSetType():
		return Set(t.ElementType().WithoutOptionalAttributesDeep())
	case t.IsTupleType():
		originalElemTypes := t.TupleElementTypes()
		elemTypes := make([]Type, len(originalElemTypes))
		for i, et := range originalElemTypes {
			elemTypes[i] = et.WithoutOptionalAttributesDeep()
		}
		return Tuple(elemTypes)
	case t.IsObjectType():
		originalAttrTypes := t.AttributeTypes()
		attrTypes := make(map[string]Type, len(originalAttrTypes))
		for k, t := range originalAttrTypes {
			attrTypes[k] = t.WithoutOptionalAttributesDeep()
		}

		// This is the subtle line which does all the work of this function: by
		// constructing a new Object type with these attribute types, we drop
		// the list of optional attributes (if present). This results in a
		// concrete Object type which requires all of the original attributes.
		return Object(attrTypes)
	default:
		// Should never happen, since above should be exhaustive
		panic("WithoutOptionalAttributesDeep does not support the given type")
	}
}

type friendlyTypeNameMode rune

const (
	friendlyTypeName           friendlyTypeNameMode = 'N'
	friendlyTypeConstraintName friendlyTypeNameMode = 'C'
)
