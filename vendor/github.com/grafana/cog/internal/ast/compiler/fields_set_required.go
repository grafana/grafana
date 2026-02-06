package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*FieldsSetRequired)(nil)

// FieldsSetRequired rewrites the definition of given fields to mark them as not nullable and required.
type FieldsSetRequired struct {
	Fields []FieldReference
}

func (pass *FieldsSetRequired) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *FieldsSetRequired) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	if !object.Type.IsStruct() {
		return object, nil
	}

	for i, field := range object.Type.AsStruct().Fields {
		for _, fieldRef := range pass.Fields {
			if !fieldRef.Matches(object, field) {
				continue
			}

			field.Type.Nullable = false
			field.Required = true
			field.AddToPassesTrail("FieldsSetRequired[nullable=false, required=true]")

			object.Type.Struct.Fields[i] = field
		}
	}

	return object, nil
}
