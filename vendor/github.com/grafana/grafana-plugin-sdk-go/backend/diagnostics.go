package backend

import (
	"context"
)

// CheckHealthHandler enables users to send health check
// requests to a backend plugin
type CheckHealthHandler interface {
	CheckHealth(ctx context.Context, req *CheckHealthRequest) (*CheckHealthResult, error)
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
