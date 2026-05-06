package compiler

import (
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/tools"
)

var _ Pass = (*OmitFields)(nil)

// OmitFields removes the selected fields from their object definition.
type OmitFields struct {
	Fields []FieldReference
}

func (pass *OmitFields) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *OmitFields) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	if !object.Type.IsStruct() {
		return object, nil
	}

	object.Type.Struct.Fields = tools.Filter(object.Type.Struct.Fields, func(field ast.StructField) bool {
		for _, fieldRef := range pass.Fields {
			if fieldRef.Matches(object, field) {
				return false
			}
		}

		return true
	})

	return object, nil
}
