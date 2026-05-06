package util

import (
	"strconv"

	v1common "github.com/grafana/tempo/pkg/tempopb/common/v1"
)

func StringifyAnyValue(anyValue *v1common.AnyValue) string {
	switch anyValue.Value.(type) {
	case *v1common.AnyValue_BoolValue:
		return strconv.FormatBool(anyValue.GetBoolValue())
	case *v1common.AnyValue_IntValue:
		return strconv.FormatInt(anyValue.GetIntValue(), 10)
	case *v1common.AnyValue_ArrayValue:
		arrStr := "["
		for _, v := range anyValue.GetArrayValue().Values {
			arrStr += StringifyAnyValue(v)
		}
		arrStr += "]"
		return arrStr
	case *v1common.AnyValue_DoubleValue:
		return strconv.FormatFloat(anyValue.GetDoubleValue(), 'f', -1, 64)
	case *v1common.AnyValue_KvlistValue:
		mapStr := "{"
		for _, kv := range anyValue.GetKvlistValue().Values {
			mapStr += kv.Key + ":" + StringifyAnyValue(kv.Value)
		}
		mapStr += "}"
		return mapStr
	case *v1common.AnyValue_StringValue:
		return anyValue.GetStringValue()
	}

	return ""
}
