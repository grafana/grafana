// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package data // import "go.opentelemetry.io/collector/pdata/internal/data"

import (
	"encoding/hex"
	"errors"

	"github.com/gogo/protobuf/proto"

	"go.opentelemetry.io/collector/pdata/internal/json"
)

const spanIDSize = 8

var (
	errMarshalSpanID   = errors.New("marshal: invalid buffer length for SpanID")
	errUnmarshalSpanID = errors.New("unmarshal: invalid SpanID length")
)

// SpanID is a custom data type that is used for all span_id fields in OTLP
// Protobuf messages.
type SpanID [spanIDSize]byte

var _ proto.Sizer = (*SpanID)(nil)

// Size returns the size of the data to serialize.
func (sid SpanID) Size() int {
	if sid.IsEmpty() {
		return 0
	}
	return spanIDSize
}

// IsEmpty returns true if id contains at least one non-zero byte.
func (sid SpanID) IsEmpty() bool {
	return sid == [spanIDSize]byte{}
}

// MarshalTo converts trace ID into a binary representation. Called by Protobuf serialization.
func (sid SpanID) MarshalTo(data []byte) (n int, err error) {
	if sid.IsEmpty() {
		return 0, nil
	}

	if len(data) < spanIDSize {
		return 0, errMarshalSpanID
	}

	return copy(data, sid[:]), nil
}

// Unmarshal inflates this trace ID from binary representation. Called by Protobuf serialization.
func (sid *SpanID) Unmarshal(data []byte) error {
	if len(data) == 0 {
		*sid = [spanIDSize]byte{}
		return nil
	}

	if len(data) != spanIDSize {
		return errUnmarshalSpanID
	}

	copy(sid[:], data)
	return nil
}

// MarshalJSONStream converts SpanID into a hex string.
func (sid SpanID) MarshalJSONStream(dest *json.Stream) {
	dest.WriteString(hex.EncodeToString(sid[:]))
}

// UnmarshalJSONIter decodes SpanID from hex string.
func (sid *SpanID) UnmarshalJSONIter(iter *json.Iterator) {
	*sid = [spanIDSize]byte{}
	unmarshalJSON(sid[:], iter)
}
