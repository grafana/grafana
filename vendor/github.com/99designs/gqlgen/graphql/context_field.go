package graphql

import (
	"context"
	"time"

	"github.com/vektah/gqlparser/v2/ast"
)

type key string

const resolverCtx key = "resolver_context"

// Deprecated: Use FieldContext instead
type ResolverContext = FieldContext

type FieldContext struct {
	Parent *FieldContext
	// The name of the type this field belongs to
	Object string
	// These are the args after processing, they can be mutated in middleware to change what the resolver will get.
	Args map[string]any
	// The raw field
	Field CollectedField
	// The index of array in path.
	Index *int
	// The result object of resolver
	Result any
	// IsMethod indicates if the resolver is a method
	IsMethod bool
	// IsResolver indicates if the field has a user-specified resolver
	IsResolver bool
	// Child allows getting a child FieldContext by its field collection description.
	// Note that, the returned child FieldContext represents the context as it was
	// before the execution of the field resolver. For example:
	//
	//	srv.AroundFields(func(ctx context.Context, next graphql.Resolver) (any, error) {
	//		fc := graphql.GetFieldContext(ctx)
	//		opCtx := graphql.GetOperationContext(ctx)
	//		collected := graphql.CollectFields(opCtx, fc.Field.Selections, []string{"User"})
	//
	//		child, err := fc.Child(ctx, collected[0])
	//		if err != nil {
	//			return nil, err
	//		}
	//		fmt.Printf("child context %q with args: %v\n", child.Field.Name, child.Args)
	//
	//		return next(ctx)
	//	})
	//
	Child func(context.Context, CollectedField) (*FieldContext, error)
}

type FieldStats struct {
	// When field execution started
	Started time.Time

	// When argument marshaling finished
	ArgumentsCompleted time.Time

	// When the field completed running all middleware. Not available inside field middleware!
	Completed time.Time
}

func (r *FieldContext) Path() ast.Path {
	var path ast.Path
	for it := r; it != nil; it = it.Parent {
		if it.Index != nil {
			path = append(path, ast.PathIndex(*it.Index))
		} else if it.Field.Field != nil {
			path = append(path, ast.PathName(it.Field.Alias))
		}
	}

	// because we are walking up the chain, all the elements are backwards, do an inplace flip.
	for i := len(path)/2 - 1; i >= 0; i-- {
		opp := len(path) - 1 - i
		path[i], path[opp] = path[opp], path[i]
	}

	return path
}

// Deprecated: Use GetFieldContext instead
func GetResolverContext(ctx context.Context) *ResolverContext {
	return GetFieldContext(ctx)
}

func GetFieldContext(ctx context.Context) *FieldContext {
	if val, ok := ctx.Value(resolverCtx).(*FieldContext); ok {
		return val
	}
	return nil
}

func WithFieldContext(ctx context.Context, rc *FieldContext) context.Context {
	rc.Parent = GetFieldContext(ctx)
	return context.WithValue(ctx, resolverCtx, rc)
}

func equalPath(a, b ast.Path) bool {
	if len(a) != len(b) {
		return false
	}

	for i := 0; i < len(a); i++ {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}
