package util

import (
	"errors"
	"math"
	"reflect"

	"golang.org/x/exp/constraints"
)

// IsFalse determines if an object is false based on the JMESPath spec.
// JMESPath defines false values to be any of:
// - An empty string array, or hash.
// - The boolean value false.
// - nil.
func IsFalse(value interface{}) bool {
	switch v := value.(type) {
	case bool:
		return !v
	case []interface{}:
		return len(v) == 0
	case map[string]interface{}:
		return len(v) == 0
	case string:
		return len(v) == 0
	case nil:
		return true
	}
	// Try the reflection cases before returning false.
	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Struct:
		// A struct type will never be false, even if
		// all of its values are the zero type.
		return false
	case reflect.Slice, reflect.Map:
		return rv.Len() == 0
	case reflect.Ptr:
		if rv.IsNil() {
			return true
		}
		// If it's a pointer type, we'll try to deref the pointer
		// and evaluate the pointer value for isFalse.
		element := rv.Elem()
		return IsFalse(element.Interface())
	}
	return false
}

// ObjsEqual is a generic object equality check.
// It will take two arbitrary objects and recursively determine
// if they are equal.
func ObjsEqual(left interface{}, right interface{}) bool {
	return reflect.DeepEqual(left, right)
}

// SliceParam refers to a single part of a slice.
// A slice consists of a start, a stop, and a step, similar to
// python slices.
type SliceParam struct {
	N         int
	Specified bool
}

// Slice supports [start:stop:step] style slicing that's supported in JMESPath.
func Slice[T interface{} | rune](slice []T, parts []SliceParam) ([]T, error) {
	computed, err := computeSliceParams(len(slice), parts)
	if err != nil {
		return nil, err
	}
	start, stop, step := computed[0], computed[1], computed[2]
	result := []T{}
	if step > 0 {
		for i := start; i < stop; i += step {
			result = append(result, slice[i])
		}
	} else {
		for i := start; i > stop; i += step {
			result = append(result, slice[i])
		}
	}
	return result, nil
}

func MakeSliceParams(parts []*int) []SliceParam {
	sliceParams := make([]SliceParam, 3)
	for i, part := range parts {
		if part != nil {
			sliceParams[i].Specified = true
			sliceParams[i].N = *part
		}
	}
	return sliceParams
}

func computeSliceParams(length int, parts []SliceParam) ([]int, error) {
	var start, stop, step int
	if !parts[2].Specified {
		step = 1
	} else if parts[2].N == 0 {
		return nil, errors.New("invalid slice, step cannot be 0")
	} else {
		step = parts[2].N
	}
	var stepValueNegative bool
	if step < 0 {
		stepValueNegative = true
	} else {
		stepValueNegative = false
	}

	if !parts[0].Specified {
		if stepValueNegative {
			start = length - 1
		} else {
			start = 0
		}
	} else {
		start = capSlice(length, parts[0].N, step)
	}

	if !parts[1].Specified {
		if stepValueNegative {
			stop = -1
		} else {
			stop = length
		}
	} else {
		stop = capSlice(length, parts[1].N, step)
	}
	return []int{start, stop, step}, nil
}

func capSlice(length int, actual int, step int) int {
	if actual < 0 {
		actual += length
		if actual < 0 {
			if step < 0 {
				actual = -1
			} else {
				actual = 0
			}
		}
	} else if actual >= length {
		if step < 0 {
			actual = length - 1
		} else {
			actual = length
		}
	}
	return actual
}

// ToArrayArray converts an empty interface type to a slice of slices.
// If any element in the array cannot be converted, then nil is returned
// along with a second value of false.
func ToArrayArray(data interface{}) ([][]interface{}, bool) {
	result := [][]interface{}{}
	arr, ok := data.([]interface{})
	if !ok {
		return nil, false
	}
	for _, item := range arr {
		nested, ok := item.([]interface{})
		if !ok {
			return nil, false
		}
		result = append(result, nested)
	}
	return result, true
}

// ToArrayNum converts an empty interface type to a slice of float64.
// If any element in the array cannot be converted, then nil is returned
// along with a second value of false.
func ToArrayNum(data interface{}) ([]float64, bool) {
	// Is there a better way to do this with reflect?
	if d, ok := data.([]interface{}); ok {
		result := make([]float64, len(d))
		for i, el := range d {
			item, ok := el.(float64)
			if !ok {
				return nil, false
			}
			result[i] = item
		}
		return result, true
	}
	return nil, false
}

// ToArrayStr converts an empty interface type to a slice of strings.
// If any element in the array cannot be converted, then nil is returned
// along with a second value of false.  If the input data could be entirely
// converted, then the converted data, along with a second value of true,
// will be returned.
func ToArrayStr(data interface{}) ([]string, bool) {
	// Is there a better way to do this with reflect?
	if d, ok := data.([]interface{}); ok {
		result := make([]string, len(d))
		for i, el := range d {
			item, ok := el.(string)
			if !ok {
				return nil, false
			}
			result[i] = item
		}
		return result, true
	}
	return nil, false
}

// ToInteger converts an empty interface to a integer.
// It expects the empty interface to represent a float64 JSON number.
// If the empty interface cannot be converted or if the number
// is not an integer, the function returns a second boolean value false.
func ToInteger(v interface{}) (int, bool) {
	if num, ok := v.(float64); ok {
		if math.Floor(num) != num {
			return 0, false
		}
		return int(math.Floor(num)), true
	}
	return 0, false
}

func ToPositiveInteger(v interface{}) (int, bool) {
	num, ok := ToInteger(v)
	return num, ok && num >= 0
}

func IsSliceType(v interface{}) bool {
	if v == nil {
		return false
	}
	return reflect.TypeOf(v).Kind() == reflect.Slice
}

func Min[T constraints.Ordered](a T, b T) T {
	if a < b {
		return a
	}
	return b
}

func Max[T constraints.Ordered](a T, b T) T {
	if a > b {
		return a
	}
	return b
}
