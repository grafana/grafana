package compiler

import (
	"fmt"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*AppendCommentObjects)(nil)

// AppendCommentObjects appends the given comment to every object definition.
type AppendCommentObjects struct {
	Comment string
}

func (pass *AppendCommentObjects) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *AppendCommentObjects) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	object.Comments = append(object.Comments, pass.Comment)
	object.AddToPassesTrail(fmt.Sprintf("AppendCommentObjects[%s]", pass.Comment))

	return object, nil
}
