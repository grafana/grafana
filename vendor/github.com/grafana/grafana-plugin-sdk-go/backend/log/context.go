package log

import "context"

type loggerParamsCtxKeyType struct{}

var loggerParamsCtxKey = loggerParamsCtxKeyType{}

// WithContextualAttributes returns a new context with the given key/value log parameters appended to the existing ones.
// It's possible to get a logger with those contextual parameters by using [FromContext].
func WithContextualAttributes(ctx context.Context, logParams []any) context.Context {
	p := logParams
	if ctxParams := ctx.Value(loggerParamsCtxKey); ctxParams != nil {
		p = append(ctxParams.([]any), logParams...)
	}
	return context.WithValue(ctx, loggerParamsCtxKey, p)
}

// ContextualAttributesFromContext returns the contextual key/value log parameters from the given context.
// If no contextual log parameters are set, it returns nil.
func ContextualAttributesFromContext(ctx context.Context) []any {
	if logParams := ctx.Value(loggerParamsCtxKey); logParams != nil {
		return logParams.([]any)
	}
	return nil
}
