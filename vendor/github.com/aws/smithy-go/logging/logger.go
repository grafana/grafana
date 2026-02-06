package logging

import (
	"context"
	"io"
	"log"
)

// Classification is the type of the log entry's classification name.
type Classification string

// Set of standard classifications that can be used by clients and middleware
const (
	Warn  Classification = "WARN"
	Debug Classification = "DEBUG"
)

// Logger is an interface for logging entries at certain classifications.
type Logger interface {
	// Logf is expected to support the standard fmt package "verbs".
	Logf(classification Classification, format string, v ...interface{})
}

// LoggerFunc is a wrapper around a function to satisfy the Logger interface.
type LoggerFunc func(classification Classification, format string, v ...interface{})

// Logf delegates the logging request to the wrapped function.
func (f LoggerFunc) Logf(classification Classification, format string, v ...interface{}) {
	f(classification, format, v...)
}

// ContextLogger is an optional interface a Logger implementation may expose that provides
// the ability to create context aware log entries.
type ContextLogger interface {
	WithContext(context.Context) Logger
}

// WithContext will pass the provided context to logger if it implements the ContextLogger interface and return the resulting
// logger. Otherwise the logger will be returned as is. As a special case if a nil logger is provided, a Nop logger will
// be returned to the caller.
func WithContext(ctx context.Context, logger Logger) Logger {
	if logger == nil {
		return Nop{}
	}

	cl, ok := logger.(ContextLogger)
	if !ok {
		return logger
	}

	return cl.WithContext(ctx)
}

// Nop is a Logger implementation that simply does not perform any logging.
type Nop struct{}

// Logf simply returns without performing any action
func (n Nop) Logf(Classification, string, ...interface{}) {
	return
}

// StandardLogger is a Logger implementation that wraps the standard library logger, and delegates logging to it's
// Printf method.
type StandardLogger struct {
	Logger *log.Logger
}

// Logf logs the given classification and message to the underlying logger.
func (s StandardLogger) Logf(classification Classification, format string, v ...interface{}) {
	if len(classification) != 0 {
		format = string(classification) + " " + format
	}

	s.Logger.Printf(format, v...)
}

// NewStandardLogger returns a new StandardLogger
func NewStandardLogger(writer io.Writer) *StandardLogger {
	return &StandardLogger{
		Logger: log.New(writer, "SDK ", log.LstdFlags),
	}
}
