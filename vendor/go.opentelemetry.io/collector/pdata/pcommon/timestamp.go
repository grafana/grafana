// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pcommon // import "go.opentelemetry.io/collector/pdata/pcommon"

import (
	"time"
)

// Timestamp is a time specified as UNIX Epoch time in nanoseconds since
// 1970-01-01 00:00:00 +0000 UTC.
type Timestamp uint64

// NewTimestampFromTime constructs a new Timestamp from the provided time.Time.
func NewTimestampFromTime(t time.Time) Timestamp {
	//nolint:gosec
	return Timestamp(uint64(t.UnixNano()))
}

// AsTime converts this to a time.Time.
func (ts Timestamp) AsTime() time.Time {
	//nolint:gosec
	return time.Unix(0, int64(ts)).UTC()
}

// String returns the string representation of this in UTC.
func (ts Timestamp) String() string {
	return ts.AsTime().String()
}
