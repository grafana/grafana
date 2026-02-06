package graphql

import (
	"context"
	"errors"
	"net/http"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// Deprecated: Please update all references to OperationContext instead
type RequestContext = OperationContext

type OperationContext struct {
	RawQuery      string
	Variables     map[string]any
	OperationName string
	Doc           *ast.QueryDocument
	Extensions    map[string]any
	Headers       http.Header

	Operation              *ast.OperationDefinition
	DisableIntrospection   bool
	RecoverFunc            RecoverFunc
	ResolverMiddleware     FieldMiddleware
	RootResolverMiddleware RootFieldMiddleware

	Stats Stats
}

func (c *OperationContext) Validate(ctx context.Context) error {
	if c.Doc == nil {
		return errors.New("field 'Doc'is required")
	}
	if c.RawQuery == "" {
		return errors.New("field 'RawQuery' is required")
	}
	if c.Variables == nil {
		c.Variables = make(map[string]any)
	}
	if c.ResolverMiddleware == nil {
		return errors.New("field 'ResolverMiddleware' is required")
	}
	if c.RootResolverMiddleware == nil {
		return errors.New("field 'RootResolverMiddleware' is required")
	}
	if c.RecoverFunc == nil {
		c.RecoverFunc = DefaultRecover
	}

	return nil
}

const operationCtx key = "operation_context"

// Deprecated: Please update all references to GetOperationContext instead
func GetRequestContext(ctx context.Context) *RequestContext {
	return GetOperationContext(ctx)
}

func GetOperationContext(ctx context.Context) *OperationContext {
	if val, ok := ctx.Value(operationCtx).(*OperationContext); ok && val != nil {
		return val
	}
	panic("missing operation context")
}

func WithOperationContext(ctx context.Context, opCtx *OperationContext) context.Context {
	return context.WithValue(ctx, operationCtx, opCtx)
}

// HasOperationContext checks if the given context is part of an ongoing operation
//
// Some errors can happen outside of an operation, eg json unmarshal errors.
func HasOperationContext(ctx context.Context) bool {
	val, ok := ctx.Value(operationCtx).(*OperationContext)
	return ok && val != nil
}

// CollectFieldsCtx is just a convenient wrapper method for CollectFields.
func CollectFieldsCtx(ctx context.Context, satisfies []string) []CollectedField {
	resctx := GetFieldContext(ctx)
	return CollectFields(GetOperationContext(ctx), resctx.Field.Selections, satisfies)
}

// CollectAllFields returns a slice of all GraphQL field names that were selected for the current resolver context.
// The slice will contain the unique set of all field names requested regardless of fragment type conditions.
func CollectAllFields(ctx context.Context) []string {
	resctx := GetFieldContext(ctx)
	collected := CollectFields(GetOperationContext(ctx), resctx.Field.Selections, nil)
	uniq := make([]string, 0, len(collected))
Next:
	for _, f := range collected {
		for _, name := range uniq {
			if name == f.Name {
				continue Next
			}
		}
		uniq = append(uniq, f.Name)
	}
	return uniq
}

// Errorf sends an error string to the client, passing it through the formatter.
// Deprecated: use graphql.AddErrorf(ctx, err) instead
func (c *OperationContext) Errorf(ctx context.Context, format string, args ...any) {
	AddErrorf(ctx, format, args...)
}

// Error add error or multiple errors (if underlaying type is gqlerror.List) into the stack.
// Then it will be sends to the client, passing it through the formatter.
func (c *OperationContext) Error(ctx context.Context, err error) {
	if errList, ok := err.(gqlerror.List); ok {
		for _, e := range errList {
			AddError(ctx, e)
		}
		return
	}

	AddError(ctx, err)
}

func (c *OperationContext) Recover(ctx context.Context, err any) error {
	return ErrorOnPath(ctx, c.RecoverFunc(ctx, err))
}
