package openfeature

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature/internal"
)

// EvaluationContext provides ambient information for the purposes of flag evaluation
// The use of the constructor, NewEvaluationContext, is enforced to set EvaluationContext's fields in order
// to enforce immutability.
// https://openfeature.dev/specification/sections/evaluation-context
type EvaluationContext struct {
	targetingKey string // uniquely identifying the subject (end-user, or client service) of a flag evaluation
	attributes   map[string]interface{}
}

// Attribute retrieves the attribute with the given key
func (e EvaluationContext) Attribute(key string) interface{} {
	return e.attributes[key]
}

// TargetingKey returns the key uniquely identifying the subject (end-user, or client service) of a flag evaluation
func (e EvaluationContext) TargetingKey() string {
	return e.targetingKey
}

// Attributes returns a copy of the EvaluationContext's attributes
func (e EvaluationContext) Attributes() map[string]interface{} {
	// copy attributes to new map to prevent mutation (maps are passed by reference)
	attrs := make(map[string]interface{}, len(e.attributes))
	for key, value := range e.attributes {
		attrs[key] = value
	}

	return attrs
}

// NewEvaluationContext constructs an EvaluationContext
//
// targetingKey - uniquely identifying the subject (end-user, or client service) of a flag evaluation
// attributes - contextual data used in flag evaluation
func NewEvaluationContext(targetingKey string, attributes map[string]interface{}) EvaluationContext {
	// copy attributes to new map to avoid reference being externally available, thereby enforcing immutability
	attrs := make(map[string]interface{}, len(attributes))
	for key, value := range attributes {
		attrs[key] = value
	}

	return EvaluationContext{
		targetingKey: targetingKey,
		attributes:   attrs,
	}
}

// NewTargetlessEvaluationContext constructs an EvaluationContext with an empty targeting key
//
// attributes - contextual data used in flag evaluation
func NewTargetlessEvaluationContext(attributes map[string]interface{}) EvaluationContext {
	return NewEvaluationContext("", attributes)
}

// NewTransactionContext constructs a TransactionContext
//
// ctx - the context to embed the EvaluationContext in
// ec - the EvaluationContext to embed into the context
func WithTransactionContext(ctx context.Context, ec EvaluationContext) context.Context {
	return context.WithValue(ctx, internal.TransactionContext, ec)
}

// MergeTransactionContext merges the provided EvaluationContext with the current TransactionContext (if it exists)
//
// ctx - the context to pull existing TransactionContext from
// ec - the EvaluationContext to merge with the existing TransactionContext
func MergeTransactionContext(ctx context.Context, ec EvaluationContext) context.Context {
	oldTc := TransactionContext(ctx)
	mergedTc := mergeContexts(ec, oldTc)
	return WithTransactionContext(ctx, mergedTc)
}

// TransactionContext extracts a EvaluationContext from the current
// golang.org/x/net/context. if no EvaluationContext exist, it will construct
// an empty EvaluationContext
//
// ctx - the context to pull EvaluationContext from
func TransactionContext(ctx context.Context) EvaluationContext {
	ec, ok := ctx.Value(internal.TransactionContext).(EvaluationContext)

	if !ok {
		return EvaluationContext{}
	}

	return ec
}
