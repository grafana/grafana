package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*FieldsSetDefault)(nil)

// FieldsSetDefault sets the default value for the given fields.
type FieldsSetDefault struct {
	DefaultValues map[FieldReference]any
}

func (pass *FieldsSetDefault) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *FieldsSetDefault) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	if !object.Type.IsStruct() {
		return object, nil
	}

	for i, field := range object.Type.AsStruct().Fields {
		for fieldRef, value := range pass.DefaultValues {
			if !fieldRef.Matches(object, field) {
				continue
			}

			field.Type.Default = value
			field.AddToPassesTrail(fmt.Sprintf("FieldsSetDefault[default=%v]", value))

			object.Type.Struct.Fields[i] = field
		}
	}

	return object, nil
}
