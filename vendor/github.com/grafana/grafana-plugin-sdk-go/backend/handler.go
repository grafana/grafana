package backend

import "context"

// Handler interface for all handlers.
type Handler interface {
	QueryDataHandler
	CheckHealthHandler
	CallResourceHandler
	CollectMetricsHandler
	StreamHandler
	AdmissionHandler
	ConversionHandler
}

var _ = Handler(&BaseHandler{})

// BaseHandler base handler provides a base implementation of Handler interface
// passing the request down the chain to next Handler.
// This allows handlers to avoid implementing the full Handler interface.
type BaseHandler struct {
	next Handler
}

// NewBaseHandler creates a new BaseHandler.
func NewBaseHandler(next Handler) BaseHandler {
	return BaseHandler{
		next: next,
	}
}

func (m BaseHandler) QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error) {
	return m.next.QueryData(ctx, req)
}

func (m BaseHandler) CallResource(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error {
	return m.next.CallResource(ctx, req, sender)
}

func (m BaseHandler) CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error) {
	return m.next.CheckHealth(ctx, req)
}

func (m BaseHandler) CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m BaseHandler) SubscribeStream(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m BaseHandler) PublishStream(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m BaseHandler) RunStream(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}

func (m BaseHandler) ValidateAdmission(ctx context.Context, req *AdmissionRequest) (*ValidationResponse, error) {
	return m.next.ValidateAdmission(ctx, req)
}

func (m *BaseHandler) MutateAdmission(ctx context.Context, req *AdmissionRequest) (*MutationResponse, error) {
	return m.next.MutateAdmission(ctx, req)
}

func (m *BaseHandler) ConvertObjects(ctx context.Context, req *ConversionRequest) (*ConversionResponse, error) {
	return m.next.ConvertObjects(ctx, req)
}

// Handlers implements Handler.
type Handlers struct {
	QueryDataHandler
	CheckHealthHandler
	CallResourceHandler
	CollectMetricsHandler
	StreamHandler
	AdmissionHandler
	ConversionHandler
}

var _ Handler = &Handlers{}
