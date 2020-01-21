package backend

import (
	"context"
)

type CheckHealthHandler interface {
	CheckHealth(ctx context.Context) (*CheckHealthResult, error)
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

type CheckHealthResult struct {
	Status HealthStatus
	Info   string
}
