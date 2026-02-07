package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*AddFields)(nil)

// AddFields rewrites the definition of an object to add new fields.
// Note: existing fields will not be overwritten.
type AddFields struct {
	Object ObjectReference
	Fields []ast.StructField
}

func (pass *AddFields) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *AddFields) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	if !pass.Object.Matches(object) {
		return object, nil
	}

	if !object.Type.IsStruct() {
		return object, fmt.Errorf("cannot add fields to a non-struct object: %s", pass.Object.String())
	}

	for _, field := range pass.Fields {
		// let's be safe: if a field with the same name already exists, we do not overwrite it.
		if _, exists := object.Type.AsStruct().FieldByName(field.Name); exists {
			continue
		}

		field.AddToPassesTrail("AddFields[created]")

		object.Type.Struct.Fields = append(object.Type.Struct.Fields, field)
	}

	return object, nil
}
