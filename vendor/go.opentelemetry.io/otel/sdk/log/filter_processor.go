// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package log // import "go.opentelemetry.io/otel/sdk/log"

import (
	"context"

	"go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/sdk/instrumentation"
)

// FilterProcessor is a [Processor] that knows, and can identify, what [Record]
// it will process or drop when it is passed to [Processor.OnEmit].
//
// This is useful for users that want to know if a [log.Record]
// will be processed or dropped before they perform complex operations to
// construct the [log.Record].
//
// The SDK's Logger.Enabled returns false
// if all the registered Processors implement FilterProcessor
// and they all return false.
//
// Processor implementations that choose to support this by satisfying this
// interface are expected to re-evaluate the [Record] passed to [Processor.OnEmit],
// it is not expected that the caller to OnEmit will use the functionality
// from this interface prior to calling OnEmit.
//
// See the [go.opentelemetry.io/contrib/processors/minsev] for an example use-case.
// It provides a Processor used to filter out [Record]
// that has a [log.Severity] below a threshold.
type FilterProcessor interface {
	// Enabled returns whether the Processor will process for the given context
	// and param.
	//
	// The passed param is likely to be a partial record information being
	// provided (e.g a param with only the Severity set).
	// If a Processor needs more information than is provided, it
	// is said to be in an indeterminate state (see below).
	//
	// The returned value will be true when the Processor will process for the
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

// EnabledParameters represents payload for [FilterProcessor]'s Enabled method.
type EnabledParameters struct {
	InstrumentationScope instrumentation.Scope
	Severity             log.Severity
}
