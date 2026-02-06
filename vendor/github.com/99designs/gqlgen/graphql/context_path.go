package graphql

import (
	"context"

	"github.com/vektah/gqlparser/v2/ast"
)

const fieldInputCtx key = "path_context"

type PathContext struct {
	ParentField *FieldContext
	Parent      *PathContext
	Field       *string
	Index       *int
}

func (fic *PathContext) Path() ast.Path {
	var path ast.Path
	for it := fic; it != nil; it = it.Parent {
		if it.Index != nil {
			path = append(path, ast.PathIndex(*it.Index))
		} else if it.Field != nil {
			path = append(path, ast.PathName(*it.Field))
		}
	}

	// because we are walking up the chain, all the elements are backwards, do an inplace flip.
	for i := len(path)/2 - 1; i >= 0; i-- {
		opp := len(path) - 1 - i
		path[i], path[opp] = path[opp], path[i]
	}

	if fic.ParentField != nil {
		fieldPath := fic.ParentField.Path()
		return append(fieldPath, path...)
	}

	return path
}

func NewPathWithField(field string) *PathContext {
	return &PathContext{Field: &field}
}

func NewPathWithIndex(index int) *PathContext {
	return &PathContext{Index: &index}
}

func WithPathContext(ctx context.Context, fic *PathContext) context.Context {
	if fieldContext := GetFieldContext(ctx); fieldContext != nil {
		fic.ParentField = fieldContext
	}
	if fieldInputContext := GetPathContext(ctx); fieldInputContext != nil {
		fic.Parent = fieldInputContext
	}

	return context.WithValue(ctx, fieldInputCtx, fic)
}

func GetPathContext(ctx context.Context) *PathContext {
	if val, ok := ctx.Value(fieldInputCtx).(*PathContext); ok {
		return val
	}
	return nil
}

func GetPath(ctx context.Context) ast.Path {
	if pc := GetPathContext(ctx); pc != nil {
		return pc.Path()
	}
	if fc := GetFieldContext(ctx); fc != nil {
		return fc.Path()
	}
	return nil
}
