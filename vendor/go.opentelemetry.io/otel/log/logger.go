// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package log // import "go.opentelemetry.io/otel/log"

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/log/embedded"
)

// Logger emits log records.
//
// Warning: Methods may be added to this interface in minor releases. See
// package documentation on API implementation for information on how to set
// default behavior for unimplemented methods.
type Logger interface {
	// Users of the interface can ignore this. This embedded type is only used
	// by implementations of this interface. See the "API Implementations"
	// section of the package documentation for more information.
	embedded.Logger

	// Emit emits a log record.
	//
	// The record may be held by the implementation. Callers should not mutate
	// the record after passed.
	//
	// Implementations of this method need to be safe for a user to call
	// concurrently.
	Emit(ctx context.Context, record Record)

	// Enabled returns whether the Logger emits for the given context and
	// param.
	//
	// This is useful for users that want to know if a [Record]
	// will be processed or dropped before they perform complex operations to
	// construct the [Record].
	//
	// The passed param is likely to be a partial record information being
	// provided (e.g a param with only the Severity set).
	// If a Logger needs more information than is provided, it
	// is said to be in an indeterminate state (see below).
	//
	// The returned value will be true when the Logger will emit for the
	// provided context and param, and will be false if the Logger will not
	// emit. The returned value may be true or false in an indeterminate state.
	// An implementation should default to returning true for an indeterminate
	// state, but may return false if valid reasons in particular circumstances
	// exist (e.g. performance, correctness).
	//
	// The param should not be held by the implementation. A copy should be
	// made if the param needs to be held after the call returns.
	//
	// Implementations of this method need to be safe for a user to call
	// concurrently.
	Enabled(ctx context.Context, param EnabledParameters) bool
}

// LoggerOption applies configuration options to a [Logger].
type LoggerOption interface {
	// applyLogger is used to set a LoggerOption value of a LoggerConfig.
	applyLogger(LoggerConfig) LoggerConfig
}

// LoggerConfig contains options for a [Logger].
type LoggerConfig struct {
	// Ensure forward compatibility by explicitly making this not comparable.
	noCmp [0]func() //nolint: unused  // This is indeed used.

	version   string
	schemaURL string
	attrs     attribute.Set
}

// NewLoggerConfig returns a new [LoggerConfig] with all the options applied.
func NewLoggerConfig(options ...LoggerOption) LoggerConfig {
	var c LoggerConfig
	for _, opt := range options {
		c = opt.applyLogger(c)
	}
	return c
}

// InstrumentationVersion returns the version of the library providing
// instrumentation.
func (cfg LoggerConfig) InstrumentationVersion() string {
	return cfg.version
}

// InstrumentationAttributes returns the attributes associated with the library
// providing instrumentation.
func (cfg LoggerConfig) InstrumentationAttributes() attribute.Set {
	return cfg.attrs
}

// SchemaURL returns the schema URL of the library providing instrumentation.
func (cfg LoggerConfig) SchemaURL() string {
	return cfg.schemaURL
}

type loggerOptionFunc func(LoggerConfig) LoggerConfig

func (fn loggerOptionFunc) applyLogger(cfg LoggerConfig) LoggerConfig {
	return fn(cfg)
}

// WithInstrumentationVersion returns a [LoggerOption] that sets the
// instrumentation version of a [Logger].
func WithInstrumentationVersion(version string) LoggerOption {
	return loggerOptionFunc(func(config LoggerConfig) LoggerConfig {
		config.version = version
		return config
	})
}

// WithInstrumentationAttributes returns a [LoggerOption] that sets the
// instrumentation attributes of a [Logger].
//
// The passed attributes will be de-duplicated.
func WithInstrumentationAttributes(attr ...attribute.KeyValue) LoggerOption {
	return loggerOptionFunc(func(config LoggerConfig) LoggerConfig {
		config.attrs = attribute.NewSet(attr...)
		return config
	})
}

// WithSchemaURL returns a [LoggerOption] that sets the schema URL for a
// [Logger].
func WithSchemaURL(schemaURL string) LoggerOption {
	return loggerOptionFunc(func(config LoggerConfig) LoggerConfig {
		config.schemaURL = schemaURL
		return config
	})
}

// EnabledParameters represents payload for [Logger]'s Enabled method.
type EnabledParameters struct {
	Severity Severity
}
