package backend

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// NewTracingMiddleware creates a new HandlerMiddleware that will
// create traces/spans for requests.
func NewTracingMiddleware(tracer trace.Tracer) HandlerMiddleware {
	return HandlerMiddlewareFunc(func(next Handler) Handler {
		return &tracingMiddleware{
			BaseHandler: NewBaseHandler(next),
			tracer:      tracer,
		}
	})
}

type tracingMiddleware struct {
	BaseHandler
	tracer trace.Tracer
}

func (m *tracingMiddleware) traceRequest(ctx context.Context, pCtx PluginContext, fn func(context.Context) (RequestStatus, error)) error {
	endpoint := EndpointFromContext(ctx)
	ctx, span := m.tracer.Start(ctx, fmt.Sprintf("sdk.%s", endpoint), trace.WithAttributes(
		attribute.String("plugin_id", pCtx.PluginID),
		attribute.Int64("org_id", pCtx.OrgID),
	))
	defer span.End()

	if pCtx.DataSourceInstanceSettings != nil {
		span.SetAttributes(
			attribute.String("datasource_name", pCtx.DataSourceInstanceSettings.Name),
			attribute.String("datasource_uid", pCtx.DataSourceInstanceSettings.UID),
		)
	}

	if u := pCtx.User; u != nil {
		span.SetAttributes(attribute.String("user", pCtx.User.Name))
	}

	status, err := fn(ctx)

	span.SetAttributes(
		attribute.String("request_status", status.String()),
		attribute.String("status_source", string(ErrorSourceFromContext(ctx))),
	)

	if err != nil {
		return tracing.Error(span, err)
	}

	return nil
}

func (m *tracingMiddleware) QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error) {
	var resp *QueryDataResponse
	err := m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.QueryData(ctx, req)
		return RequestStatusFromQueryDataResponse(resp, innerErr), innerErr
	})

	return resp, err
}

func (m *tracingMiddleware) CallResource(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error {
	return m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		innerErr := m.BaseHandler.CallResource(ctx, req, sender)
		return RequestStatusFromError(innerErr), innerErr
	})
}

func (m *tracingMiddleware) CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error) {
	var resp *CheckHealthResult
	err := m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.CheckHealth(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *tracingMiddleware) CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error) {
	var resp *CollectMetricsResult
	err := m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.CollectMetrics(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})
	return resp, err
}

func (m *tracingMiddleware) SubscribeStream(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error) {
	var resp *SubscribeStreamResponse
	err := m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.SubscribeStream(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})
	return resp, err
}

func (m *tracingMiddleware) PublishStream(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error) {
	var resp *PublishStreamResponse
	err := m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.PublishStream(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})
	return resp, err
}

func (m *tracingMiddleware) RunStream(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error {
	err := m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		innerErr := m.BaseHandler.RunStream(ctx, req, sender)
		return RequestStatusFromError(innerErr), innerErr
	})
	return err
}

func (m *tracingMiddleware) ValidateAdmission(ctx context.Context, req *AdmissionRequest) (*ValidationResponse, error) {
	var resp *ValidationResponse
	err := m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.ValidateAdmission(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *tracingMiddleware) MutateAdmission(ctx context.Context, req *AdmissionRequest) (*MutationResponse, error) {
	var resp *MutationResponse
	err := m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.MutateAdmission(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *tracingMiddleware) ConvertObjects(ctx context.Context, req *ConversionRequest) (*ConversionResponse, error) {
	var resp *ConversionResponse
	err := m.traceRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.ConvertObjects(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}
