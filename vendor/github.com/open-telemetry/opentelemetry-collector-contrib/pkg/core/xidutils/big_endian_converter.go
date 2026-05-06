// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package xidutils // import "github.com/open-telemetry/opentelemetry-collector-contrib/pkg/core/xidutils"

import (
	"encoding/binary"

	"go.opentelemetry.io/collector/pdata/pcommon"
)

// UInt64ToTraceID converts the pair of uint64 representation of a TraceID to pcommon.TraceID.
func UInt64ToTraceID(high, low uint64) pcommon.TraceID {
	traceID := [16]byte{}
	binary.BigEndian.PutUint64(traceID[:8], high)
	binary.BigEndian.PutUint64(traceID[8:], low)
	return traceID
}

// TraceIDToUInt64Pair converts the pcommon.TraceID to a pair of uint64 representation.
func TraceIDToUInt64Pair(traceID pcommon.TraceID) (uint64, uint64) {
	return binary.BigEndian.Uint64(traceID[:8]), binary.BigEndian.Uint64(traceID[8:])
}

// UInt64ToSpanID converts the uint64 representation of a SpanID to pcommon.SpanID.
func UInt64ToSpanID(id uint64) pcommon.SpanID {
	spanID := [8]byte{}
	binary.BigEndian.PutUint64(spanID[:], id)
	return pcommon.SpanID(spanID)
}

// SpanIDToUInt64 converts the pcommon.SpanID to uint64 representation.
func SpanIDToUInt64(spanID pcommon.SpanID) uint64 {
	return binary.BigEndian.Uint64(spanID[:])
}
