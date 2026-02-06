// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package json // import "go.opentelemetry.io/collector/pdata/internal/json"

import (
	"encoding/base64"
	"errors"
	"io"
	"math"
	"strconv"

	jsoniter "github.com/json-iterator/go"
)

func BorrowStream(writer io.Writer) *Stream {
	return &Stream{
		Stream:    jsoniter.ConfigFastest.BorrowStream(writer),
		wmTracker: make([]bool, 32),
	}
}

func ReturnStream(s *Stream) {
	jsoniter.ConfigFastest.ReturnStream(s.Stream)
}

// Stream avoids the need to explicitly call the `Stream.WriteMore` method while marshaling objects by
// checking if a field was previously written inside the current object and automatically appending a ","
// if so before writing the next field.
type Stream struct {
	*jsoniter.Stream
	// wmTracker acts like a stack which pushes a new value when an object is started and removes the
	// top when it is ended. The value added for every object tracks if there is any written field
	// already for that object, and if it is then automatically add a "," before any new field.
	wmTracker []bool
}

func (ots *Stream) WriteObjectStart() {
	ots.Stream.WriteObjectStart()
	ots.wmTracker = append(ots.wmTracker, false)
}

func (ots *Stream) WriteObjectField(field string) {
	if ots.wmTracker[len(ots.wmTracker)-1] {
		ots.WriteMore()
	}

	ots.Stream.WriteObjectField(field)
	ots.wmTracker[len(ots.wmTracker)-1] = true
}

func (ots *Stream) WriteObjectEnd() {
	ots.Stream.WriteObjectEnd()
	ots.wmTracker = ots.wmTracker[:len(ots.wmTracker)-1]
}

// WriteInt64 writes the values as a decimal string. This is per the protobuf encoding rules for int64, fixed64, uint64.
func (ots *Stream) WriteInt64(val int64) {
	ots.WriteString(strconv.FormatInt(val, 10))
}

// WriteUint64 writes the values as a decimal string. This is per the protobuf encoding rules for int64, fixed64, uint64.
func (ots *Stream) WriteUint64(val uint64) {
	ots.WriteString(strconv.FormatUint(val, 10))
}

// WriteBytes writes the values as a base64 encoded string. This is per the protobuf encoding rules for bytes.
func (ots *Stream) WriteBytes(val []byte) {
	if len(val) == 0 {
		ots.WriteString("")
		return
	}

	ots.WriteString(base64.StdEncoding.EncodeToString(val))
}

// WriteFloat64 writes the JSON value that will be a number or one of the special string
// values "NaN", "Infinity", and "-Infinity". Either numbers or strings are accepted.
// Empty strings are invalid. Exponent notation is also accepted.
// See https://protobuf.dev/programming-guides/json/.
func (ots *Stream) WriteFloat64(val float64) {
	if math.IsNaN(val) {
		ots.WriteString("NaN")
		return
	}
	if math.IsInf(val, 1) {
		ots.WriteString("Infinity")
		return
	}
	if math.IsInf(val, -1) {
		ots.WriteString("-Infinity")
		return
	}

	ots.Stream.WriteFloat64(val)
}

func (ots *Stream) ReportError(err error) {
	ots.Stream.Error = errors.Join(ots.Stream.Error, err)
}

func (ots *Stream) Error() error {
	return ots.Stream.Error
}
