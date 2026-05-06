// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package json // import "go.opentelemetry.io/collector/pdata/internal/json"

import (
	"encoding/base64"
	"fmt"

	jsoniter "github.com/json-iterator/go"

	otlpcommon "go.opentelemetry.io/collector/pdata/internal/data/protogen/common/v1"
)

// ReadAttribute Unmarshal JSON data and return otlpcommon.KeyValue
func ReadAttribute(iter *jsoniter.Iterator) otlpcommon.KeyValue {
	kv := otlpcommon.KeyValue{}
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "key":
			kv.Key = iter.ReadString()
		case "value":
			ReadValue(iter, &kv.Value)
		default:
			iter.Skip()
		}
		return true
	})
	return kv
}

// ReadValue Unmarshal JSON data and return otlpcommon.AnyValue
func ReadValue(iter *jsoniter.Iterator, val *otlpcommon.AnyValue) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "stringValue", "string_value":
			val.Value = &otlpcommon.AnyValue_StringValue{
				StringValue: iter.ReadString(),
			}

		case "boolValue", "bool_value":
			val.Value = &otlpcommon.AnyValue_BoolValue{
				BoolValue: iter.ReadBool(),
			}
		case "intValue", "int_value":
			val.Value = &otlpcommon.AnyValue_IntValue{
				IntValue: ReadInt64(iter),
			}
		case "doubleValue", "double_value":
			val.Value = &otlpcommon.AnyValue_DoubleValue{
				DoubleValue: ReadFloat64(iter),
			}
		case "bytesValue", "bytes_value":
			v, err := base64.StdEncoding.DecodeString(iter.ReadString())
			if err != nil {
				iter.ReportError("bytesValue", fmt.Sprintf("base64 decode:%v", err))
				break
			}
			val.Value = &otlpcommon.AnyValue_BytesValue{
				BytesValue: v,
			}
		case "arrayValue", "array_value":
			val.Value = &otlpcommon.AnyValue_ArrayValue{
				ArrayValue: readArray(iter),
			}
		case "kvlistValue", "kvlist_value":
			val.Value = &otlpcommon.AnyValue_KvlistValue{
				KvlistValue: readKvlistValue(iter),
			}
		default:
			iter.Skip()
		}
		return true
	})
}

func readArray(iter *jsoniter.Iterator) *otlpcommon.ArrayValue {
	v := &otlpcommon.ArrayValue{}
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "values":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				v.Values = append(v.Values, otlpcommon.AnyValue{})
				ReadValue(iter, &v.Values[len(v.Values)-1])
				return true
			})
		default:
			iter.Skip()
		}
		return true
	})
	return v
}

func readKvlistValue(iter *jsoniter.Iterator) *otlpcommon.KeyValueList {
	v := &otlpcommon.KeyValueList{}
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "values":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				v.Values = append(v.Values, ReadAttribute(iter))
				return true
			})
		default:
			iter.Skip()
		}
		return true
	})
	return v
}
