package middleware

import (
	"context"

	"github.com/aws/smithy-go/logging"
)

// loggerKey is the context value key for which the logger is associated with.
type loggerKey struct{}

// GetLogger takes a context to retrieve a Logger from. If no logger is present on the context a logging.Nop logger
// is returned. If the logger retrieved from context supports the ContextLogger interface, the context will be passed
// to the WithContext method and the resulting logger will be returned. Otherwise the stored logger is returned as is.
func GetLogger(ctx context.Context) logging.Logger {
	logger, ok := ctx.Value(loggerKey{}).(logging.Logger)
	if !ok || logger == nil {
		return logging.Nop{}
	}

	return logging.WithContext(ctx, logger)
}

// SetLogger sets the provided logger value on the provided ctx.
func SetLogger(ctx context.Context, logger logging.Logger) context.Context {
	return context.WithValue(ctx, loggerKey{}, logger)
}

type setLogger struct {
	Logger logging.Logger
}

// AddSetLoggerMiddleware adds a middleware that will add the provided logger to the middleware context.
func AddSetLoggerMiddleware(stack *Stack, logger logging.Logger) error {
	return stack.Initialize.Add(&setLogger{Logger: logger}, After)
}

func (a *setLogger) ID() string {
	return "SetLogger"
}

func (a *setLogger) HandleInitialize(ctx context.Context, in InitializeInput, next InitializeHandler) (
	out InitializeOutput, metadata Metadata, err error,
) {
	return next.HandleInitialize(SetLogger(ctx, a.Logger), in)
}
