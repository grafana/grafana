package validate

import (
	"context"
)

// validateCtxKey is the key type of context key in this pkg
type validateCtxKey string

const (
	operationTypeKey validateCtxKey = "operationTypeKey"
)

type operationType string

const (
	request  operationType = "request"
	response operationType = "response"
	none     operationType = "none" // not specified in ctx
)

var operationTypeEnum = []operationType{request, response, none}

// WithOperationRequest returns a new context with operationType request
// in context value
func WithOperationRequest(ctx context.Context) context.Context {
	return withOperation(ctx, request)
}

// WithOperationRequest returns a new context with operationType response
// in context value
func WithOperationResponse(ctx context.Context) context.Context {
	return withOperation(ctx, response)
}

func withOperation(ctx context.Context, operation operationType) context.Context {
	return context.WithValue(ctx, operationTypeKey, operation)
}

// extractOperationType extracts the operation type from ctx
// if not specified or of unknown value, return none operation type
func extractOperationType(ctx context.Context) operationType {
	v := ctx.Value(operationTypeKey)
	if v == nil {
		return none
	}
	res, ok := v.(operationType)
	if !ok {
		return none
	}
	// validate the value is in operation enum
	if err := Enum("", "", res, operationTypeEnum); err != nil {
		return none
	}
	return res
}
