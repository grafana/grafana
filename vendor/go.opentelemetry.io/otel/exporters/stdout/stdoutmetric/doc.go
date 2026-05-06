// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Package stdoutmetric provides an exporter for OpenTelemetry metric
// telemetry.
//
// The exporter is intended to be used for testing and debugging, it is not
// meant for production use. Additionally, it does not provide an interchange
// format for OpenTelemetry that is supported with any stability or
// compatibility guarantees. If these are needed features, please use the OTLP
// exporter instead.
package stdoutmetric // import "go.opentelemetry.io/otel/exporters/stdout/stdoutmetric"
