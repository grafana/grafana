package compiler

import (
	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*AddObject)(nil)

// AddObject adds a new object to a schema.
type AddObject struct {
	Object   ObjectReference
	As       ast.Type
	Comments []string
}

func (pass *AddObject) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnSchema: pass.processSchema,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *AddObject) processSchema(visitor *Visitor, schema *ast.Schema) (*ast.Schema, error) {
	if schema.Package != pass.Object.Package {
		return schema, nil
	}

	newObject := ast.NewObject(pass.Object.Package, pass.Object.Object, pass.As)
	newObject.Comments = pass.Comments
	newObject.AddToPassesTrail("AddObject[created]")

	visitor.RegisterNewObject(newObject)

	return schema, nil
}
