package hclog

import (
	"context"
)

// WithContext inserts a logger into the context and is retrievable
// with FromContext. The optional args can be set with the same syntax as
// Logger.With to set fields on the inserted logger. This will not modify
// the logger argument in-place.
func WithContext(ctx context.Context, logger Logger, args ...interface{}) context.Context {
	// While we could call logger.With even with zero args, we have this
	// check to avoid unnecessary allocations around creating a copy of a
	// logger.
	if len(args) > 0 {
		logger = logger.With(args...)
	}

	return context.WithValue(ctx, contextKey, logger)
}

// FromContext returns a logger from the context. This will return L()
// (the default logger) if no logger is found in the context. Therefore,
// this will never return a nil value.
func FromContext(ctx context.Context) Logger {
	logger, _ := ctx.Value(contextKey).(Logger)
	if logger == nil {
		return L()
	}

	return logger
}

// Unexported new type so that our context key never collides with another.
type contextKeyType struct{}

// contextKey is the key used for the context to store the logger.
var contextKey = contextKeyType{}
