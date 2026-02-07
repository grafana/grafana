package tenant

import (
	"context"

	"google.golang.org/grpc/metadata"
)

const CtxKey = "tenantID"

type tenantKey struct{}

// IDFromContext returns tenant ID from context.
func IDFromContext(ctx context.Context) string {
	v := ctx.Value(tenantKey{})
	if v == nil {
		return ""
	}

	return v.(string)
}

// WithTenant injects supplied tenant ID into context.
func WithTenant(ctx context.Context, tenantID string) context.Context {
	ctx = context.WithValue(ctx, tenantKey{}, tenantID)
	return ctx
}

// IDFromIncomingGRPCContext returns tenant ID from incoming gRPC metadata.
func IDFromIncomingGRPCContext(ctx context.Context) (string, bool) {
	md, exists := metadata.FromIncomingContext(ctx)
	if !exists {
		return "", false
	}
	return idFromRequestMeta(md)
}

// idFromRequestMeta returns tenant ID from gRPC metadata.
func idFromRequestMeta(md metadata.MD) (string, bool) {
	if md == nil {
		return "", false
	}

	tid := md.Get(CtxKey)
	if len(tid) > 0 && tid[0] != "" {
		return tid[0], true
	}

	return "", false
}
