package compiler

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
)

type ObjectReferences []ObjectReference

func (refs ObjectReferences) Matches(object ast.Object) bool {
	for _, ref := range refs {
		if ref.Matches(object) {
			return true
		}
	}

	return false
}

type ObjectReference struct {
	Package string
	Object  string
}

func (ref ObjectReference) Matches(object ast.Object) bool {
	return ref.MatchesRef(object.SelfRef)
}

func (ref ObjectReference) MatchesRef(refType ast.RefType) bool {
	return refType.ReferredPkg == ref.Package && strings.EqualFold(refType.ReferredType, ref.Object)
}

func (ref ObjectReference) AsRef() ast.RefType {
	return ast.RefType{
		ReferredPkg:  ref.Package,
		ReferredType: ref.Object,
	}
}

func (ref ObjectReference) String() string {
	return fmt.Sprintf("%s.%s", ref.Package, ref.Object)
}

func ObjectReferenceFromString(ref string) (ObjectReference, error) {
	parts := strings.Split(ref, ".")
	if len(parts) != 2 {
		return ObjectReference{}, fmt.Errorf("invalid object reference '%s'", ref)
	}

	return ObjectReference{
		Package: parts[0],
		Object:  parts[1],
	}, nil
}

type FieldReference struct {
	Package string
	Object  string
	Field   string
}

func (ref FieldReference) Matches(object ast.Object, field ast.StructField) bool {
	return object.SelfRef.ReferredPkg == ref.Package &&
		strings.EqualFold(object.Name, ref.Object) &&
		strings.EqualFold(field.Name, ref.Field)
}

func FieldReferenceFromString(ref string) (FieldReference, error) {
	parts := strings.Split(ref, ".")
	if len(parts) != 3 {
		return FieldReference{}, fmt.Errorf("invalid field reference '%s'", ref)
	}

	return FieldReference{
		Package: parts[0],
		Object:  parts[1],
		Field:   parts[2],
	}, nil
}
