package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*RetypeObject)(nil)

type RetypeObject struct {
	Object   ObjectReference
	As       ast.Type
	Comments []string
}

func (pass *RetypeObject) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *RetypeObject) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	if !pass.Object.Matches(object) {
		return object, nil
	}

	trailMessage := fmt.Sprintf("RetypeObject[%s → %s]", ast.TypeName(object.Type), ast.TypeName(pass.As))

	object.Type = pass.As
	object.AddToPassesTrail(trailMessage)

	if pass.Comments != nil {
		object.Comments = pass.Comments
	}

	return object, nil
}
