package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*NotRequiredFieldAsNullableType)(nil)

// NotRequiredFieldAsNullableType identifies all the struct fields marked as not `Required`
// and rewrites their `Type` to be `Nullable`.
type NotRequiredFieldAsNullableType struct {
}

func (pass *NotRequiredFieldAsNullableType) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnStructField: pass.processStructField,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *NotRequiredFieldAsNullableType) processStructField(visitor *Visitor, schema *ast.Schema, field ast.StructField) (ast.StructField, error) {
	var err error
	field.Type, err = visitor.VisitType(schema, field.Type)
	if err != nil {
		return field, err
	}

	if !field.Required && !field.Type.Nullable {
		field.Type.Nullable = true
		field.AddToPassesTrail("NotRequiredFieldAsNullableType[nullable=true]")
	}

	return field, nil
}
