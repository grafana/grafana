package log

import (
	"context"
)

// loggerCtxKey is the key used to store the logger in the context.
type loggerCtxKey struct{}

// ToContext adds a logger to the context that can be retrieved later.
// The logger will be used for operations performed with this context.
// If no logger is provided in the context, a no-op logger will be used.
//
// Parameters:
//   - ctx: The context to add the logger to
//   - logger: The logger to store in the context
//
// Returns:
//   - context.Context: A new context with the logger stored
func ToContext(ctx context.Context, logger Logger) context.Context {
	return context.WithValue(ctx, loggerCtxKey{}, logger)
}

// FromContext retrieves the logger from the context.
// If no logger is stored in the context, nil will be returned.
//
// Parameters:
//   - ctx: The context to retrieve the logger from
//
// Returns:
//   - Logger: The logger stored in the context, or nil if none is found
func FromContext(ctx context.Context) Logger {
	logger, ok := ctx.Value(loggerCtxKey{}).(Logger)
	if !ok {
		return &NoopLogger{}
	}

	return logger
}
