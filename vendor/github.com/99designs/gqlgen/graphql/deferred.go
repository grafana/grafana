package graphql

import (
	"context"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

type Deferrable struct {
	Label string
}

type DeferredGroup struct {
	Path     ast.Path
	Label    string
	FieldSet *FieldSet
	Context  context.Context
}

type DeferredResult struct {
	Path   ast.Path
	Label  string
	Result Marshaler
	Errors gqlerror.List
}
