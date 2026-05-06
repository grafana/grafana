package logging

import (
	"context"

	"log/slog"

	"go.opentelemetry.io/otel/trace"
)

// TraceIDKey is the key used by loggers for the trace ID field in key/value pairs.
// It is set as a variable rather than a constant so that it can be changed by users at startup.
var TraceIDKey = "traceID"

// NewSLogLogger creates a new SLogLogger which wraps an *slog.Logger that has a handler to always add a trace ID
// to the log messages if the context is provided in the log call (e.g. InfoContext())
func NewSLogLogger(handler slog.Handler) *SLogLogger {
	return &SLogLogger{
		Logger: slog.New(&traceIDHandler{next: handler}),
	}
}

// SLogLogger wraps slog.Logger both to override the With() method to return an *SLogLogger,
// and to have an embedded context.Context, which is passed to the slog.Logger's _Level_Context method
// when the _Level_ method is called.
type SLogLogger struct {
	Logger *slog.Logger
	ctx    context.Context
}

// Debug calls the slog.Logger's DebugContext method with the context provided by WithContext
func (s *SLogLogger) Debug(msg string, args ...any) {
	s.Logger.DebugContext(s.ctx, msg, args...)
}

// Info calls the slog.Logger's InfoContext method with the context provided by WithContext
func (s *SLogLogger) Info(msg string, args ...any) {
	s.Logger.InfoContext(s.ctx, msg, args...)
}

// Warn calls the slog.Logger's WarnContext method with the context provided by WithContext
func (s *SLogLogger) Warn(msg string, args ...any) {
	s.Logger.WarnContext(s.ctx, msg, args...)
}

// Error calls the slog.Logger's ErrorContext method with the context provided by WithContext
func (s *SLogLogger) Error(msg string, args ...any) {
	s.Logger.ErrorContext(s.ctx, msg, args...)
}

// With returns a new *SLogLogger with the provided key/value pairs attached
func (s *SLogLogger) With(args ...any) Logger {
	return &SLogLogger{
		Logger: s.Logger.With(args...),
		ctx:    s.ctx,
	}
}

// WithContext returns an *SLogLogger which still points to the same underlying *slog.Logger,
// but has the provided context attached for Debug, Info, Warn, and Error calls.
func (s *SLogLogger) WithContext(ctx context.Context) Logger {
	return &SLogLogger{
		Logger: s.Logger,
		ctx:    ctx,
	}
}

// Compile-time interface compliance check
var _ Logger = &SLogLogger{}

type traceIDHandler struct {
	next slog.Handler
}

func (t *traceIDHandler) Enabled(ctx context.Context, lvl slog.Level) bool {
	return t.next.Enabled(ctx, lvl)
}

func (t *traceIDHandler) Handle(ctx context.Context, rec slog.Record) error {
	if traceID := trace.SpanContextFromContext(ctx).TraceID(); traceID.IsValid() {
		rec.AddAttrs(slog.String(TraceIDKey, traceID.String()))
	}
	return t.next.Handle(ctx, rec)
}

func (t *traceIDHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &traceIDHandler{
		next: t.next.WithAttrs(attrs),
	}
}

func (t *traceIDHandler) WithGroup(name string) slog.Handler {
	return &traceIDHandler{
		next: t.next.WithGroup(name),
	}
}
