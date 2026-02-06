package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/internal/tenant"
)

// newTenantIDMiddleware creates a new handler middleware that extract tenant ID from the incoming gRPC context, if available.
func newTenantIDMiddleware() HandlerMiddleware {
	return HandlerMiddlewareFunc(func(next Handler) Handler {
		return &tenantIDMiddleware{
			BaseHandler: NewBaseHandler(next),
		}
	})
}

// tenantIDMiddleware a handler middleware that extract tenant ID from the incoming gRPC context, if available.
type tenantIDMiddleware struct {
	BaseHandler
}

func (m *tenantIDMiddleware) setup(ctx context.Context) context.Context {
	if tid, exists := tenant.IDFromIncomingGRPCContext(ctx); exists {
		ctx = tenant.WithTenant(ctx, tid)
	}
	return ctx
}

func (m *tenantIDMiddleware) QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error) {
	ctx = m.setup(ctx)
	return m.BaseHandler.QueryData(ctx, req)
}

func (m *tenantIDMiddleware) CallResource(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error {
	ctx = m.setup(ctx)
	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *tenantIDMiddleware) CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error) {
	ctx = m.setup(ctx)
	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *tenantIDMiddleware) CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error) {
	ctx = m.setup(ctx)
	return m.BaseHandler.CollectMetrics(ctx, req)
}

func (m *tenantIDMiddleware) SubscribeStream(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error) {
	ctx = m.setup(ctx)
	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *tenantIDMiddleware) PublishStream(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error) {
	ctx = m.setup(ctx)
	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *tenantIDMiddleware) RunStream(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error {
	ctx = m.setup(ctx)
	return m.BaseHandler.RunStream(ctx, req, sender)
}

func (m *tenantIDMiddleware) ValidateAdmission(ctx context.Context, req *AdmissionRequest) (*ValidationResponse, error) {
	ctx = m.setup(ctx)
	return m.BaseHandler.ValidateAdmission(ctx, req)
}

func (m *tenantIDMiddleware) MutateAdmission(ctx context.Context, req *AdmissionRequest) (*MutationResponse, error) {
	ctx = m.setup(ctx)
	return m.BaseHandler.MutateAdmission(ctx, req)
}

func (m *tenantIDMiddleware) ConvertObjects(ctx context.Context, req *ConversionRequest) (*ConversionResponse, error) {
	ctx = m.setup(ctx)
	return m.BaseHandler.ConvertObjects(ctx, req)
}
