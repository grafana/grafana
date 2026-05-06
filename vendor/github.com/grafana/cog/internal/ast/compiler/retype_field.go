package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*RetypeField)(nil)

type RetypeField struct {
	Field    FieldReference
	As       ast.Type
	Comments []string
}

func (pass *RetypeField) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *RetypeField) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	if !object.Type.IsStruct() {
		return object, nil
	}

	for i, field := range object.Type.Struct.Fields {
		if !pass.Field.Matches(object, field) {
			continue
		}

		object.Type.Struct.Fields[i].AddToPassesTrail(fmt.Sprintf("RetypeField[%s → %s]", ast.TypeName(field.Type), ast.TypeName(pass.As)))
		object.Type.Struct.Fields[i].Type = pass.As

		if pass.Comments != nil {
			object.Type.Struct.Fields[i].Comments = pass.Comments
		}

		break
	}

	return object, nil
}
