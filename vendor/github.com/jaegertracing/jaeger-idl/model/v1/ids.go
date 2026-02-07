// Copyright (c) 2019 The Jaeger Authors.
// Copyright (c) 2018 Uber Technologies, Inc.
// SPDX-License-Identifier: Apache-2.0

package model

import (
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"strconv"

	"github.com/gogo/protobuf/jsonpb"
)

const (
	// traceIDShortBytesLen indicates length of 64bit traceID when represented as list of bytes
	traceIDShortBytesLen = 8
	// traceIDLongBytesLen indicates length of 128bit traceID when represented as list of bytes
	traceIDLongBytesLen = 16
)

// TraceID is a random 128bit identifier for a trace
type TraceID struct {
	Low  uint64 `json:"lo"`
	High uint64 `json:"hi"`
}

// SpanID is a random 64bit identifier for a span
type SpanID uint64

// ------- TraceID -------

// NewTraceID creates a new TraceID from two 64bit unsigned ints.
func NewTraceID(high, low uint64) TraceID {
	return TraceID{High: high, Low: low}
}

func (t TraceID) String() string {
	if t.High == 0 {
		return fmt.Sprintf("%016x", t.Low)
	}
	return fmt.Sprintf("%016x%016x", t.High, t.Low)
}

// TraceIDFromString creates a TraceID from a hexadecimal string
func TraceIDFromString(s string) (TraceID, error) {
	var hi, lo uint64
	var err error
	switch {
	case len(s) > 32:
		return TraceID{}, fmt.Errorf("TraceID cannot be longer than 32 hex characters: %s", s)
	case len(s) > 16:
		hiLen := len(s) - 16
		if hi, err = strconv.ParseUint(s[0:hiLen], 16, 64); err != nil {
			return TraceID{}, err
		}
		if lo, err = strconv.ParseUint(s[hiLen:], 16, 64); err != nil {
			return TraceID{}, err
		}
	default:
		if lo, err = strconv.ParseUint(s, 16, 64); err != nil {
			return TraceID{}, err
		}
	}
	return TraceID{High: hi, Low: lo}, nil
}

// TraceIDFromBytes creates a TraceID from list of bytes
func TraceIDFromBytes(data []byte) (TraceID, error) {
	var t TraceID
	switch {
	case len(data) == traceIDLongBytesLen:
		t.High = binary.BigEndian.Uint64(data[:traceIDShortBytesLen])
		t.Low = binary.BigEndian.Uint64(data[traceIDShortBytesLen:])
	case len(data) == traceIDShortBytesLen:
		t.Low = binary.BigEndian.Uint64(data)
	default:
		return TraceID{}, errors.New("invalid length for TraceID")
	}
	return t, nil
}

// MarshalText is called by encoding/json, which we do not want people to use.
func (TraceID) MarshalText() ([]byte, error) {
	return nil, errors.New("unsupported method TraceID.MarshalText; please use github.com/gogo/protobuf/jsonpb for marshalling")
}

// UnmarshalText is called by encoding/json, which we do not want people to use.
func (*TraceID) UnmarshalText([]byte /* text */) error {
	return errors.New("unsupported method TraceID.UnmarshalText; please use github.com/gogo/protobuf/jsonpb for marshalling")
}

// Size returns the size of this datum in protobuf. It is always 16 bytes.
func (*TraceID) Size() int {
	return 16
}

// MarshalTo converts trace ID into a binary representation. Called by protobuf serialization.
func (t *TraceID) MarshalTo(data []byte) (n int, err error) {
	var b [16]byte
	binary.BigEndian.PutUint64(b[:8], uint64(t.High))
	binary.BigEndian.PutUint64(b[8:], uint64(t.Low))
	return marshalBytes(data, b[:])
}

// Unmarshal inflates this trace ID from binary representation. Called by protobuf serialization.
func (t *TraceID) Unmarshal(data []byte) error {
	var err error
	*t, err = TraceIDFromBytes(data)
	return err
}

func marshalBytes(dst []byte, src []byte) (n int, err error) {
	if len(dst) < len(src) {
		return 0, errors.New("buffer is too short")
	}
	return copy(dst, src), nil
}

// MarshalJSON converts trace id into a base64 string enclosed in quotes.
// Used by protobuf JSON serialization.
// Example: {high:2, low:1} => "AAAAAAAAAAIAAAAAAAAAAQ==".
func (t TraceID) MarshalJSON() ([]byte, error) {
	var b [16]byte
	t.MarshalTo(b[:]) // can only error on incorrect buffer size
	s := make([]byte, 24+2)
	base64.StdEncoding.Encode(s[1:25], b[:])
	s[0], s[25] = '"', '"'
	return s, nil
}

// UnmarshalJSON inflates trace id from base64 string, possibly enclosed in quotes.
// Used by protobuf JSON serialization.
func (t *TraceID) UnmarshalJSON(data []byte) error {
	s := string(data)
	if l := len(s); l > 2 && s[0] == '"' && s[l-1] == '"' {
		s = s[1 : l-1]
	}
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return fmt.Errorf("cannot unmarshal TraceID from string '%s': %w", string(data), err)
	}
	return t.Unmarshal(b)
}

// ------- SpanID -------

// NewSpanID creates a new SpanID from a 64bit unsigned int.
func NewSpanID(v uint64) SpanID {
	return SpanID(v)
}

func (s SpanID) String() string {
	return fmt.Sprintf("%016x", uint64(s))
}

// SpanIDFromString creates a SpanID from a hexadecimal string
func SpanIDFromString(s string) (SpanID, error) {
	if len(s) > 16 {
		return SpanID(0), fmt.Errorf("SpanID cannot be longer than 16 hex characters: %s", s)
	}
	id, err := strconv.ParseUint(s, 16, 64)
	if err != nil {
		return SpanID(0), err
	}
	return SpanID(id), nil
}

// SpanIDFromBytes creates a SpandID from list of bytes
func SpanIDFromBytes(data []byte) (SpanID, error) {
	if len(data) != traceIDShortBytesLen {
		return SpanID(0), errors.New("invalid length for SpanID")
	}
	return NewSpanID(binary.BigEndian.Uint64(data)), nil
}

// MarshalText is called by encoding/json, which we do not want people to use.
func (SpanID) MarshalText() ([]byte, error) {
	return nil, errors.New("unsupported method SpanID.MarshalText; please use github.com/gogo/protobuf/jsonpb for marshalling")
}

// UnmarshalText is called by encoding/json, which we do not want people to use.
func (*SpanID) UnmarshalText([]byte /* text */) error {
	return errors.New("unsupported method SpanID.UnmarshalText; please use github.com/gogo/protobuf/jsonpb for marshalling")
}

// Size returns the size of this datum in protobuf. It is always 8 bytes.
func (*SpanID) Size() int {
	return 8
}

// MarshalTo converts span ID into a binary representation. Called by protobuf serialization.
func (s *SpanID) MarshalTo(data []byte) (n int, err error) {
	var b [8]byte
	binary.BigEndian.PutUint64(b[:], uint64(*s))
	return marshalBytes(data, b[:])
}

// Unmarshal inflates span ID from a binary representation. Called by protobuf serialization.
func (s *SpanID) Unmarshal(data []byte) error {
	var err error
	*s, err = SpanIDFromBytes(data)
	return err
}

// MarshalJSON converts span id into a base64 string enclosed in quotes.
// Used by protobuf JSON serialization.
// Example: {1} => "AAAAAAAAAAE=".
func (s SpanID) MarshalJSON() ([]byte, error) {
	var b [8]byte
	s.MarshalTo(b[:]) // can only error on incorrect buffer size
	v := make([]byte, 12+2)
	base64.StdEncoding.Encode(v[1:13], b[:])
	v[0], v[13] = '"', '"'
	return v, nil
}

// UnmarshalJSON inflates span id from base64 string, possibly enclosed in quotes.
// User by protobuf JSON serialization.
//
// There appears to be a bug in gogoproto, as this function is only called for numeric values.
// https://github.com/gogo/protobuf/issues/411#issuecomment-393856837
func (s *SpanID) UnmarshalJSON(data []byte) error {
	str := string(data)
	if l := len(str); l > 2 && str[0] == '"' && str[l-1] == '"' {
		str = str[1 : l-1]
	}
	b, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return fmt.Errorf("cannot unmarshal SpanID from string '%s': %w", string(data), err)
	}
	return s.Unmarshal(b)
}

// UnmarshalJSONPB inflates span id from base64 string, possibly enclosed in quotes.
// User by protobuf JSON serialization.
//
// TODO: can be removed once this ticket is fixed:
//
// https://github.com/gogo/protobuf/issues/411#issuecomment-393856837
func (s *SpanID) UnmarshalJSONPB(_ *jsonpb.Unmarshaler, b []byte) error {
	return s.UnmarshalJSON(b)
}
