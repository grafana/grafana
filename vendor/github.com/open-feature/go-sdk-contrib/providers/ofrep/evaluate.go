package ofrep

import (
	"context"

	of "github.com/open-feature/go-sdk/openfeature"
)

// Evaluator contract for flag evaluation
type Evaluator interface {
	ResolveBoolean(ctx context.Context, key string, defaultValue bool,
		evalCtx map[string]interface{}) of.BoolResolutionDetail
	ResolveString(ctx context.Context, key string, defaultValue string,
		evalCtx map[string]interface{}) of.StringResolutionDetail
	ResolveFloat(ctx context.Context, key string, defaultValue float64,
		evalCtx map[string]interface{}) of.FloatResolutionDetail
	ResolveInt(ctx context.Context, key string, defaultValue int64,
		evalCtx map[string]interface{}) of.IntResolutionDetail
	ResolveObject(ctx context.Context, key string, defaultValue interface{},
		evalCtx map[string]interface{}) of.InterfaceResolutionDetail
}
