package logging

import (
	"context"
)

var (
	// DefaultLogger is the default Logger for all SDK logging, if one hasn't been provided in the context.
	DefaultLogger Logger = &NoOpLogger{}

	contextKey = loggerContextKey{}
)

type loggerContextKey struct{}

// FromContext returns the Logger set in the context with Context(), or the DefaultLogger if no Logger is set in the context.
// If DefaultLogger is nil, it returns a *NoOpLogger so that the return is always valid to call methods on without nil-checking.
// So long as the Logger to return is not the NoOpLogger, it will carry the context provided in this call
// (by calling WithContext on the logger in the context).
func FromContext(ctx context.Context) Logger {
	l := ctx.Value(contextKey)
	if l != nil {
		if logger, ok := l.(Logger); ok {
			return logger.WithContext(ctx)
		}
	}
	if DefaultLogger != nil {
		return DefaultLogger.WithContext(ctx)
	}
	return &NoOpLogger{}
}

// Context returns a new context built from the provided context with the provided logger in it.
// The Logger added with Context() can be retrieved with FromContext()
func Context(ctx context.Context, logger Logger) context.Context {
	return context.WithValue(ctx, contextKey, logger)
}

// Logger is a simple logging interface that exposes methods got writing structured log messages at varying levels,
// and methods to return an altered logger (With and WithContext).
type Logger interface {
	// Debug logs a message at the DEBUG level, with optional arguments as a sequence of key/value pairs
	// (e.g. Debug("message", "key1", "val1", "key2", "val2"))
	Debug(msg string, args ...any)
	// Info logs a message at the INFO level, with optional arguments as a sequence of key/value pairs
	// (e.g. Info("message", "key1", "val1", "key2", "val2"))
	Info(msg string, args ...any)
	// Warn logs a message at the WARN level, with optional arguments as a sequence of key/value pairs
	// (e.g. Warn("message", "key1", "val1", "key2", "val2"))
	Warn(msg string, args ...any)
	// Error logs a message at the ERROR level, with optional arguments as a sequence of key/value pairs
	// (e.g. Error("message", "key1", "val1", "key2", "val2"))
	Error(msg string, args ...any)
	// With returns a Logger with the supplied key/value pair arguments attached to any messages it logs.
	// This is syntactically equivalent to adding args to every call to a log method on the logger.
	With(args ...any) Logger
	// WithContext returns a Logger with the provided context added, such that any subsequent
	// calls to log methods should pass the context to the underlying handler.
	WithContext(context.Context) Logger
}

// NoOpLogger is an implementation of Logger which does nothing when its methods are called
type NoOpLogger struct{}

func (*NoOpLogger) Debug(string, ...any) {}
func (*NoOpLogger) Info(string, ...any)  {}
func (*NoOpLogger) Warn(string, ...any)  {}
func (*NoOpLogger) Error(string, ...any) {}
func (n *NoOpLogger) With(...any) Logger {
	return n
}
func (n *NoOpLogger) WithContext(context.Context) Logger {
	return n
}

var (
	_ Logger = &NoOpLogger{}
)
