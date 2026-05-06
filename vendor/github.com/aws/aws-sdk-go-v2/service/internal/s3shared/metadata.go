package s3shared

import (
	"context"

	"github.com/aws/smithy-go/middleware"
)

// clonedInputKey used to denote if request input was cloned.
type clonedInputKey struct{}

// SetClonedInputKey sets a key on context to denote input was cloned previously.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func SetClonedInputKey(ctx context.Context, value bool) context.Context {
	return middleware.WithStackValue(ctx, clonedInputKey{}, value)
}

// IsClonedInput retrieves if context key for cloned input was set.
// If set, we can infer that the reuqest input was cloned previously.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func IsClonedInput(ctx context.Context) bool {
	v, _ := middleware.GetStackValue(ctx, clonedInputKey{}).(bool)
	return v
}
