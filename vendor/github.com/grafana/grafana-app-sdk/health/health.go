package health

import (
	"context"
)

// Check is an interface that describes anything that has a health check for it
type Check interface {
	HealthCheck(context.Context) error
	HealthCheckName() string
}

// Checker is an interface that describes the registered health checks for a given component (informer, controller, runner etc.)
type Checker interface {
	// HealthChecks returns a slice of all Check instances which should be run for health checks
	HealthChecks() []Check
}
