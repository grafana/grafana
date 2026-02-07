package cty

import (
	"fmt"
	"sort"
)

type typeObject struct {
	typeImplSigil
	AttrTypes    map[string]Type
	AttrOptional map[string]struct{}
}

// Object creates an object type with the given attribute types.
//
// After a map is passed to this function the caller must no longer access it,
// since ownership is transferred to this library.
func Object(attrTypes map[string]Type) Type {
	return ObjectWithOptionalAttrs(attrTypes, nil)
}

// ObjectWithOptionalAttrs creates an object type where some of its attributes
// are optional.
//
// This function is EXPERIMENTAL. The behavior of the function or of any other
// functions working either directly or indirectly with a type created by
// this function is not currently considered as a compatibility constraint, and
// is subject to change even in minor-version releases of this module. Other
// modules that work with cty types and values may or may not support object
// types with optional attributes; if they do not, their behavior when
// receiving one may be non-ideal.
//
// Optional attributes are significant only when an object type is being used
// as a target type for conversion in the "convert" package. A value of an
// object type always has a value for each of the attributes in the attribute
// types table, with optional values replaced with null during conversion.
//
// All keys in the optional slice must also exist in the attrTypes map. If not,
// this function will panic.
//
// After a map or array is passed to this function the caller must no longer
// access it, since ownership is transferred to this library.
func ObjectWithOptionalAttrs(attrTypes map[string]Type, optional []string) Type {
	attrTypesNorm := make(map[string]Type, len(attrTypes))
	for k, v := range attrTypes {
		attrTypesNorm[NormalizeString(k)] = v
	}

	var optionalSet map[string]struct{}
	if len(optional) > 0 {
		optionalSet = make(map[string]struct{}, len(optional))
		for _, k := range optional {
			k = NormalizeString(k)
			if _, exists := attrTypesNorm[k]; !exists {
				panic(fmt.Sprintf("optional contains undeclared attribute %q", k))
			}
			optionalSet[k] = struct{}{}
		}
	}

	return Type{
		typeObject{
			AttrTypes:    attrTypesNorm,
			AttrOptional: optionalSet,
		},
	}
}

func (t typeObject) Equals(other Type) bool {
	if ot, ok := other.typeImpl.(typeObject); ok {
		if len(t.AttrTypes) != len(ot.AttrTypes) {
			// Fast path: if we don't have the same number of attributes
			// then we can't possibly be equal. This also avoids the need
			// to test attributes in both directions below, since we know
			// there can't be extras in "other".
			return false
		}

		for attr, ty := range t.AttrTypes {
			oty, ok := ot.AttrTypes[attr]
			if !ok {
				return false
			}
			if !oty.Equals(ty) {
				return false
			}
			_, opt := t.AttrOptional[attr]
			_, oopt := ot.AttrOptional[attr]
			if opt != oopt {
				return false
			}
		}

		return true
	}
	return false
}

func (t typeObject) FriendlyName(mode friendlyTypeNameMode) string {
	// There isn't really a friendly way to write an object type due to its
	// complexity, so we'll just do something English-ish. Callers will
	// probably want to make some extra effort to avoid ever printing out
	// an object type FriendlyName in its entirety. For example, could
	// produce an error message by diffing two object types and saying
	// something like "Expected attribute foo to be string, but got number".
	// TODO: Finish this
	return "object"
}

func (t typeObject) GoString() string {
	if len(t.AttrTypes) == 0 {
		return "cty.EmptyObject"
	}
	if len(t.AttrOptional) > 0 {
		var opt []string
		for k := range t.AttrOptional {
			opt = append(opt, k)
		}
		sort.Strings(opt)
		return fmt.Sprintf("cty.ObjectWithOptionalAttrs(%#v, %#v)", t.AttrTypes, opt)
	}
	return fmt.Sprintf("cty.Object(%#v)", t.AttrTypes)
}

// EmptyObject is a shorthand for Object(map[string]Type{}), to more
// easily talk about the empty object type.
var EmptyObject Type

// EmptyObjectVal is the only possible non-null, non-unknown value of type
// EmptyObject.
var EmptyObjectVal Value

func init() {
	EmptyObject = Object(map[string]Type{})
	EmptyObjectVal = Value{
		ty: EmptyObject,
		v:  map[string]interface{}{},
	}
}

// IsObjectType returns true if the given type is an object type, regardless
// of its element type.
func (t Type) IsObjectType() bool {
	_, ok := t.typeImpl.(typeObject)
	return ok
}

// HasAttribute returns true if the receiver has an attribute with the given
// name, regardless of its type. Will panic if the reciever isn't an object
// type; use IsObjectType to determine whether this operation will succeed.
func (t Type) HasAttribute(name string) bool {
	name = NormalizeString(name)
	if ot, ok := t.typeImpl.(typeObject); ok {
		_, hasAttr := ot.AttrTypes[name]
		return hasAttr
	}
	panic("HasAttribute on non-object Type")
}

// AttributeType returns the type of the attribute with the given name. Will
// panic if the receiver is not an object type (use IsObjectType to confirm)
// or if the object type has no such attribute (use HasAttribute to confirm).
func (t Type) AttributeType(name string) Type {
	name = NormalizeString(name)
	if ot, ok := t.typeImpl.(typeObject); ok {
		aty, hasAttr := ot.AttrTypes[name]
		if !hasAttr {
			panic("no such attribute")
		}
		return aty
	}
	panic("AttributeType on non-object Type")
}

// AttributeTypes returns a map from attribute names to their associated
// types. Will panic if the receiver is not an object type (use IsObjectType
// to confirm).
//
// The returned map is part of the internal state of the type, and is provided
// for read access only. It is forbidden for any caller to modify the returned
// map. For many purposes the attribute-related methods of Value are more
// appropriate and more convenient to use.
func (t Type) AttributeTypes() map[string]Type {
	if ot, ok := t.typeImpl.(typeObject); ok {
		return ot.AttrTypes
	}
	panic("AttributeTypes on non-object Type")
}

// OptionalAttributes returns a map representing the set of attributes
// that are optional. Will panic if the receiver is not an object type
// (use IsObjectType to confirm).
//
// The returned map is part of the internal state of the type, and is provided
// for read access only. It is forbidden for any caller to modify the returned
// map.
func (t Type) OptionalAttributes() map[string]struct{} {
	if ot, ok := t.typeImpl.(typeObject); ok {
		return ot.AttrOptional
	}
	panic("OptionalAttributes on non-object Type")
}

// AttributeOptional returns true if the attribute of the given name is
// optional.
//
// Will panic if the receiver is not an object type (use IsObjectType to
// confirm) or if the object type has no such attribute (use HasAttribute to
// confirm).
func (t Type) AttributeOptional(name string) bool {
	name = NormalizeString(name)
	if ot, ok := t.typeImpl.(typeObject); ok {
		if _, hasAttr := ot.AttrTypes[name]; !hasAttr {
			panic("no such attribute")
		}
		_, exists := ot.AttrOptional[name]
		return exists
	}
	panic("AttributeDefaultValue on non-object Type")
}
