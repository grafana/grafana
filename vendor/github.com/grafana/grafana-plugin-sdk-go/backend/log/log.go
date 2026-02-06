// Package log provides a logging interface to send logs from plugins to Grafana server.
package log

import (
	"context"

	hclog "github.com/hashicorp/go-hclog"
)

type Level int32

const (
	NoLevel Level = iota
	Trace
	Debug
	Info
	Warn
	Error
)

// Logger is the main Logger interface.
type Logger interface {
	Debug(msg string, args ...interface{})
	Info(msg string, args ...interface{})
	Warn(msg string, args ...interface{})
	Error(msg string, args ...interface{})
	With(args ...interface{}) Logger
	Level() Level
	FromContext(ctx context.Context) Logger
}

// New creates a new logger.
func New() Logger {
	return NewWithLevel(Debug)
}

// NewWithLevel creates a new logger at the Level defined.
func NewWithLevel(level Level) Logger {
	return &hclogWrapper{
		logger: hclog.New(&hclog.LoggerOptions{
			// Use debug as level since anything less severe is suppressed.
			Level: hclog.Level(level),
			// Use JSON format to make the output in Grafana format and work
			// when using multiple arguments such as Debug("message", "key", "value").
			JSONFormat: true,
		}),
	}
}

// NewNullLogger returns a logger that does nothing, for testing purposes
func NewNullLogger() Logger {
	return &hclogWrapper{
		logger: hclog.NewNullLogger(),
	}
}

type hclogWrapper struct {
	logger hclog.Logger
}

func (l *hclogWrapper) Debug(msg string, args ...interface{}) {
	l.logger.Debug(msg, args...)
}

func (l *hclogWrapper) Info(msg string, args ...interface{}) {
	l.logger.Info(msg, args...)
}

func (l *hclogWrapper) Warn(msg string, args ...interface{}) {
	l.logger.Warn(msg, args...)
}

func (l *hclogWrapper) Error(msg string, args ...interface{}) {
	l.logger.Error(msg, args...)
}

func (l *hclogWrapper) Level() Level {
	if l.logger.IsDebug() {
		return Debug
	}
	if l.logger.IsTrace() {
		return Trace
	}
	if l.logger.IsInfo() {
		return Info
	}
	if l.logger.IsWarn() {
		return Warn
	}
	if l.logger.IsError() {
		return Error
	}
	return NoLevel
}

// With creates a sub-logger that will always have the given key/value pairs.
func (l *hclogWrapper) With(args ...interface{}) Logger {
	return &hclogWrapper{
		logger: l.logger.With(args...),
	}
}

// FromContext creates a sub-logger with the contextual log parameters from the given context.
// The contextual log parameters can be set using [WithContextualAttributes].
func (l *hclogWrapper) FromContext(ctx context.Context) Logger {
	return l.With(ContextualAttributesFromContext(ctx)...)
}

// DefaultLogger is the default logger.
var DefaultLogger = New()
