// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package stdoutmetric // import "go.opentelemetry.io/otel/exporters/stdout/stdoutmetric"

import (
	"errors"
)

// Encoder encodes and outputs OpenTelemetry metric data-types as human
// readable text.
type Encoder interface {
	// Encode handles the encoding and writing of OpenTelemetry metric data.
	Encode(v any) error
}

// encoderHolder is the concrete type used to wrap an Encoder so it can be
// used as a atomic.Value type.
type encoderHolder struct {
	encoder Encoder
}

func (e encoderHolder) Encode(v any) error { return e.encoder.Encode(v) }

// shutdownEncoder is used when the exporter is shutdown. It always returns
// errShutdown when Encode is called.
type shutdownEncoder struct{}

var errShutdown = errors.New("exporter shutdown")

func (shutdownEncoder) Encode(any) error { return errShutdown }
