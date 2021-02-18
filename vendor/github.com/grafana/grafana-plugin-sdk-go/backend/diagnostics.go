package backend

import (
	"context"
	"strconv"
)

// CheckHealthHandler enables users to send health check
// requests to a backend plugin
type CheckHealthHandler interface {
	CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error)
}

// CheckHealthHandlerFunc is an adapter to allow the use of
// ordinary functions as backend.CheckHealthHandler. If f is a function
// with the appropriate signature, CheckHealthHandlerFunc(f) is a
// Handler that calls f.
type CheckHealthHandlerFunc func(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error)

// CheckHealth calls fn(ctx, req).
func (fn CheckHealthHandlerFunc) CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error) {
	return fn(ctx, req)
}

// HealthStatus is the status of the plugin.
type HealthStatus int

const (
	// HealthStatusUnknown means the status of the plugin is unknown.
	HealthStatusUnknown HealthStatus = iota

	// HealthStatusOk means the status of the plugin is good.
	HealthStatusOk

	// HealthStatusError means the plugin is in an error state.
	HealthStatusError
)

var healthStatusNames = map[int]string{
	0: "UNKNOWN",
	1: "OK",
	2: "ERROR",
}

// String textual represntation of the status.
func (hs HealthStatus) String() string {
	s, exists := healthStatusNames[int(hs)]
	if exists {
		return s
	}
	return strconv.Itoa(int(hs))
}

// CheckHealthRequest contains the healthcheck request
type CheckHealthRequest struct {
	PluginContext PluginContext
}

// CheckHealthResult contains the healthcheck response
type CheckHealthResult struct {
	Status      HealthStatus
	Message     string
	JSONDetails []byte
}

// CollectMetricsHandler handles metric collection.
type CollectMetricsHandler interface {
	CollectMetrics(ctx context.Context) (*CollectMetricsResult, error)
}

// CollectMetricsHandlerFunc is an adapter to allow the use of
// ordinary functions as backend.CollectMetricsHandler. If f is a function
// with the appropriate signature, CollectMetricsHandlerFunc(f) is a
// Handler that calls f.
type CollectMetricsHandlerFunc func(ctx context.Context) (*CollectMetricsResult, error)

// CollectMetrics calls fn(ctx, req).
func (fn CollectMetricsHandlerFunc) CollectMetrics(ctx context.Context) (*CollectMetricsResult, error) {
	return fn(ctx)
}

// CollectMetricsResult collect metrics result.
type CollectMetricsResult struct {
	PrometheusMetrics []byte
}
