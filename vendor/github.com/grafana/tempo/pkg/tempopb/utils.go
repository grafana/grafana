package tempopb

import v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"

func MakeKeyValueString(key, value string) v1.KeyValue {
	return v1.KeyValue{
		Key: key,
		Value: &v1.AnyValue{
			Value: &v1.AnyValue_StringValue{
				StringValue: value,
			},
		},
	}
}

func MakeKeyValueStringPtr(key, value string) *v1.KeyValue {
	kv := MakeKeyValueString(key, value)
	return &kv
}

func MakeKeyValueDouble(key string, value float64) v1.KeyValue {
	return v1.KeyValue{
		Key: key,
		Value: &v1.AnyValue{
			Value: &v1.AnyValue_DoubleValue{
				DoubleValue: value,
			},
		},
	}
}
