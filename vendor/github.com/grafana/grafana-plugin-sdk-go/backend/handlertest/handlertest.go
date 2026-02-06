package handlertest

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var _ backend.Handler = &Handler{}

// Handler a test handler implementing backend.Handler.
type Handler struct {
	QueryDataFunc         backend.QueryDataHandlerFunc
	QueryChunkedDataFunc  backend.QueryChunkedDataHandlerFunc
	CallResourceFunc      backend.CallResourceHandlerFunc
	CheckHealthFunc       backend.CheckHealthHandlerFunc
	CollectMetricsFunc    backend.CollectMetricsHandlerFunc
	SubscribeStreamFunc   backend.SubscribeStreamHandlerFunc
	PublishStreamFunc     backend.PublishStreamHandlerFunc
	RunStreamFunc         backend.RunStreamHandlerFunc
	MutateAdmissionFunc   backend.MutateAdmissionFunc
	ValidateAdmissionFunc backend.ValidateAdmissionFunc
	ConvertObjectsFunc    backend.ConvertObjectsFunc
}

func (h Handler) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if h.QueryDataFunc != nil {
		return h.QueryDataFunc(ctx, req)
	}

	return nil, nil
}

func (h Handler) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	if h.QueryChunkedDataFunc != nil {
		return h.QueryChunkedDataFunc(ctx, req, w)
	}

	return nil
}

func (h Handler) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if h.CallResourceFunc != nil {
		return h.CallResourceFunc(ctx, req, sender)
	}

	return nil
}

func (h Handler) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if h.CheckHealthFunc != nil {
		return h.CheckHealthFunc(ctx, req)
	}

	return nil, nil
}

func (h Handler) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if h.CollectMetricsFunc != nil {
		return h.CollectMetricsFunc(ctx, req)
	}

	return nil, nil
}

func (h Handler) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if h.SubscribeStreamFunc != nil {
		return h.SubscribeStreamFunc(ctx, req)
	}

	return nil, nil
}

func (h Handler) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if h.PublishStreamFunc != nil {
		return h.PublishStreamFunc(ctx, req)
	}

	return nil, nil
}

func (h Handler) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if h.RunStreamFunc != nil {
		return h.RunStreamFunc(ctx, req, sender)
	}

	return nil
}

func (h Handler) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	if h.ValidateAdmissionFunc != nil {
		return h.ValidateAdmissionFunc(ctx, req)
	}

	return nil, nil
}

func (h Handler) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	if h.MutateAdmissionFunc != nil {
		return h.MutateAdmissionFunc(ctx, req)
	}

	return nil, nil
}

func (h Handler) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	if h.ConvertObjectsFunc != nil {
		return h.ConvertObjectsFunc(ctx, req)
	}

	return nil, nil
}

type HandlerMiddlewareTest struct {
	T                      *testing.T
	TestHandler            *Handler
	Middlewares            []backend.HandlerMiddleware
	MiddlewareHandler      *backend.MiddlewareHandler
	QueryDataReq           *backend.QueryDataRequest
	QueryDataCtx           context.Context
	CallResourceReq        *backend.CallResourceRequest
	CallResourceCtx        context.Context
	CheckHealthReq         *backend.CheckHealthRequest
	CheckHealthCtx         context.Context
	CollectMetricsReq      *backend.CollectMetricsRequest
	CollectMetricsCtx      context.Context
	SubscribeStreamReq     *backend.SubscribeStreamRequest
	SubscribeStreamCtx     context.Context
	PublishStreamReq       *backend.PublishStreamRequest
	PublishStreamCtx       context.Context
	RunStreamReq           *backend.RunStreamRequest
	RunStreamCtx           context.Context
	MutateAdmissionReq     *backend.AdmissionRequest
	MutateAdmissionCtx     context.Context
	ValidationAdmissionReq *backend.AdmissionRequest
	ValidateAdmissionCtx   context.Context
	ConvertObjectReq       *backend.ConversionRequest
	ConvertObjectCtx       context.Context

	// When CallResource is called, the sender will be called with these values
	callResourceResponses      []*backend.CallResourceResponse
	runStreamResponseBytes     [][]byte
	runStreamResponseJSONBytes [][]byte
}

type HandlerMiddlewareTestOption func(*HandlerMiddlewareTest)

func NewHandlerMiddlewareTest(t *testing.T, opts ...HandlerMiddlewareTestOption) *HandlerMiddlewareTest {
	t.Helper()

	cdt := &HandlerMiddlewareTest{
		T: t,
	}
	cdt.TestHandler = &Handler{
		QueryDataFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			cdt.QueryDataReq = req
			cdt.QueryDataCtx = ctx
			return nil, nil
		},
		CallResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			cdt.CallResourceReq = req
			cdt.CallResourceCtx = ctx
			if cdt.callResourceResponses != nil {
				for _, r := range cdt.callResourceResponses {
					if err := sender.Send(r); err != nil {
						return err
					}
				}
			}
			return nil
		},
		CheckHealthFunc: func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			cdt.CheckHealthReq = req
			cdt.CheckHealthCtx = ctx
			return nil, nil
		},
		CollectMetricsFunc: func(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
			cdt.CollectMetricsReq = req
			cdt.CollectMetricsCtx = ctx
			return nil, nil
		},
		SubscribeStreamFunc: func(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
			cdt.SubscribeStreamReq = req
			cdt.SubscribeStreamCtx = ctx
			return nil, nil
		},
		PublishStreamFunc: func(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
			cdt.PublishStreamReq = req
			cdt.PublishStreamCtx = ctx
			return nil, nil
		},
		RunStreamFunc: func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
			cdt.RunStreamReq = req
			cdt.RunStreamCtx = ctx

			if cdt.runStreamResponseBytes != nil {
				for _, b := range cdt.runStreamResponseBytes {
					if err := sender.SendBytes(b); err != nil {
						return err
					}
				}
			}

			if cdt.runStreamResponseJSONBytes != nil {
				for _, b := range cdt.runStreamResponseJSONBytes {
					if err := sender.SendJSON(b); err != nil {
						return err
					}
				}
			}

			return nil
		},
		ValidateAdmissionFunc: func(ctx context.Context, ar *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
			cdt.ValidationAdmissionReq = ar
			cdt.ValidateAdmissionCtx = ctx
			return nil, nil
		},
		MutateAdmissionFunc: func(ctx context.Context, ar *backend.AdmissionRequest) (*backend.MutationResponse, error) {
			cdt.MutateAdmissionReq = ar
			cdt.MutateAdmissionCtx = ctx
			return nil, nil
		},
		ConvertObjectsFunc: func(ctx context.Context, cr *backend.ConversionRequest) (*backend.ConversionResponse, error) {
			cdt.ConvertObjectReq = cr
			cdt.ConvertObjectCtx = ctx
			return nil, nil
		},
	}

	for _, opt := range opts {
		opt(cdt)
	}

	mwHandler, err := backend.HandlerFromMiddlewares(cdt.TestHandler, cdt.Middlewares...)
	if err != nil {
		t.Fatalf("failed to create handler from middlewares: %s", err.Error())
	}

	if mwHandler == nil {
		t.Fatal("create handler from middlewares not expected to be nil")
	}

	cdt.MiddlewareHandler = mwHandler

	return cdt
}

// WithMiddlewares HandlerMiddlewareTestOption option to append middlewares to HandlerMiddlewareTest.
func WithMiddlewares(middlewares ...backend.HandlerMiddleware) HandlerMiddlewareTestOption {
	return HandlerMiddlewareTestOption(func(cdt *HandlerMiddlewareTest) {
		if cdt.Middlewares == nil {
			cdt.Middlewares = []backend.HandlerMiddleware{}
		}

		cdt.Middlewares = append(cdt.Middlewares, middlewares...)
	})
}

// WithResourceResponses can be used to make the test client send simulated resource responses back over the sender stream.
func WithResourceResponses(responses []*backend.CallResourceResponse) HandlerMiddlewareTestOption {
	return HandlerMiddlewareTestOption(func(cdt *HandlerMiddlewareTest) {
		cdt.callResourceResponses = responses
	})
}

// WithRunStreamBytesResponses can be used to make the test client send simulated bytes responses back over the sender stream.
func WithRunStreamBytesResponses(responses [][]byte) HandlerMiddlewareTestOption {
	return HandlerMiddlewareTestOption(func(cdt *HandlerMiddlewareTest) {
		cdt.runStreamResponseBytes = responses
	})
}

// WithRunStreamJSONResponses can be used to make the test client send simulated JSON responses back over the sender stream.
func WithRunStreamJSONResponses(responses [][]byte) HandlerMiddlewareTestOption {
	return HandlerMiddlewareTestOption(func(cdt *HandlerMiddlewareTest) {
		cdt.runStreamResponseJSONBytes = responses
	})
}
