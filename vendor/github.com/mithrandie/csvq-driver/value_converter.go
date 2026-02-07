package csvq

import (
	"database/sql/driver"
	"fmt"
	"time"
)

type ValueConverter struct {
}

func (c ValueConverter) ConvertValue(v interface{}) (driver.Value, error) {
	if IsCsvqValue(v) {
		return v, nil
	}

	if v == nil {
		return Null{}, nil
	}

	switch v.(type) {
	case string:
		return String{value: v.(string)}, nil
	case int:
		return Integer{value: int64(v.(int))}, nil
	case int8:
		return Integer{value: int64(v.(int8))}, nil
	case int16:
		return Integer{value: int64(v.(int16))}, nil
	case int32:
		return Integer{value: int64(v.(int32))}, nil
	case int64:
		return Integer{value: v.(int64)}, nil
	case uint:
		return Integer{value: int64(v.(uint))}, nil
	case uint8:
		return Integer{value: int64(v.(uint8))}, nil
	case uint16:
		return Integer{value: int64(v.(uint16))}, nil
	case uint32:
		return Integer{value: int64(v.(uint32))}, nil
	case uint64:
		u64 := v.(uint64)
		if u64 >= 1<<63 {
			return nil, fmt.Errorf("uint64 values with high bit set are not supported")
		}
		return Integer{value: int64(u64)}, nil
	case float32:
		return Float{value: float64(v.(float32))}, nil
	case float64:
		return Float{value: v.(float64)}, nil
	case bool:
		return Boolean{value: v.(bool)}, nil
	case time.Time:
		return Datetime{value: v.(time.Time)}, nil
	}

	return nil, fmt.Errorf("unsupported type: %T", v)
}

func IsCsvqValue(v interface{}) bool {
	switch v.(type) {
	case String, Integer, Float, Boolean, Datetime, Null:
		return true
	}
	return false
}
