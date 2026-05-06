package backend

import (
	"context"
	"errors"
	"slices"
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
	middlewares  []HandlerMiddleware
	finalHandler Handler
}

// HandlerFromMiddlewares creates a new MiddlewareHandler implementing Handler that decorates finalHandler with middlewares.
func HandlerFromMiddlewares(finalHandler Handler, middlewares ...HandlerMiddleware) (*MiddlewareHandler, error) {
	if finalHandler == nil {
		return nil, errors.New("finalHandler cannot be nil")
	}

	return &MiddlewareHandler{
		middlewares:  middlewares,
		finalHandler: finalHandler,
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
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.QueryData(ctx, req)
}

func (h MiddlewareHandler) CallResource(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error {
	if req == nil {
		return errNilRequest
	}

	if sender == nil {
		return errNilSender
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointCallResource)
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.CallResource(ctx, req, sender)
}

func (h MiddlewareHandler) CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointCollectMetrics)
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.CollectMetrics(ctx, req)
}

func (h MiddlewareHandler) CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointCheckHealth)
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.CheckHealth(ctx, req)
}

func (h MiddlewareHandler) SubscribeStream(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointSubscribeStream)
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.SubscribeStream(ctx, req)
}

func (h MiddlewareHandler) PublishStream(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointPublishStream)
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.PublishStream(ctx, req)
}

func (h MiddlewareHandler) RunStream(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error {
	if req == nil {
		return errNilRequest
	}

	if sender == nil {
		return errors.New("sender cannot be nil")
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointRunStream)
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.RunStream(ctx, req, sender)
}

func (h MiddlewareHandler) ValidateAdmission(ctx context.Context, req *AdmissionRequest) (*ValidationResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointValidateAdmission)
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.ValidateAdmission(ctx, req)
}

func (h MiddlewareHandler) MutateAdmission(ctx context.Context, req *AdmissionRequest) (*MutationResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointMutateAdmission)
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.MutateAdmission(ctx, req)
}

func (h MiddlewareHandler) ConvertObjects(ctx context.Context, req *ConversionRequest) (*ConversionResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	ctx = h.setupContext(ctx, req.PluginContext, EndpointConvertObjects)
	handler := handlerFromMiddlewares(h.middlewares, h.finalHandler)
	return handler.ConvertObjects(ctx, req)
}

func handlerFromMiddlewares(middlewares []HandlerMiddleware, finalHandler Handler) Handler {
	if len(middlewares) == 0 {
		return finalHandler
	}

	clonedMws := slices.Clone(middlewares)
	slices.Reverse(clonedMws)
	next := finalHandler

	for _, m := range clonedMws {
		next = m.CreateHandlerMiddleware(next)
	}

	return next
}
