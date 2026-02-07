package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*NameAnonymousStruct)(nil)

// NameAnonymousStruct rewrites the definition of a struct field typed as an
// anonymous struct to instead refer to a named type.
type NameAnonymousStruct struct {
	Field FieldReference
	As    string
}

func (pass *NameAnonymousStruct) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	for i, schema := range schemas {
		schemas[i] = pass.processSchema(schema)
	}

	return schemas, nil
}

func (pass *NameAnonymousStruct) processSchema(schema *ast.Schema) *ast.Schema {
	var newObject ast.Object

	schema.Objects = schema.Objects.Map(func(_ string, object ast.Object) ast.Object {
		currentObject, newObjectCandidate := pass.processObject(object)
		if newObjectCandidate.Name != "" {
			newObject = newObjectCandidate
		}

		return currentObject
	})

	// did we actually define a new object?
	if newObject.Name != "" {
		schema.AddObject(newObject)
	}

	return schema
}

func (pass *NameAnonymousStruct) processObject(object ast.Object) (ast.Object, ast.Object) {
	var newObject ast.Object

	if !object.Type.IsStruct() {
		return object, newObject
	}

	pkg := object.SelfRef.ReferredPkg

	for i, field := range object.Type.AsStruct().Fields {
		if !pass.Field.Matches(object, field) {
			continue
		}

		// we expect the target field to be defined an inline struct
		if !field.Type.IsStruct() {
			continue
		}

		newObject = ast.NewObject(pkg, pass.As, field.Type)
		newObject.AddToPassesTrail("NameAnonymousStruct")

		object.Type.AsStruct().Fields[i].Type = ast.NewRef(pkg, pass.As)
	}

	return object, newObject
}
