package backend

import (
	"context"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// Logger is the default logger instance. This can be used directly to log from
// your plugin to grafana-server with calls like Logger.Debug(...).
var Logger = log.DefaultLogger

// NewLoggerWith creates a new logger with the given arguments.
var NewLoggerWith = func(args ...interface{}) log.Logger {
	return log.New().With(args...)
}

func withContextualLogAttributes(ctx context.Context, pCtx PluginContext) context.Context {
	args := []any{"pluginId", pCtx.PluginID, "pluginVersion", pCtx.PluginVersion}

	endpoint := EndpointFromContext(ctx)
	if !endpoint.IsEmpty() {
		args = append(args, "endpoint", string(endpoint))
	}

	if tid := trace.SpanContextFromContext(ctx).TraceID(); tid.IsValid() {
		args = append(args, "traceId", tid.String())
	}
	if pCtx.DataSourceInstanceSettings != nil {
		args = append(
			args,
			"dsName", pCtx.DataSourceInstanceSettings.Name,
			"dsUid", pCtx.DataSourceInstanceSettings.UID,
		)
		if pCtx.User != nil {
			args = append(args, "uname", pCtx.User.Name)
		}
	}

	if ctxLogAttributes := log.ContextualAttributesFromIncomingContext(ctx); len(ctxLogAttributes) > 0 {
		args = append(args, ctxLogAttributes...)
	}

	ctx = log.WithContextualAttributes(ctx, args)
	return ctx
}

// newContextualLoggerMiddleware creates a new handler middleware that setup contextual logging.
func newContextualLoggerMiddleware() HandlerMiddleware {
	return HandlerMiddlewareFunc(func(next Handler) Handler {
		return &contextualLoggerMiddleware{
			BaseHandler: NewBaseHandler(next),
		}
	})
}

// contextualLoggerMiddleware a handler middleware that setup contextual logging.
type contextualLoggerMiddleware struct {
	BaseHandler
}

func (m *contextualLoggerMiddleware) setup(ctx context.Context, pCtx PluginContext) context.Context {
	return withContextualLogAttributes(ctx, pCtx)
}

func (m *contextualLoggerMiddleware) QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error) {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.QueryData(ctx, req)
}

func (m *contextualLoggerMiddleware) CallResource(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *contextualLoggerMiddleware) CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error) {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *contextualLoggerMiddleware) CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error) {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.CollectMetrics(ctx, req)
}

func (m *contextualLoggerMiddleware) SubscribeStream(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error) {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *contextualLoggerMiddleware) PublishStream(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error) {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *contextualLoggerMiddleware) RunStream(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.RunStream(ctx, req, sender)
}

func (m *contextualLoggerMiddleware) ValidateAdmission(ctx context.Context, req *AdmissionRequest) (*ValidationResponse, error) {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.ValidateAdmission(ctx, req)
}

func (m *contextualLoggerMiddleware) MutateAdmission(ctx context.Context, req *AdmissionRequest) (*MutationResponse, error) {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.MutateAdmission(ctx, req)
}

func (m *contextualLoggerMiddleware) ConvertObjects(ctx context.Context, req *ConversionRequest) (*ConversionResponse, error) {
	ctx = m.setup(ctx, req.PluginContext)
	return m.BaseHandler.ConvertObjects(ctx, req)
}
