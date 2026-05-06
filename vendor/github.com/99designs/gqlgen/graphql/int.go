package graphql

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"strconv"
)

func MarshalInt(i int) Marshaler {
	return WriterFunc(func(w io.Writer) {
		io.WriteString(w, strconv.Itoa(i))
	})
}

func UnmarshalInt(v any) (int, error) {
	switch v := v.(type) {
	case string:
		return strconv.Atoi(v)
	case int:
		return v, nil
	case int64:
		return int(v), nil
	case json.Number:
		return strconv.Atoi(string(v))
	case nil:
		return 0, nil
	default:
		return 0, fmt.Errorf("%T is not an int", v)
	}
}

func MarshalInt64(i int64) Marshaler {
	return WriterFunc(func(w io.Writer) {
		io.WriteString(w, strconv.FormatInt(i, 10))
	})
}

func UnmarshalInt64(v any) (int64, error) {
	switch v := v.(type) {
	case string:
		return strconv.ParseInt(v, 10, 64)
	case int:
		return int64(v), nil
	case int64:
		return v, nil
	case json.Number:
		return strconv.ParseInt(string(v), 10, 64)
	case nil:
		return 0, nil
	default:
		return 0, fmt.Errorf("%T is not an int", v)
	}
}

func MarshalInt32(i int32) Marshaler {
	return WriterFunc(func(w io.Writer) {
		io.WriteString(w, strconv.FormatInt(int64(i), 10))
	})
}

func UnmarshalInt32(v any) (int32, error) {
	switch v := v.(type) {
	case string:
		iv, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return 0, err
		}
		return safeCastInt32(iv)
	case int:
		return safeCastInt32(int64(v))
	case int64:
		return safeCastInt32(v)
	case json.Number:
		iv, err := strconv.ParseInt(string(v), 10, 64)
		if err != nil {
			return 0, err
		}
		return safeCastInt32(iv)
	case nil:
		return 0, nil
	default:
		return 0, fmt.Errorf("%T is not an int", v)
	}
}

// IntegerError is an error type that allows users to identify errors associated
// with receiving an integer value that is not valid for the specific integer
// type designated by the API. IntegerErrors designate otherwise valid unsigned
// or signed 64-bit integers that are invalid in a specific context: they do not
// designate integers that overflow 64-bit versions of the current type.
type IntegerError struct {
	Message string
}

func (e IntegerError) Error() string {
	return e.Message
}

type Int32OverflowError struct {
	Value int64
	*IntegerError
}

func newInt32OverflowError(i int64) *Int32OverflowError {
	return &Int32OverflowError{
		Value: i,
		IntegerError: &IntegerError{
			Message: fmt.Sprintf("%d overflows signed 32-bit integer", i),
		},
	}
}

func (e *Int32OverflowError) Unwrap() error {
	return e.IntegerError
}

func safeCastInt32(i int64) (int32, error) {
	if i > math.MaxInt32 || i < math.MinInt32 {
		return 0, newInt32OverflowError(i)
	}
	return int32(i), nil
}
