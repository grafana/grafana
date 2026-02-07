package ctxzap

import (
	"context"

	"github.com/grpc-ecosystem/go-grpc-middleware/tags"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type ctxMarker struct{}

type ctxLogger struct {
	logger *zap.Logger
	fields []zapcore.Field
}

var (
	ctxMarkerKey = &ctxMarker{}
	nullLogger   = zap.NewNop()
)

// AddFields adds zap fields to the logger.
func AddFields(ctx context.Context, fields ...zapcore.Field) {
	l, ok := ctx.Value(ctxMarkerKey).(*ctxLogger)
	if !ok || l == nil {
		return
	}
	l.fields = append(l.fields, fields...)
}

// Extract takes the call-scoped Logger from grpc_zap middleware.
//
// It always returns a Logger that has all the grpc_ctxtags updated.
func Extract(ctx context.Context) *zap.Logger {
	l, ok := ctx.Value(ctxMarkerKey).(*ctxLogger)
	if !ok || l == nil {
		return nullLogger
	}
	// Add grpc_ctxtags tags metadata until now.
	fields := TagsToFields(ctx)
	// Add zap fields added until now.
	fields = append(fields, l.fields...)
	return l.logger.With(fields...)
}

// TagsToFields transforms the Tags on the supplied context into zap fields.
func TagsToFields(ctx context.Context) []zapcore.Field {
	fields := []zapcore.Field{}
	tags := grpc_ctxtags.Extract(ctx)
	for k, v := range tags.Values() {
		fields = append(fields, zap.Any(k, v))
	}
	return fields
}

// ToContext adds the zap.Logger to the context for extraction later.
// Returning the new context that has been created.
func ToContext(ctx context.Context, logger *zap.Logger) context.Context {
	l := &ctxLogger{
		logger: logger,
	}
	return context.WithValue(ctx, ctxMarkerKey, l)
}

// Debug is equivalent to calling Debug on the zap.Logger in the context.
// It is a no-op if the context does not contain a zap.Logger.
func Debug(ctx context.Context, msg string, fields ...zap.Field) {
	Extract(ctx).WithOptions(zap.AddCallerSkip(1)).Debug(msg, fields...)
}

// Info is equivalent to calling Info on the zap.Logger in the context.
// It is a no-op if the context does not contain a zap.Logger.
func Info(ctx context.Context, msg string, fields ...zap.Field) {
	Extract(ctx).WithOptions(zap.AddCallerSkip(1)).Info(msg, fields...)
}

// Warn is equivalent to calling Warn on the zap.Logger in the context.
// It is a no-op if the context does not contain a zap.Logger.
func Warn(ctx context.Context, msg string, fields ...zap.Field) {
	Extract(ctx).WithOptions(zap.AddCallerSkip(1)).Warn(msg, fields...)
}

// Error is equivalent to calling Error on the zap.Logger in the context.
// It is a no-op if the context does not contain a zap.Logger.
func Error(ctx context.Context, msg string, fields ...zap.Field) {
	Extract(ctx).WithOptions(zap.AddCallerSkip(1)).Error(msg, fields...)
}
