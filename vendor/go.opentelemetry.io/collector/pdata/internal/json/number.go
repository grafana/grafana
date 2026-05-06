// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package json // import "go.opentelemetry.io/collector/pdata/internal/json"

import (
	"strconv"

	jsoniter "github.com/json-iterator/go"
)

// ReadInt32 unmarshalls JSON data into an int32. Accepts both numbers and strings decimal.
// See https://developers.google.com/protocol-buffers/docs/proto3#json.
func ReadInt32(iter *jsoniter.Iterator) int32 {
	switch iter.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.ReadInt32()
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
func ReadUint32(iter *jsoniter.Iterator) uint32 {
	switch iter.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.ReadUint32()
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
func ReadInt64(iter *jsoniter.Iterator) int64 {
	switch iter.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.ReadInt64()
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
func ReadUint64(iter *jsoniter.Iterator) uint64 {
	switch iter.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.ReadUint64()
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

func ReadFloat64(iter *jsoniter.Iterator) float64 {
	switch iter.WhatIsNext() {
	case jsoniter.NumberValue:
		return iter.ReadFloat64()
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
