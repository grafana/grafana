// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Package noop provides an implementation of the [OpenTelemetry Logs Bridge
// API] that produces no telemetry and minimizes used computation resources.
//
// Using this package to implement the [OpenTelemetry Logs API] will
// effectively disable OpenTelemetry.
//
// This implementation can be embedded in other implementations of the
// [OpenTelemetry Logs API]. Doing so will mean the implementation
// defaults to no operation for methods it does not implement.
//
// [OpenTelemetry Logs API]: https://pkg.go.dev/go.opentelemetry.io/otel/log
package noop // import "go.opentelemetry.io/otel/log/noop"

import (
	"context"

	"go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/log/embedded"
)

var (
	// Compile-time check this implements the OpenTelemetry API.
	_ log.LoggerProvider = LoggerProvider{}
	_ log.Logger         = Logger{}
)

// LoggerProvider is an OpenTelemetry No-Op LoggerProvider.
type LoggerProvider struct{ embedded.LoggerProvider }

// NewLoggerProvider returns a LoggerProvider that does not record any telemetry.
func NewLoggerProvider() LoggerProvider {
	return LoggerProvider{}
}

// Logger returns an OpenTelemetry Logger that does not record any telemetry.
func (LoggerProvider) Logger(string, ...log.LoggerOption) log.Logger {
	return Logger{}
}

// Logger is an OpenTelemetry No-Op Logger.
type Logger struct{ embedded.Logger }

// Emit does nothing.
func (Logger) Emit(context.Context, log.Record) {}

// Enabled returns false. No log records are ever emitted.
func (Logger) Enabled(context.Context, log.EnabledParameters) bool { return false }
