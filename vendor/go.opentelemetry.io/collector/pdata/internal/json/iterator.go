// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package json // import "go.opentelemetry.io/collector/pdata/internal/json"
import (
	"encoding/base64"
	"strconv"

	jsoniter "github.com/json-iterator/go"
)

func BorrowIterator(data []byte) *Iterator {
	return &Iterator{
		delegate: jsoniter.ConfigFastest.BorrowIterator(data),
	}
}

func ReturnIterator(s *Iterator) {
	jsoniter.ConfigFastest.ReturnIterator(s.delegate)
}

type Iterator struct {
	delegate *jsoniter.Iterator
}

// ReadInt32 unmarshalls JSON data into an int32. Accepts both numbers and strings decimal.
// See https://developers.google.com/protocol-buffers/docs/proto3#json.
func (iter *Iterator) ReadInt32() int32 {
	switch iter.delegate.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.delegate.ReadInt32()
	case jsoniter.StringValue:
		val, err := strconv.ParseInt(iter.ReadString(), 10, 32)
		if err != nil {
			iter.ReportError("ReadInt32", err.Error())
			return 0
		}
		return int32(val)
	default:
		iter.ReportError("ReadInt32", "unsupported value type")
		return 0
	}
}

// ReadUint32 unmarshalls JSON data into an uint32. Accepts both numbers and strings decimal.
// See https://developers.google.com/protocol-buffers/docs/proto3#json.
func (iter *Iterator) ReadUint32() uint32 {
	switch iter.delegate.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.delegate.ReadUint32()
	case jsoniter.StringValue:
		val, err := strconv.ParseUint(iter.ReadString(), 10, 32)
		if err != nil {
			iter.ReportError("ReadUint32", err.Error())
			return 0
		}
		return uint32(val)
	default:
		iter.ReportError("ReadUint32", "unsupported value type")
		return 0
	}
}

// ReadInt64 unmarshalls JSON data into an int64. Accepts both numbers and strings decimal.
// See https://developers.google.com/protocol-buffers/docs/proto3#json.
func (iter *Iterator) ReadInt64() int64 {
	switch iter.delegate.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.delegate.ReadInt64()
	case jsoniter.StringValue:
		val, err := strconv.ParseInt(iter.ReadString(), 10, 64)
		if err != nil {
			iter.ReportError("ReadInt64", err.Error())
			return 0
		}
		return val
	default:
		iter.ReportError("ReadInt64", "unsupported value type")
		return 0
	}
}

// ReadUint64 unmarshalls JSON data into an uint64. Accepts both numbers and strings decimal.
// See https://developers.google.com/protocol-buffers/docs/proto3#json.
func (iter *Iterator) ReadUint64() uint64 {
	switch iter.delegate.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.delegate.ReadUint64()
	case jsoniter.StringValue:
		val, err := strconv.ParseUint(iter.ReadString(), 10, 64)
		if err != nil {
			iter.ReportError("ReadUint64", err.Error())
			return 0
		}
		return val
	default:
		iter.ReportError("ReadUint64", "unsupported value type")
		return 0
	}
}

func (iter *Iterator) ReadFloat32() float32 {
	switch iter.delegate.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.delegate.ReadFloat32()
	case jsoniter.StringValue:
		val, err := strconv.ParseFloat(iter.ReadString(), 32)
		if err != nil {
			iter.ReportError("ReadUint64", err.Error())
			return 0
		}
		return float32(val)
	default:
		iter.ReportError("ReadUint64", "unsupported value type")
		return 0
	}
}

func (iter *Iterator) ReadFloat64() float64 {
	switch iter.delegate.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.delegate.ReadFloat64()
	case jsoniter.StringValue:
		val, err := strconv.ParseFloat(iter.ReadString(), 64)
		if err != nil {
			iter.ReportError("ReadUint64", err.Error())
			return 0
		}
		return val
	default:
		iter.ReportError("ReadUint64", "unsupported value type")
		return 0
	}
}

// ReadBool reads a json object as BoolValue
func (iter *Iterator) ReadBool() bool {
	return iter.delegate.ReadBool()
}

// ReadString read string from iterator
func (iter *Iterator) ReadString() string {
	return iter.delegate.ReadString()
}

// ReadBytes read base64 encoded bytes from iterator.
func (iter *Iterator) ReadBytes() []byte {
	buf := iter.ReadStringAsSlice()
	if len(buf) == 0 {
		return nil
	}
	orig := make([]byte, base64.StdEncoding.DecodedLen(len(buf)))
	n, err := base64.StdEncoding.Decode(orig, buf)
	if err != nil {
		iter.ReportError("base64.Decode", err.Error())
	}
	return orig[:n]
}

// ReadStringAsSlice read string from iterator without copying into string form.
// The []byte cannot be kept, as it will change after next iterator call.
func (iter *Iterator) ReadStringAsSlice() []byte {
	return iter.delegate.ReadStringAsSlice()
}

// ReportError record a error in iterator instance with current position.
func (iter *Iterator) ReportError(operation, msg string) {
	iter.delegate.ReportError(operation, msg)
}

// Error returns any recorded error if any otherwise it returns nil.
func (iter *Iterator) Error() error {
	return iter.delegate.Error
}

// Skip skips a json object and positions to relatively the next json object
func (iter *Iterator) Skip() {
	iter.delegate.Skip()
}

// ReadArray read array element, returns true if the array has more element to read.
func (iter *Iterator) ReadArray() bool {
	return iter.delegate.ReadArray()
}

// ReadObject read one field from object.
// If object ended, returns empty string. Otherwise, returns the field name.
func (iter *Iterator) ReadObject() string {
	return iter.delegate.ReadObject()
}

// ReadEnumValue returns the enum integer value representation. Accepts both enum names and enum integer values.
// See https://developers.google.com/protocol-buffers/docs/proto3#json.
func (iter *Iterator) ReadEnumValue(valueMap map[string]int32) int32 {
	switch iter.delegate.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.ReadInt32()
	case jsoniter.StringValue:
		val, ok := valueMap[iter.ReadString()]
		// Same behavior with official protobuf JSON decoder,
		// see https://github.com/open-telemetry/opentelemetry-proto-go/pull/81
		if !ok {
			iter.ReportError("ReadEnumValue", "unknown string value")
			return 0
		}
		return val
	default:
		iter.ReportError("ReadEnumValue", "unsupported value type")
		return 0
	}
}

// ResetBytes reuse iterator instance by specifying another byte array as input
func (iter *Iterator) ResetBytes(input []byte) *Iterator {
	iter.delegate.ResetBytes(input)
	return iter
}
