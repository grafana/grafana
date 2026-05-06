// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package data // import "go.opentelemetry.io/collector/pdata/internal/data"

import (
	"errors"

	"github.com/gogo/protobuf/proto"
)

const traceIDSize = 16

var (
	errMarshalTraceID   = errors.New("marshal: invalid buffer length for TraceID")
	errUnmarshalTraceID = errors.New("unmarshal: invalid TraceID length")
)

// TraceID is a custom data type that is used for all trace_id fields in OTLP
// Protobuf messages.
type TraceID [traceIDSize]byte

var _ proto.Sizer = (*SpanID)(nil)

// Size returns the size of the data to serialize.
func (tid TraceID) Size() int {
	if tid.IsEmpty() {
		return 0
	}
	return traceIDSize
}

// IsEmpty returns true if id contains at leas one non-zero byte.
func (tid TraceID) IsEmpty() bool {
	return tid == [traceIDSize]byte{}
}

// MarshalTo converts trace ID into a binary representation. Called by Protobuf serialization.
func (tid TraceID) MarshalTo(data []byte) (n int, err error) {
	if tid.IsEmpty() {
		return 0, nil
	}

	if len(data) < traceIDSize {
		return 0, errMarshalTraceID
	}

	return copy(data, tid[:]), nil
}

// Unmarshal inflates this trace ID from binary representation. Called by Protobuf serialization.
func (tid *TraceID) Unmarshal(data []byte) error {
	if len(data) == 0 {
		*tid = [traceIDSize]byte{}
		return nil
	}

	if len(data) != traceIDSize {
		return errUnmarshalTraceID
	}

	copy(tid[:], data)
	return nil
}

// MarshalJSON converts trace id into a hex string enclosed in quotes.
func (tid TraceID) MarshalJSON() ([]byte, error) {
	if tid.IsEmpty() {
		return []byte(`""`), nil
	}
	return marshalJSON(tid[:])
}

// UnmarshalJSON inflates trace id from hex string, possibly enclosed in quotes.
// Called by Protobuf JSON deserialization.
func (tid *TraceID) UnmarshalJSON(data []byte) error {
	*tid = [traceIDSize]byte{}
	return unmarshalJSON(tid[:], data)
}
