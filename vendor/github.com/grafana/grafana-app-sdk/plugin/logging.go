package plugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/logging"
)

// NewLogger returns a new PluginLogger that wraps the provided log.Logger
func NewLogger(l log.Logger) *PluginLogger {
	return &PluginLogger{
		Logger: l,
	}
}

// PluginLogger wraps a plugin-sdk-go log.Logger with the context methods needed to implement logging.Logger,
// and automatically adds the traceID from the context to the log.Logger's args when DebugContext,
// InfoContext, WarnContext, or ErrorContext are called.
// nolint:revive
type PluginLogger struct {
	log.Logger
}

// With returns a new Logger with the provided key/value pairs already set
func (p *PluginLogger) With(args ...any) logging.Logger {
	return &PluginLogger{
		Logger: p.Logger.With(args...),
	}
}

// WithContext returns a new Logger with the trace ID in the provided context as an automatic field.
// If the context does not contain a trace ID, the same logger is returned.
func (p *PluginLogger) WithContext(ctx context.Context) logging.Logger {
	if traceID := trace.SpanFromContext(ctx).SpanContext().TraceID(); traceID.IsValid() {
		return &PluginLogger{
			Logger: p.Logger.With(logging.TraceIDKey, traceID),
		}
	}

	return p
}

// Compile-time interface compliance check
var _ logging.Logger = &PluginLogger{}
