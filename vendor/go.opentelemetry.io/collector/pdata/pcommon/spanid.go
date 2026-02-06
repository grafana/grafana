// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pcommon // import "go.opentelemetry.io/collector/pdata/pcommon"
import (
	"encoding/hex"

	"go.opentelemetry.io/collector/pdata/internal/data"
)

var emptySpanID = SpanID([8]byte{})

// SpanID is span identifier.
type SpanID [8]byte

// NewSpanIDEmpty returns a new empty (all zero bytes) SpanID.
func NewSpanIDEmpty() SpanID {
	return emptySpanID
}

// String returns string representation of the SpanID.
//
// Important: Don't rely on this method to get a string identifier of SpanID,
// Use hex.EncodeToString explicitly instead.
// This method meant to implement Stringer interface for display purposes only.
func (ms SpanID) String() string {
	if ms.IsEmpty() {
		return ""
	}
	return hex.EncodeToString(ms[:])
}

// IsEmpty returns true if id doesn't contain at least one non-zero byte.
func (ms SpanID) IsEmpty() bool {
	return data.SpanID(ms).IsEmpty()
}
