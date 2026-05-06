// Package converters provides data.FieldConverters commonly used by plugins.
package converters

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func toConversionError(expected string, v interface{}) error {
	return fmt.Errorf(`expected %s input but got type %T for value "%v"`, expected, v, v)
}

// Int64NOOP is a data.FieldConverter that performs no conversion.
// It should be used when the input type is an int64 and the Field's type
// is also an int64. The conversion will panic if the the input type does
// not match the Field type.
var Int64NOOP = data.FieldConverter{
	OutputFieldType: data.FieldTypeInt64,
}

// BoolNOOP is a data.FieldConverter that performs no conversion.
// It should be used when the input type is an bool and the Field's type
// is also an bool. The conversion will panic if the the input type does
// not match the Field type.
var BoolNOOP = data.FieldConverter{
	OutputFieldType: data.FieldTypeBool,
}

// Float64NOOP is a data.FieldConverter that performs no conversion.
// It should be used when the input type is an float64 and the Field's type
// is also an float64. The conversion will panic if the the input type does
// not match the Field type.
var Float64NOOP = data.FieldConverter{
	OutputFieldType: data.FieldTypeFloat64,
}

// StringNOOP is a data.FieldConverter that performs no conversion.
// It should be used when the input type is an int64 and the Field's type
// is also an string. The conversion will panic if the the input type does
// not match the Field type.
var StringNOOP = data.FieldConverter{
	OutputFieldType: data.FieldTypeString,
}

// AnyToNullableString converts any non-nil value into a *string.
// If the the input value is nil the output value is *string typed nil.
var AnyToNullableString = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableString,
	Converter: func(v interface{}) (interface{}, error) {
		var str *string
		if v != nil {
			s, ok := v.(string)
			if !ok {
				s = fmt.Sprintf("%v", v)
			}
			str = &s
		}
		return str, nil
	},
}

// AnyToString converts any value into a string.
var AnyToString = data.FieldConverter{
	OutputFieldType: data.FieldTypeString,
	Converter: func(v interface{}) (interface{}, error) {
		s, ok := v.(string)
		if ok {
			return s, nil
		}
		return fmt.Sprintf("%v", v), nil
	},
}

// Float64ToNullableFloat64 returns an error if the input is not a float64.
var Float64ToNullableFloat64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *float64
		if v == nil {
			return ptr, nil
		}
		val, ok := v.(float64)
		if !ok {
			return ptr, toConversionError("float64", v)
		}
		ptr = &val
		return ptr, nil
	},
}

// Int64ToNullableInt64 returns an error if the input is not an int64.
var Int64ToNullableInt64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableInt64,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *int64
		if v == nil {
			return ptr, nil
		}
		val, ok := v.(int64)
		if !ok {
			return ptr, toConversionError("int64", v)
		}
		ptr = &val
		return ptr, nil
	},
}

// Uint64ToNullableUInt64 returns an error if the input is not a uint64.
var Uint64ToNullableUInt64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableUint64,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *uint64
		if v == nil {
			return ptr, nil
		}
		val, ok := v.(uint64)
		if !ok {
			return ptr, toConversionError("uint64", v)
		}
		ptr = &val
		return ptr, nil
	},
}

// BoolToNullableBool returns an error if the input is not a bool.
var BoolToNullableBool = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableBool,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *bool
		if v == nil {
			return ptr, nil
		}
		val, ok := v.(bool)
		if !ok {
			return ptr, toConversionError("bool", v)
		}
		ptr = &val
		return ptr, nil
	},
}

// RFC3339StringToNullableTime convert a string with RFC3339 to a *time.Time object.
func RFC3339StringToNullableTime(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}

	rv, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil, err
	}

	u := rv.UTC()
	return &u, nil
}

// StringToNullableFloat64 parses a float64 value from a string.
var StringToNullableFloat64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *float64
		if v == nil {
			return ptr, nil
		}
		val, ok := v.(string)
		if !ok {
			return ptr, toConversionError("string", v)
		}
		fV, err := strconv.ParseFloat(val, 64)
		ptr = &fV
		return ptr, err
	},
}

// Float64EpochSecondsToTime converts a numeric seconds to time.Time.
var Float64EpochSecondsToTime = data.FieldConverter{
	OutputFieldType: data.FieldTypeTime,
	Converter: func(v interface{}) (interface{}, error) {
		fV, ok := v.(float64)
		if !ok {
			return nil, toConversionError("float64", v)
		}
		return time.Unix(int64(fV), 0).UTC(), nil
	},
}

// Float64EpochMillisToTime convert numeric milliseconds to time.Time
var Float64EpochMillisToTime = data.FieldConverter{
	OutputFieldType: data.FieldTypeTime,
	Converter: func(v interface{}) (interface{}, error) {
		fV, ok := v.(float64)
		if !ok {
			return nil, toConversionError("float64", v)
		}
		return time.Unix(0, int64(fV)*int64(time.Millisecond)).UTC(), nil
	},
}

// Boolean returns an error if the input is not a bool.
var Boolean = data.FieldConverter{
	OutputFieldType: data.FieldTypeBool,
	Converter: func(v interface{}) (interface{}, error) {
		fV, ok := v.(bool)
		if !ok {
			return nil, toConversionError("bool", v)
		}
		return fV, nil
	},
}

// JSONValueToFloat64 converts the values you will see in json to float64 (float64,int64,string)
var JSONValueToFloat64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		fV, ok := v.(float64)
		if ok {
			return fV, nil
		}
		iV, ok := v.(int64)
		if ok {
			fV = float64(iV)
			return fV, nil
		}
		iiV, ok := v.(int)
		if ok {
			fV = float64(iiV)
			return fV, nil
		}
		nn, ok := v.(json.Number)
		if ok {
			return nn.Float64()
		}
		sV, ok := v.(string)
		if ok {
			return strconv.ParseFloat(sV, 64)
		}

		return nil, toConversionError("float64", v)
	},
}

// JSONValueToInt64 converts the values you will see in json to int64 (float64,int64,string)
var JSONValueToInt64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeInt64,
	Converter: func(v interface{}) (interface{}, error) {
		iV, ok := v.(int64)
		if ok {
			return iV, nil
		}
		sV, ok := v.(string)
		if ok {
			return strconv.ParseInt(sV, 0, 64)
		}
		fV, ok := v.(float64)
		if ok {
			return int64(fV), nil
		}
		ii, ok := v.(int)
		if ok {
			return int64(ii), nil
		}
		nn, ok := v.(json.Number)
		if ok {
			return nn.Int64()
		}
		return nil, toConversionError("float64", v)
	},
}

// JSONValueToNullableFloat64 converts input to *float64
var JSONValueToNullableFloat64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *float64
		var err error
		if v != nil {
			fV, err := JSONValueToFloat64.Converter(v)
			if err == nil {
				vv := fV.(float64)
				ptr = &vv
			}
		}
		return ptr, err
	},
}

// JSONValueToNullableInt64 converts input to *int64
var JSONValueToNullableInt64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableInt64,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *int64
		var err error
		if v != nil {
			fV, err := JSONValueToInt64.Converter(v)
			if err == nil {
				vv := fV.(int64)
				ptr = &vv
			}
		}
		return ptr, err
	},
}

// Uint8ArrayToNullableString parses a string value from a []uint8.
var Uint8ArrayToNullableString = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableString,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *string
		if v == nil {
			return ptr, nil
		}
		val, ok := v.([]uint8)
		if !ok {
			return ptr, toConversionError("string", v)
		}
		fV := string(val)
		ptr = &fV
		return ptr, nil
	},
}
