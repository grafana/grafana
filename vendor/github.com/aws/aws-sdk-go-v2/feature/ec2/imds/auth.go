package imds

import (
	"context"
	"github.com/aws/smithy-go/middleware"
)

type getIdentityMiddleware struct {
	options Options
}

func (*getIdentityMiddleware) ID() string {
	return "GetIdentity"
}

func (m *getIdentityMiddleware) HandleFinalize(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	return next.HandleFinalize(ctx, in)
}

type signRequestMiddleware struct {
}

func (*signRequestMiddleware) ID() string {
	return "Signing"
}

func (m *signRequestMiddleware) HandleFinalize(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	return next.HandleFinalize(ctx, in)
}

type resolveAuthSchemeMiddleware struct {
	operation string
	options   Options
}

func (*resolveAuthSchemeMiddleware) ID() string {
	return "ResolveAuthScheme"
}

func (m *resolveAuthSchemeMiddleware) HandleFinalize(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	return next.HandleFinalize(ctx, in)
}
