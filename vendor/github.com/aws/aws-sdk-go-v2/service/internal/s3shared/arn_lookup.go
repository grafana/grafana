package s3shared

import (
	"context"
	"fmt"

	"github.com/aws/smithy-go/middleware"

	"github.com/aws/aws-sdk-go-v2/aws/arn"
)

// ARNLookup is the initial middleware that looks up if an arn is provided.
// This middleware is responsible for fetching ARN from a arnable field, and registering the ARN on
// middleware context. This middleware must be executed before input validation step or any other
// arn processing middleware.
type ARNLookup struct {

	// GetARNValue takes in a input interface and returns a ptr to string and a bool
	GetARNValue func(interface{}) (*string, bool)
}

// ID for the middleware
func (m *ARNLookup) ID() string {
	return "S3Shared:ARNLookup"
}

// HandleInitialize handles the behavior of this initialize step
func (m *ARNLookup) HandleInitialize(ctx context.Context, in middleware.InitializeInput, next middleware.InitializeHandler) (
	out middleware.InitializeOutput, metadata middleware.Metadata, err error,
) {
	// check if GetARNValue is supported
	if m.GetARNValue == nil {
		return next.HandleInitialize(ctx, in)
	}

	// check is input resource is an ARN; if not go to next
	v, ok := m.GetARNValue(in.Parameters)
	if !ok || v == nil || !arn.IsARN(*v) {
		return next.HandleInitialize(ctx, in)
	}

	// if ARN process ResourceRequest and put it on ctx
	av, err := arn.Parse(*v)
	if err != nil {
		return out, metadata, fmt.Errorf("error parsing arn: %w", err)
	}
	// set parsed arn on context
	ctx = setARNResourceOnContext(ctx, av)

	return next.HandleInitialize(ctx, in)
}

// arnResourceKey is the key set on context used to identify, retrive an ARN resource
// if present on the context.
type arnResourceKey struct{}

// SetARNResourceOnContext sets the S3 ARN on the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func setARNResourceOnContext(ctx context.Context, value arn.ARN) context.Context {
	return middleware.WithStackValue(ctx, arnResourceKey{}, value)
}

// GetARNResourceFromContext returns an ARN from context and a bool indicating
// presence of ARN on ctx.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func GetARNResourceFromContext(ctx context.Context) (arn.ARN, bool) {
	v, ok := middleware.GetStackValue(ctx, arnResourceKey{}).(arn.ARN)
	return v, ok
}
