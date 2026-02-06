// Provenance-includes-location: https://github.com/go-kit/log/blob/main/value.go
// Provenance-includes-license: MIT
// Provenance-includes-copyright: Go kit

package spanlogger

import (
	"context"
	"fmt"
	"math"
	"runtime"
	"slices"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.uber.org/atomic" // Really just need sync/atomic but there is a lint rule preventing it.

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	opentracing "github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	otlog "github.com/opentracing/opentracing-go/log"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/dskit/tracing"
)

type loggerCtxMarker struct{}

// TenantResolver provides methods for extracting tenant IDs from a context.
type TenantResolver interface {
	// TenantID tries to extract a tenant ID from a context.
	TenantID(context.Context) (string, error)
	// TenantIDs tries to extract tenant IDs from a context.
	TenantIDs(context.Context) ([]string, error)
}

const (
	// TenantIDsTagName is the tenant IDs tag name.
	TenantIDsTagName = "tenant_ids"
)

var (
	loggerCtxKey = &loggerCtxMarker{}
)

// SpanLogger unifies tracing and logging, to reduce repetition.
type SpanLogger struct {
	ctx        context.Context            // context passed in, with logger
	resolver   TenantResolver             // passed in
	baseLogger log.Logger                 // passed in
	logger     atomic.Pointer[log.Logger] // initialized on first use

	opentracingSpan opentracing.Span
	otelSpan        trace.Span

	sampled      bool
	debugEnabled bool
}

// New makes a new SpanLogger with a log.Logger to send logs to. The provided context will have the logger attached
// to it and can be retrieved with FromContext.
func New(ctx context.Context, logger log.Logger, method string, resolver TenantResolver, kvps ...interface{}) (*SpanLogger, context.Context) {
	span, ctx := opentracing.StartSpanFromContext(ctx, method)
	if ids, err := resolver.TenantIDs(ctx); err == nil && len(ids) > 0 {
		span.SetTag(TenantIDsTagName, ids)
	}
	_, sampled := tracing.ExtractSampledTraceID(ctx)
	l := &SpanLogger{
		ctx:        ctx,
		resolver:   resolver,
		baseLogger: log.With(logger, "method", method),

		opentracingSpan: span,
		otelSpan:        nil,

		sampled:      sampled,
		debugEnabled: debugEnabled(logger),
	}
	if len(kvps) > 0 {
		l.DebugLog(kvps...)
	}

	ctx = context.WithValue(ctx, loggerCtxKey, logger)
	return l, ctx
}

func NewOTel(ctx context.Context, logger log.Logger, tracer trace.Tracer, method string, resolver TenantResolver, kvps ...any) (*SpanLogger, context.Context) {
	ctx, span := tracer.Start(ctx, method)
	if ids, err := resolver.TenantIDs(ctx); err == nil && len(ids) > 0 {
		span.SetAttributes(attribute.StringSlice(TenantIDsTagName, ids))
	}
	sampled := span.SpanContext().IsSampled()

	l := &SpanLogger{
		ctx:        ctx,
		resolver:   resolver,
		baseLogger: log.With(logger, "method", method),

		opentracingSpan: nil,
		otelSpan:        span,

		sampled:      sampled,
		debugEnabled: debugEnabled(logger),
	}
	if len(kvps) > 0 {
		l.DebugLog(kvps...)
	}

	ctx = context.WithValue(ctx, loggerCtxKey, logger)
	return l, ctx
}

// FromContext returns a span logger using the current parent span.
// If there is no parent span, the SpanLogger will only log to the logger
// within the context. If the context doesn't have a logger, the fallback
// logger is used.
func FromContext(ctx context.Context, fallback log.Logger, resolver TenantResolver) *SpanLogger {
	logger, ok := ctx.Value(loggerCtxKey).(log.Logger)
	if !ok {
		logger = fallback
	}
	otelSpan, opentracingSpan, sampled := tracing.SpanFromContext(ctx)

	return &SpanLogger{
		ctx:        ctx,
		baseLogger: logger,
		resolver:   resolver,

		otelSpan:        otelSpan,
		opentracingSpan: opentracingSpan,

		sampled:      sampled,
		debugEnabled: debugEnabled(logger),
	}
}

// Detect whether we should output debug logging.
// false iff the logger says it's not enabled; true if the logger doesn't say.
func debugEnabled(logger log.Logger) bool {
	if x, ok := logger.(interface{ DebugEnabled() bool }); ok && !x.DebugEnabled() {
		return false
	}
	return true
}

// Log implements gokit's Logger interface; sends logs to underlying logger and
// also puts the on the spans.
func (s *SpanLogger) Log(kvps ...interface{}) error {
	s.getLogger().Log(kvps...)
	return s.spanLog(kvps...)
}

// DebugLog is more efficient than level.Debug().Log().
// Also it swallows the error return because nobody checks for errors on debug logs.
func (s *SpanLogger) DebugLog(kvps ...interface{}) {
	if s.debugEnabled {
		// The call to Log() through an interface makes its argument escape, so make a copy here,
		// in the debug-only path, so the function is faster for the non-debug path.
		localCopy := append([]any{}, kvps...)
		level.Debug(s.getLogger()).Log(localCopy...)
	}
	_ = s.spanLog(kvps...)
}

func (s *SpanLogger) spanLog(kvps ...interface{}) error {
	if !s.sampled {
		return nil
	}

	if s.otelSpan != nil {
		// LogKV is more efficient with OTel.
		s.LogKV(kvps...)
		return nil
	}

	fields, err := otlog.InterleavedKVToFields(kvps...)
	if err != nil {
		return err
	}
	s.LogFields(fields...)
	return nil
}

// Error sets error flag and logs the error on the span, if non-nil. Returns the err passed in.
func (s *SpanLogger) Error(err error) error {
	if err == nil || !s.sampled {
		return err
	}
	s.SetError()
	if s.otelSpan != nil {
		s.otelSpan.RecordError(err)
	} else {
		s.LogFields(otlog.Error(err))
	}
	return err
}

func (s *SpanLogger) getLogger() log.Logger {
	pLogger := s.logger.Load()
	if pLogger != nil {
		return *pLogger
	}
	// If no logger stored in the pointer, start to make one.
	logger := s.baseLogger
	userID, err := s.resolver.TenantID(s.ctx)
	if err == nil && userID != "" {
		logger = log.With(logger, "user", userID)
	}

	traceID, ok := tracing.ExtractSampledTraceID(s.ctx)
	if ok {
		logger = log.With(logger, "trace_id", traceID)
	}

	// If the value has been set by another goroutine, fetch that other value and discard the one we made.
	if !s.logger.CompareAndSwap(nil, &logger) {
		pLogger := s.logger.Load()
		logger = *pLogger
	}
	return logger
}

// SetSpanAndLogTag sets a tag on the span used by this SpanLogger, and appends a key/value pair to the logger used for
// future log lines emitted by this SpanLogger.
//
// It is not safe to call this method from multiple goroutines simultaneously.
// It is safe to call this method at the same time as calling other SpanLogger methods, however, this may produce
// inconsistent results (eg. some log lines may be emitted with the provided key/value pair, and others may not).
func (s *SpanLogger) SetSpanAndLogTag(key string, value interface{}) {
	s.SetTag(key, value)

	logger := s.getLogger()
	wrappedLogger := log.With(logger, key, value)
	s.logger.Store(&wrappedLogger)
}

// SetError will set the error flag on the span.
func (s *SpanLogger) SetError() {
	if s.otelSpan != nil {
		s.otelSpan.SetStatus(codes.Error, "error")
		return
	}

	ext.Error.Set(s.opentracingSpan, true)
}

// SetTag will set a tag/attribute on the span.
func (s *SpanLogger) SetTag(key string, value interface{}) {
	if s.otelSpan != nil {
		s.otelSpan.SetAttributes(tracing.KeyValueToOTelAttribute(key, value))
		return
	}

	s.opentracingSpan.SetTag(key, value)
}

// Finish will finish the span.
func (s *SpanLogger) Finish() {
	if s.otelSpan != nil {
		s.otelSpan.End()
		return
	}
	s.opentracingSpan.Finish()
}

// LogFields will log the provided fields in the span, this is more performant that LogKV when using opentracing library.
func (s *SpanLogger) LogFields(kvps ...otlog.Field) {
	if !s.sampled {
		return
	}

	if s.otelSpan != nil {
		attrs := opentracingFieldsToAttributes(kvps...)
		s.otelSpan.AddEvent("log", trace.WithAttributes(attrs...))
		return
	}

	// Clone kvps to prevent it from escaping to heap even when it's not sampled.
	s.opentracingSpan.LogFields(slices.Clone(kvps)...)
}

// LogKV will log the provided key/value pairs in the span, this is less performant than LogFields when using opentracing library.
func (s *SpanLogger) LogKV(kvps ...interface{}) {
	if !s.sampled {
		return
	}

	if s.otelSpan != nil {
		attrs := otelAttributesFromKVs(kvps)
		s.otelSpan.AddEvent("log", trace.WithAttributes(attrs...))
		return
	}
	// Clone kvps to prevent it from escaping to heap even when it's not sampled.
	s.opentracingSpan.LogKV(slices.Clone(kvps)...)
}

// Caller is like github.com/go-kit/log's Caller, but ensures that the caller information is
// that of the caller to SpanLogger (if SpanLogger is being used), not SpanLogger itself.
//
// defaultStackDepth should be the number of stack frames to skip by default, as would be
// passed to github.com/go-kit/log's Caller method.
func Caller(defaultStackDepth int) log.Valuer {
	return func() interface{} {
		stackDepth := defaultStackDepth + 1 // +1 to account for this method.
		seenSpanLogger := false
		pc := make([]uintptr, 1)

		for {
			function, file, line, ok := caller(stackDepth, pc)
			if !ok {
				// We've run out of possible stack frames. Give up.
				return "<unknown>"
			}

			// If we're in a SpanLogger method, we need to continue searching.
			//
			// Matching on the exact function name like this does mean this will break if we rename or refactor SpanLogger, but
			// the tests should catch this. In the worst case scenario, we'll log incorrect caller information, which isn't the
			// end of the world.
			if function == "github.com/grafana/dskit/spanlogger.(*SpanLogger).Log" || function == "github.com/grafana/dskit/spanlogger.(*SpanLogger).DebugLog" {
				seenSpanLogger = true
				stackDepth++
				continue
			}

			// We need to check for go-kit/log stack frames like this because using log.With, log.WithPrefix or log.WithSuffix
			// (including the various level methods like level.Debug, level.Info etc.) to wrap a SpanLogger introduce an
			// additional context.Log stack frame that calls into the SpanLogger. This is because the use of SpanLogger
			// as the logger means the optimisation to avoid creating a new logger in
			// https://github.com/go-kit/log/blob/c7bf81493e581feca11e11a7672b14be3591ca43/log.go#L141-L146 used by those methods
			// can't be used, and so the SpanLogger is wrapped in a new logger.
			if seenSpanLogger && function == "github.com/go-kit/log.(*context).Log" {
				stackDepth++
				continue
			}

			return formatCallerInfoForLog(file, line)
		}
	}
}

// caller is like runtime.Caller, but modified to allow reuse of the uintptr slice and return the function name.
func caller(stackDepth int, pc []uintptr) (function string, file string, line int, ok bool) {
	n := runtime.Callers(stackDepth+1, pc)
	if n < 1 {
		return "", "", 0, false
	}

	frame, _ := runtime.CallersFrames(pc).Next()
	return frame.Function, frame.File, frame.Line, frame.PC != 0
}

// This is based on github.com/go-kit/log's Caller, but modified for use by Caller above.
func formatCallerInfoForLog(file string, line int) string {
	idx := strings.LastIndexByte(file, '/')
	return file[idx+1:] + ":" + strconv.Itoa(line)
}

func otelAttributesFromKVs(kvps []any) []attribute.KeyValue {
	attrs := make([]attribute.KeyValue, 0, len(kvps)/2)
	for i := 0; i < len(kvps); i += 2 {
		if i+1 < len(kvps) {
			key, ok := kvps[i].(string)
			if !ok {
				key = fmt.Sprintf("not_string_key:%v", kvps[i])
			}
			attrs = append(attrs, tracing.KeyValueToOTelAttribute(key, kvps[i+1]))
		}
	}
	return attrs
}

type opentracingFieldsToAttributesMarshaler []attribute.KeyValue

func (f *opentracingFieldsToAttributesMarshaler) EmitString(key, value string) {
	*f = append(*f, attribute.String(key, value))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitBool(key string, value bool) {
	*f = append(*f, attribute.Bool(key, value))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitInt(key string, value int) {
	*f = append(*f, attribute.Int(key, value))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitInt32(key string, value int32) {
	*f = append(*f, attribute.Int(key, int(value)))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitInt64(key string, value int64) {
	*f = append(*f, attribute.Int64(key, value))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitUint32(key string, value uint32) {
	*f = append(*f, attribute.Int(key, int(value)))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitUint64(key string, value uint64) {
	if value > math.MaxInt64 {
		// Append as string if it exceeds int64 range.
		*f = append(*f, attribute.String(key, strconv.FormatUint(value, 10)))
		return
	}
	*f = append(*f, attribute.Int64(key, int64(value)))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitFloat32(key string, value float32) {
	*f = append(*f, attribute.Float64(key, float64(value)))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitFloat64(key string, value float64) {
	*f = append(*f, attribute.Float64(key, value))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitObject(key string, value interface{}) {
	*f = append(*f, attribute.String(key, fmt.Sprintf("%v", value)))
}

func (f *opentracingFieldsToAttributesMarshaler) EmitLazyLogger(value otlog.LazyLogger) {
	value(f) // don't be lazy.
}

func opentracingFieldsToAttributes(kvps ...otlog.Field) []attribute.KeyValue {
	fields := make(opentracingFieldsToAttributesMarshaler, 0, len(kvps))
	for _, kvp := range kvps {
		kvp.Marshal(&fields)
	}
	return fields
}
