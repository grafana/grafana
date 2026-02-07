package jsonlogic

import (
	"math"
	"reflect"
	"strconv"
	"strings"
)

func is(obj any, kind reflect.Kind) bool {
	return obj != nil && reflect.TypeOf(obj).Kind() == kind
}

func isBool(obj any) bool {
	return is(obj, reflect.Bool)
}

func isString(obj any) bool {
	return is(obj, reflect.String)
}

func isNumber(obj any) bool {
	switch obj.(type) {
	case int, float64:
		return true
	default:
		return false
	}
}

func isPrimitive(obj any) bool {
	return isBool(obj) || isString(obj) || isNumber(obj)
}

func isMap(obj any) bool {
	return is(obj, reflect.Map)
}

func isSlice(obj any) bool {
	return is(obj, reflect.Slice)
}

func isEmptySlice(obj any) bool {
	if !isSlice(obj) {
		return false
	}

	for _, v := range obj.([]any) {
		if isTrue(v) {
			return false
		}
	}

	return true
}

func isTrue(obj any) bool {
	if isBool(obj) {
		return obj.(bool)
	}

	if isNumber(obj) {
		return toNumber(obj) != 0
	}

	if isString(obj) || isSlice(obj) || isMap(obj) {
		return reflect.ValueOf(obj).Len() > 0
	}

	return false
}

func toNumber(value any) float64 {
	if isString(value) {
		w, _ := strconv.ParseFloat(value.(string), 64)

		return w
	}

	switch value := value.(type) {
	case int:
		return float64(value)
	default:
		return value.(float64)
	}
}

// toNumberFromAny converts various input types to float64.
//
// Examples:
//
//	toNumberFromAny(42)                             // Returns: 42.0
//	toNumberFromAny("3.14")                         // Returns: 3.14
//	toNumberFromAny(true)                           // Returns: 1.0
//	toNumberFromAny(false)                          // Returns: 0.0
//	toNumberFromAny([]int{1, 2, 3})                 // Returns: 3.0 (length of slice)
//	toNumberFromAny(map[string]int{"a": 1, "b": 2}) // Returns: 2.0 (length of map)
//	toNumberFromAny(nil)                            // Returns: 0.0
//
// Note: For unsupported types, it returns 0.0
func toNumberFromAny(v any) float64 {
	switch value := v.(type) {
	case nil:
		return 0
	case undefinedType:
		return math.NaN()
	case float32, float64, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return reflect.ValueOf(value).Convert(reflect.TypeOf(float64(0))).Float()
	case bool: // Boolean values true and false are converted to 1 and 0 respectively.
		if value {
			return 1
		} else {
			return 0
		}
	case string:
		if strings.TrimSpace(value) == "" {
			return 0
		}

		n, err := strconv.ParseFloat(value, 64)
		switch err {
		case strconv.ErrRange, nil:
			return n
		default:
			return math.NaN()
		}
	default:
		return math.NaN()
	}
}

func toString(value any) string {
	if isNumber(value) {
		switch value := value.(type) {
		case int:
			return strconv.FormatInt(int64(value), 10)
		default:
			return strconv.FormatFloat(value.(float64), 'f', -1, 64)
		}
	}

	if value == nil {
		return ""
	}

	return value.(string)
}
