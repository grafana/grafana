// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlp // import "go.opentelemetry.io/collector/pdata/internal/otlp"

import (
	otlplogs "go.opentelemetry.io/collector/pdata/internal/data/protogen/logs/v1"
)

// MigrateLogs implements any translation needed due to deprecation in OTLP logs protocol.
// Any plog.Unmarshaler implementation from OTLP (proto/json) MUST call this, and the gRPC Server implementation.
func MigrateLogs(rls []*otlplogs.ResourceLogs) {
	for _, rl := range rls {
		if len(rl.ScopeLogs) == 0 {
			rl.ScopeLogs = rl.DeprecatedScopeLogs
		}
		rl.DeprecatedScopeLogs = nil
	}
}
