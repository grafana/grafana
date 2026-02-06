package graphql

import (
	"context"
)

const rootResolverCtx key = "root_resolver_context"

type RootFieldContext struct {
	// The name of the type this field belongs to
	Object string
	// The raw field
	Field CollectedField
}

func GetRootFieldContext(ctx context.Context) *RootFieldContext {
	if val, ok := ctx.Value(rootResolverCtx).(*RootFieldContext); ok {
		return val
	}
	return nil
}

func WithRootFieldContext(ctx context.Context, rc *RootFieldContext) context.Context {
	return context.WithValue(ctx, rootResolverCtx, rc)
}
