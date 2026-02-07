package telemetry

import (
	"context"
	"errors"
	"io"
	"time"

	"go.opentelemetry.io/otel/log"
	sdklog "go.opentelemetry.io/otel/sdk/log"
)

type loggerProviderKey struct{}

// WithLoggerProvider returns a new context with the given LoggerProvider.
func WithLoggerProvider(ctx context.Context, provider *sdklog.LoggerProvider) context.Context {
	return context.WithValue(ctx, loggerProviderKey{}, provider)
}

// LoggerProvider returns the LoggerProvider from the context.
func LoggerProvider(ctx context.Context) *sdklog.LoggerProvider {
	loggerProvider := sdklog.NewLoggerProvider()
	if val := ctx.Value(loggerProviderKey{}); val != nil {
		loggerProvider = val.(*sdklog.LoggerProvider)
	}
	return loggerProvider
}

// Logger returns a logger with the given name.
func Logger(ctx context.Context, name string) log.Logger {
	return LoggerProvider(ctx).Logger(name) // TODO more instrumentation attrs
}

// SpanStdio returns a pair of io.WriteClosers which will send log records with
// stdio.stream=1 for stdout and stdio.stream=2 for stderr. Closing either of
// them will send a log record for that stream with an empty body and
// stdio.eof=true.
//
// SpanStdio should be used when a span represents a process that writes to
// stdout/stderr and terminates them with an EOF, to confirm that all data has
// been received. It should not be used for general-purpose logging.
//
// Both streams must be closed to ensure that draining completes.
func SpanStdio(ctx context.Context, name string, attrs ...log.KeyValue) SpanStreams {
	logger := Logger(ctx, name)
	return SpanStreams{
		Stdout: &spanStream{
			Writer: &Writer{
				ctx:    ctx,
				logger: logger,
				attrs:  append([]log.KeyValue{log.Int(StdioStreamAttr, 1)}, attrs...),
			},
		},
		Stderr: &spanStream{
			Writer: &Writer{
				ctx:    ctx,
				logger: logger,
				attrs:  append([]log.KeyValue{log.Int(StdioStreamAttr, 2)}, attrs...),
			},
		},
	}
}

// Writer is an io.Writer that emits log records.
type Writer struct {
	ctx    context.Context
	logger log.Logger
	attrs  []log.KeyValue
}

// NewWriter returns a new Writer that emits log records with the given logger
// name and attributes.
func NewWriter(ctx context.Context, name string, attrs ...log.KeyValue) io.Writer {
	return &Writer{
		ctx:    ctx,
		logger: Logger(ctx, name),
		attrs:  attrs,
	}
}

// Write emits a log record with the given payload as a string body.
func (w *Writer) Write(p []byte) (int, error) {
	w.Emit(log.StringValue(string(p)))
	return len(p), nil
}

// Emit sends a log record with the given body and additional attributes.
func (w *Writer) Emit(body log.Value, attrs ...log.KeyValue) {
	rec := log.Record{}
	rec.SetTimestamp(time.Now())
	rec.SetBody(body)
	rec.AddAttributes(w.attrs...)
	rec.AddAttributes(attrs...)
	w.logger.Emit(w.ctx, rec)
}

// SpanStreams contains the stdout and stderr for a span.
type SpanStreams struct {
	Stdout io.WriteCloser
	Stderr io.WriteCloser
}

// Calling Close closes both streams.
func (sl SpanStreams) Close() error {
	return errors.Join(
		sl.Stdout.Close(),
		sl.Stderr.Close(),
	)
}

type spanStream struct {
	*Writer
}

// Close emits an EOF log record.
func (w *spanStream) Close() error {
	w.Writer.Emit(log.StringValue(""), log.Bool(StdioEOFAttr, true))
	return nil
}
