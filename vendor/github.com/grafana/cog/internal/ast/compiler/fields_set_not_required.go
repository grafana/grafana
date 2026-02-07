package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*FieldsSetNotRequired)(nil)

// FieldsSetNotRequired rewrites the definition of given fields to mark them as nullable and not required.
type FieldsSetNotRequired struct {
	Fields []FieldReference
}

func (pass *FieldsSetNotRequired) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *FieldsSetNotRequired) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	if !object.Type.IsStruct() {
		return object, nil
	}

	for i, field := range object.Type.AsStruct().Fields {
		for _, fieldRef := range pass.Fields {
			if !fieldRef.Matches(object, field) {
				continue
			}

			field.Type.Nullable = true
			field.Required = false
			field.AddToPassesTrail("FieldsSetNotRequired[nullable=true, required=false]")

			object.Type.Struct.Fields[i] = field
		}
	}

	return object, nil
}
