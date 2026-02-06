package backend

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// NewLoggerMiddleware creates a new HandlerMiddleware that will
// log requests.
func NewLoggerMiddleware(logger log.Logger, extractLogParamsFn func(ctx context.Context, pCtx PluginContext) []any) HandlerMiddleware {
	return HandlerMiddlewareFunc(func(next Handler) Handler {
		return &loggerMiddleware{
			BaseHandler:        NewBaseHandler(next),
			logger:             logger,
			extractLogParamsFn: extractLogParamsFn,
		}
	})
}

type loggerMiddleware struct {
	BaseHandler
	logger             log.Logger
	extractLogParamsFn func(ctx context.Context, pCtx PluginContext) []any
}

func (m *loggerMiddleware) logRequest(ctx context.Context, pCtx PluginContext, fn handlerWrapperFunc) error {
	start := time.Now()
	logParams := []any{}

	if m.extractLogParamsFn != nil {
		logParams = append(logParams, m.extractLogParamsFn(ctx, pCtx)...)
	}

	ctxLogger := m.logger.FromContext(ctx)
	ctxLogger.Debug("Plugin Request Started", logParams...)

	status, err := fn(ctx)
	logParams = append(logParams, "status", status.String(), "duration", time.Since(start).String())
	if err != nil {
		logParams = append(logParams, "error", err)
	}
	logParams = append(logParams, "statusSource", string(ErrorSourceFromContext(ctx)))

	logFunc := ctxLogger.Info

	if status > RequestStatusCancelled {
		logFunc = ctxLogger.Error
	}

	logFunc("Plugin Request Completed", logParams...)

	return err
}

func (m *loggerMiddleware) QueryData(ctx context.Context, req *QueryDataRequest) (*QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	var resp *QueryDataResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.QueryData(ctx, req)

		status := RequestStatusFromQueryDataResponse(resp, innerErr)
		if innerErr != nil {
			return status, innerErr
		} else if resp == nil {
			return RequestStatusError, errors.New("both response and error are nil, but one must be provided")
		}

		ctxLogger := m.logger.FromContext(ctx)
		for refID, dr := range resp.Responses {
			if dr.Error != nil {
				logParams := []any{
					"refID", refID,
					"status", int(dr.Status),
					"error", dr.Error,
					"statusSource", dr.ErrorSource.String(),
				}
				ctxLogger.Error("Partial data response error", logParams...)
			}
		}

		return status, nil
	})

	return resp, err
}

func (m *loggerMiddleware) CallResource(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		innerErr := m.BaseHandler.CallResource(ctx, req, sender)
		return RequestStatusFromError(innerErr), innerErr
	})

	return err
}

func (m *loggerMiddleware) CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	var resp *CheckHealthResult
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.CheckHealth(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *loggerMiddleware) CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*CollectMetricsResult, error) {
	if req == nil {
		return m.BaseHandler.CollectMetrics(ctx, req)
	}

	var resp *CollectMetricsResult
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.CollectMetrics(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *loggerMiddleware) SubscribeStream(ctx context.Context, req *SubscribeStreamRequest) (*SubscribeStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.SubscribeStream(ctx, req)
	}

	var resp *SubscribeStreamResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.SubscribeStream(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *loggerMiddleware) PublishStream(ctx context.Context, req *PublishStreamRequest) (*PublishStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.PublishStream(ctx, req)
	}

	var resp *PublishStreamResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.PublishStream(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *loggerMiddleware) RunStream(ctx context.Context, req *RunStreamRequest, sender *StreamSender) error {
	if req == nil {
		return m.BaseHandler.RunStream(ctx, req, sender)
	}

	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		innerErr := m.BaseHandler.RunStream(ctx, req, sender)
		return RequestStatusFromError(innerErr), innerErr
	})

	return err
}

func (m *loggerMiddleware) ValidateAdmission(ctx context.Context, req *AdmissionRequest) (*ValidationResponse, error) {
	if req == nil {
		return m.BaseHandler.ValidateAdmission(ctx, req)
	}

	var resp *ValidationResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.ValidateAdmission(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *loggerMiddleware) MutateAdmission(ctx context.Context, req *AdmissionRequest) (*MutationResponse, error) {
	if req == nil {
		return m.BaseHandler.MutateAdmission(ctx, req)
	}

	var resp *MutationResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.MutateAdmission(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *loggerMiddleware) ConvertObjects(ctx context.Context, req *ConversionRequest) (*ConversionResponse, error) {
	if req == nil {
		return m.BaseHandler.ConvertObjects(ctx, req)
	}

	var resp *ConversionResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.ConvertObjects(ctx, req)
		return RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}
