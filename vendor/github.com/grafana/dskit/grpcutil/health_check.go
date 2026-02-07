package grpcutil

import (
	"context"

	"github.com/gogo/status"
	"go.uber.org/atomic"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/dskit/services"
)

// Check is a function that determines if this gRPC application is healthy.
type Check func(ctx context.Context) bool

// WithManager returns a new Check that tests if the managed services are healthy.
func WithManager(manager *services.Manager) Check {
	return func(context.Context) bool {
		states := manager.ServicesByState()

		// Given this is a health check endpoint for the whole instance, we should consider
		// it healthy after all services have been started (running) and until all
		// services are terminated. Some services, like ingesters, are still
		// fully functioning while stopping.
		if len(states[services.New]) > 0 || len(states[services.Starting]) > 0 || len(states[services.Failed]) > 0 {
			return false
		}

		return len(states[services.Running]) > 0 || len(states[services.Stopping]) > 0
	}
}

// WithShutdownRequested returns a new Check that returns false when shutting down.
func WithShutdownRequested(requested *atomic.Bool) Check {
	return func(context.Context) bool {
		return !requested.Load()
	}
}

// HealthCheck fulfills the grpc_health_v1.HealthServer interface by ensuring
// each of the provided Checks indicates the application is healthy.
type HealthCheck struct {
	checks []Check
}

var _ grpc_health_v1.HealthServer = (*HealthCheck)(nil)

// NewHealthCheck returns a new HealthCheck for the provided service manager.
func NewHealthCheck(sm *services.Manager) *HealthCheck {
	return NewHealthCheckFrom(WithManager(sm))
}

// NewHealthCheckFrom returns a new HealthCheck that uses each of the provided Checks.
func NewHealthCheckFrom(checks ...Check) *HealthCheck {
	return &HealthCheck{
		checks: checks,
	}
}

// Check implements the grpc healthcheck.
func (h *HealthCheck) Check(ctx context.Context, _ *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	for _, check := range h.checks {
		if !check(ctx) {
			return &grpc_health_v1.HealthCheckResponse{Status: grpc_health_v1.HealthCheckResponse_NOT_SERVING}, nil
		}
	}

	return &grpc_health_v1.HealthCheckResponse{Status: grpc_health_v1.HealthCheckResponse_SERVING}, nil
}

// Watch implements the grpc healthcheck.
func (h *HealthCheck) Watch(_ *grpc_health_v1.HealthCheckRequest, _ grpc_health_v1.Health_WatchServer) error {
	return status.Error(codes.Unimplemented, "Watching is not supported")
}

// List implements the grpc healthcheck.
func (h *HealthCheck) List(ctx context.Context, _ *grpc_health_v1.HealthListRequest) (*grpc_health_v1.HealthListResponse, error) {
	checkResp, err := h.Check(ctx, nil)
	if err != nil {
		return &grpc_health_v1.HealthListResponse{}, err
	}

	return &grpc_health_v1.HealthListResponse{
		Statuses: map[string]*grpc_health_v1.HealthCheckResponse{
			"server": checkResp,
		},
	}, nil
}
