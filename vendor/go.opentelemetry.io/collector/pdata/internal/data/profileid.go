// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package data // import "go.opentelemetry.io/collector/pdata/internal/data"

import (
	"errors"

	"github.com/gogo/protobuf/proto"
)

const profileIDSize = 16

var (
	errMarshalProfileID   = errors.New("marshal: invalid buffer length for ProfileID")
	errUnmarshalProfileID = errors.New("unmarshal: invalid ProfileID length")
)

// ProfileID is a custom data type that is used for all profile_id fields in OTLP
// Protobuf messages.
type ProfileID [profileIDSize]byte

var _ proto.Sizer = (*SpanID)(nil)

// Size returns the size of the data to serialize.
func (tid ProfileID) Size() int {
	if tid.IsEmpty() {
		return 0
	}
	return profileIDSize
}

// IsEmpty returns true if id contains at leas one non-zero byte.
func (tid ProfileID) IsEmpty() bool {
	return tid == [profileIDSize]byte{}
}

// MarshalTo converts profile ID into a binary representation. Called by Protobuf serialization.
func (tid ProfileID) MarshalTo(data []byte) (n int, err error) {
	if tid.IsEmpty() {
		return 0, nil
	}

	if len(data) < profileIDSize {
		return 0, errMarshalProfileID
	}

	return copy(data, tid[:]), nil
}

// Unmarshal inflates this profile ID from binary representation. Called by Protobuf serialization.
func (tid *ProfileID) Unmarshal(data []byte) error {
	if len(data) == 0 {
		*tid = [profileIDSize]byte{}
		return nil
	}

	if len(data) != profileIDSize {
		return errUnmarshalProfileID
	}

	copy(tid[:], data)
	return nil
}

// MarshalJSON converts profile id into a hex string enclosed in quotes.
func (tid ProfileID) MarshalJSON() ([]byte, error) {
	if tid.IsEmpty() {
		return []byte(`""`), nil
	}
	return marshalJSON(tid[:])
}

// UnmarshalJSON inflates profile id from hex string, possibly enclosed in quotes.
// Called by Protobuf JSON deserialization.
func (tid *ProfileID) UnmarshalJSON(data []byte) error {
	*tid = [profileIDSize]byte{}
	return unmarshalJSON(tid[:], data)
}
