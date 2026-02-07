// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlp // import "go.opentelemetry.io/collector/pdata/internal/otlp"

import (
	otlpmetrics "go.opentelemetry.io/collector/pdata/internal/data/protogen/metrics/v1"
)

// MigrateMetrics implements any translation needed due to deprecation in OTLP metrics protocol.
// Any pmetric.Unmarshaler implementation from OTLP (proto/json) MUST call this, and the gRPC Server implementation.
func MigrateMetrics(rms []*otlpmetrics.ResourceMetrics) {
	for _, rm := range rms {
		if len(rm.ScopeMetrics) == 0 {
			rm.ScopeMetrics = rm.DeprecatedScopeMetrics
		}
		rm.DeprecatedScopeMetrics = nil
	}
}
