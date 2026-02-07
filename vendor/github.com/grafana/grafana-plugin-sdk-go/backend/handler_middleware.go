package backend

import (
	"context"
	"errors"
)

var (
	errNilRequest = errors.New("req cannot be nil")
	errNilSender  = errors.New("sender cannot be nil")
)

// HandlerMiddleware is an interface representing the ability to create a middleware
// that implements the Handler interface.
type HandlerMiddleware interface {
	// CreateHandlerMiddleware creates a new Handler by decorating next Handler.
	CreateHandlerMiddleware(next Handler) Handler
}

// The HandlerMiddlewareFunc type is an adapter to allow the use of ordinary
// functions as HandlerMiddleware's. If f is a function with the appropriate
// signature, HandlerMiddlewareFunc(f) is a HandlerMiddleware that calls f.
type HandlerMiddlewareFunc func(next Handler) Handler

// CreateHandlerMiddleware implements the HandlerMiddleware interface.
func (fn HandlerMiddlewareFunc) CreateHandlerMiddleware(next Handler) Handler {
	return fn(next)
}

// MiddlewareHandler decorates a Handler with HandlerMiddleware's.
type MiddlewareHandler struct {
	handler Handler
}

// HandlerFromMiddlewares creates a new MiddlewareHandler implementing Handler that decorates finalHandler with middlewares.
func HandlerFromMiddlewares(finalHandler Handler, middlewares ...HandlerMiddleware) (*MiddlewareHandler, error) {
	if finalHandler == nil {
		return nil, errors.New("finalHandler cannot be nil")
	}

	return &MiddlewareHandler{
		handler: handlerFromMiddlewares(middlewares, finalHandler),
	}, nil
}

func (h *MiddlewareHandler) setupContext(ctx context.Context, pluginCtx PluginContext, endpoint Endpoint) context.Context {
	ctx = initErrorSource(ctx)
	ctx = WithEndpoint(ctx, endpoint)
	ctx = WithPluginContext(ctx, pluginCtx)
	ctx = WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	ctx = WithUser(ctx, pluginCtx.User)
	ctx = WithUserAgent(ctx, pluginCtx.UserAgent)
	return ctx
}

func (h *MiddlewareHandler) QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointQueryData)
	return h.handler.QueryData(ctx, req)
}

func (h *MiddlewareHandler) QueryChunkedData(ctx context.Context, req *QueryChunkedDataRequest, w ChunkedDataWriter) error {
	if req == nil {
		return errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointQueryData)
	return h.handler.QueryChunkedData(ctx, req, w)
}

func (h *MiddlewareHandler) CallResource(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error {
	if req == nil {
		return errNilRequest
	}

	if sender == nil {
		return errNilSender
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointCallResource)
	return h.handler.CallResource(ctx, req, sender)
}

func (h *MiddlewareHandler) CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointCollectMetrics)
	return h.handler.CollectMetrics(ctx, req)
}

func (h *MiddlewareHandler) CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointCheckHealth)
	return h.handler.CheckHealth(ctx, req)
}

func (h *MiddlewareHandler) SubscribeStream(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointSubscribeStream)
	return h.handler.SubscribeStream(ctx, req)
}

func (h *MiddlewareHandler) PublishStream(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointPublishStream)
	return h.handler.PublishStream(ctx, req)
}

func (h *MiddlewareHandler) RunStream(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error {
	if req == nil {
		return errNilRequest
	}

	if sender == nil {
		return errors.New("sender cannot be nil")
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointRunStream)
	return h.handler.RunStream(ctx, req, sender)
}

func (h *MiddlewareHandler) ValidateAdmission(ctx context.Context, req *AdmissionRequest) (*ValidationResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointValidateAdmission)
	return h.handler.ValidateAdmission(ctx, req)
}

func (h *MiddlewareHandler) MutateAdmission(ctx context.Context, req *AdmissionRequest) (*MutationResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointMutateAdmission)
	return h.handler.MutateAdmission(ctx, req)
}

func (h *MiddlewareHandler) ConvertObjects(ctx context.Context, req *ConversionRequest) (*ConversionResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointConvertObjects)
	return h.handler.ConvertObjects(ctx, req)
}

func handlerFromMiddlewares(middlewares []HandlerMiddleware, finalHandler Handler) Handler {
	next := finalHandler
	for i := len(middlewares) - 1; i >= 0; i-- {
		next = middlewares[i].CreateHandlerMiddleware(next)
	}

	return next
}
