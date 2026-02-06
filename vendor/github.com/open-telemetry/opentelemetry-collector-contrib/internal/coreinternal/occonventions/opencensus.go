// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package occonventions // import "github.com/open-telemetry/opentelemetry-collector-contrib/internal/coreinternal/occonventions"

// OTLP attributes to map certain OpenCensus proto fields. These fields don't have
// corresponding fields in OTLP, nor are defined in OTLP semantic conventions.
const (
	AttributeProcessStartTime        = "opencensus.starttime"
	AttributeExporterVersion         = "opencensus.exporterversion"
	AttributeResourceType            = "opencensus.resourcetype"
	AttributeSameProcessAsParentSpan = "opencensus.same_process_as_parent_span"
)
