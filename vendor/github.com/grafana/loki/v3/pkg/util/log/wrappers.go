package log

import (
	"context"

	"github.com/go-kit/log"
	"github.com/grafana/dskit/tracing"

	"github.com/grafana/dskit/tenant"
)

// WithUserID returns a Logger that has information about the current user in
// its details.
func WithUserID(userID string, l log.Logger) log.Logger {
	// See note in WithContext.
	return log.With(l, "org_id", userID)
}

// WithContext returns a log.Logger that has information about the current user in
// its details.
//
// e.g.
//
//	log := util.WithContext(ctx)
//	log.Errorf("Could not chunk chunks: %v", err)
func WithContext(ctx context.Context, l log.Logger) log.Logger {
	// Weaveworks uses "orgs" and "orgID" to represent Cortex users,
	// even though the code-base generally uses `userID` to refer to the same thing.
	userID, err := tenant.TenantID(ctx)
	if err == nil {
		l = WithUserID(userID, l)
	}

	traceID, sampled := tracing.ExtractSampledTraceID(ctx)
	if sampled {
		return log.With(l, "traceID", traceID, "sampled", "true")
	}
	if traceID != "" {
		return log.With(l, "traceID", traceID)
	}
	return l

}
