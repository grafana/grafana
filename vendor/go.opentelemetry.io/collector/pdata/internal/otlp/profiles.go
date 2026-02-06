// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlp // import "go.opentelemetry.io/collector/pdata/internal/otlp"

import (
	otlpprofiles "go.opentelemetry.io/collector/pdata/internal/data/protogen/profiles/v1development"
)

// MigrateProfiles implements any translation needed due to deprecation in OTLP profiles protocol.
// Any pprofile.Unmarshaler implementation from OTLP (proto/json) MUST call this, and the gRPC Server implementation.
func MigrateProfiles(_ []*otlpprofiles.ResourceProfiles) {}
