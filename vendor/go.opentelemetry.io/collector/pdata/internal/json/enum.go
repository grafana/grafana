// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package json // import "go.opentelemetry.io/collector/pdata/internal/json"

import (
	jsoniter "github.com/json-iterator/go"
)

// ReadEnumValue returns the enum integer value representation. Accepts both enum names and enum integer values.
// See https://developers.google.com/protocol-buffers/docs/proto3#json.
func ReadEnumValue(iter *jsoniter.Iterator, valueMap map[string]int32) int32 {
	switch iter.WhatIsNext() {
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
