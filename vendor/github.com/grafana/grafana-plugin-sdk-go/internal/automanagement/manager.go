package automanagement

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Manager is a helper to simplify instance management for plugin
// developers. It gets instancemgmt.InstanceManager on every call thus making
// sure datasource instance disposed on configuration change and new datasource
// instance created.
type Manager struct {
	instancemgmt.InstanceManager
}

// NewManager creates Manager. It accepts datasource
// instance factory.
func NewManager(instanceManager instancemgmt.InstanceManager) *Manager {
	return &Manager{InstanceManager: instanceManager}
}

func (m *Manager) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	h, err := m.Get(ctx, req.PluginContext)
	if err != nil {
		if len(req.Queries) == 0 {
			// shouldn't be possible, but just in case
			return nil, err
		}
		var esErr backend.ErrorWithSource
		ok := errors.As(err, &esErr)
		if !ok { // not an errorsource error, return opaquely
			return nil, err
		}
		resp := backend.NewQueryDataResponse()
		resp.Responses[req.Queries[0].RefID] = backend.DataResponse{
			Error:       err,
			ErrorSource: esErr.ErrorSource(),
		}
		return resp, nil
	}
	if ds, ok := h.(backend.QueryDataHandler); ok {
		return ds.QueryData(ctx, req)
	}
	return nil, status.Error(codes.Unimplemented, "unimplemented")
}

func (m *Manager) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	h, err := m.Get(ctx, req.PluginContext)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}
	if ds, ok := h.(backend.CheckHealthHandler); ok {
		return ds.CheckHealth(ctx, req)
	}
	return nil, status.Error(codes.Unimplemented, "unimplemented")
}

func (m *Manager) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	h, err := m.Get(ctx, req.PluginContext)
	if err != nil {
		return err
	}
	if ds, ok := h.(backend.CallResourceHandler); ok {
		return ds.CallResource(ctx, req, sender)
	}
	return status.Error(codes.Unimplemented, "unimplemented")
}

func (m *Manager) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	h, err := m.Get(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	if ds, ok := h.(backend.StreamHandler); ok {
		return ds.SubscribeStream(ctx, req)
	}
	return nil, status.Error(codes.Unimplemented, "unimplemented")
}

func (m *Manager) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	h, err := m.Get(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	if ds, ok := h.(backend.StreamHandler); ok {
		return ds.PublishStream(ctx, req)
	}
	return nil, status.Error(codes.Unimplemented, "unimplemented")
}

func (m *Manager) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	h, err := m.Get(ctx, req.PluginContext)
	if err != nil {
		return err
	}
	if ds, ok := h.(backend.StreamHandler); ok {
		return ds.RunStream(ctx, req, sender)
	}
	return status.Error(codes.Unimplemented, "unimplemented")
}
