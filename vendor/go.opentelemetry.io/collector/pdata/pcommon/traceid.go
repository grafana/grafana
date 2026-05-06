// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pcommon // import "go.opentelemetry.io/collector/pdata/pcommon"

import (
	"encoding/hex"

	"go.opentelemetry.io/collector/pdata/internal/data"
)

var emptyTraceID = TraceID([16]byte{})

// TraceID is a trace identifier.
type TraceID [16]byte

// NewTraceIDEmpty returns a new empty (all zero bytes) TraceID.
func NewTraceIDEmpty() TraceID {
	return emptyTraceID
}

// String returns string representation of the TraceID.
//
// Important: Don't rely on this method to get a string identifier of TraceID.
// Use hex.EncodeToString explicitly instead.
// This method meant to implement Stringer interface for display purposes only.
func (ms TraceID) String() string {
	if ms.IsEmpty() {
		return ""
	}
	return hex.EncodeToString(ms[:])
}

// IsEmpty returns true if id doesn't contain at least one non-zero byte.
func (ms TraceID) IsEmpty() bool {
	return data.TraceID(ms).IsEmpty()
}
