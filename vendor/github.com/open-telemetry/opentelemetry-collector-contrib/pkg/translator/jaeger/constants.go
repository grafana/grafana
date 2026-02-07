// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package jaeger // import "github.com/open-telemetry/opentelemetry-collector-contrib/pkg/translator/jaeger"

import (
	"errors"
)

// Status tag values as defined by the OpenTelemetry specification:
// https://github.com/open-telemetry/opentelemetry-specification/blob/v1.8.0/specification/trace/sdk_exporters/non-otlp.md#span-status
const (
	statusError = "ERROR"
	statusOk    = "OK"
)

// eventNameAttr is a Jaeger log field key used to represent OTel Span Event Name as defined by the OpenTelemetry Specification:
// https://github.com/open-telemetry/opentelemetry-specification/blob/34b907207f3dfe1635a35c4cdac6b6ab3a495e18/specification/trace/sdk_exporters/jaeger.md#events
const eventNameAttr = "event"

// errType indicates that a value is not convertible to the target type.
var errType = errors.New("invalid type")
