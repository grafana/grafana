package graphql

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
)

func MarshalUint(i uint) Marshaler {
	return WriterFunc(func(w io.Writer) {
		_, _ = io.WriteString(w, strconv.FormatUint(uint64(i), 10))
	})
}

func UnmarshalUint(v any) (uint, error) {
	switch v := v.(type) {
	case string:
		u64, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			var strconvErr *strconv.NumError
			if errors.As(err, &strconvErr) && isSignedInteger(v) {
				return 0, newUintSignError(v)
			}
			return 0, err
		}
		return uint(u64), err
	case int:
		if v < 0 {
			return 0, newUintSignError(strconv.FormatInt(int64(v), 10))
		}
		return uint(v), nil
	case int64:
		if v < 0 {
			return 0, newUintSignError(strconv.FormatInt(v, 10))
		}
		return uint(v), nil
	case json.Number:
		u64, err := strconv.ParseUint(string(v), 10, 64)
		if err != nil {
			var strconvErr *strconv.NumError
			if errors.As(err, &strconvErr) && isSignedInteger(string(v)) {
				return 0, newUintSignError(string(v))
			}
			return 0, err
		}
		return uint(u64), err
	case nil:
		return 0, nil
	default:
		return 0, fmt.Errorf("%T is not an uint", v)
	}
}

func MarshalUint64(i uint64) Marshaler {
	return WriterFunc(func(w io.Writer) {
		_, _ = io.WriteString(w, strconv.FormatUint(i, 10))
	})
}

func UnmarshalUint64(v any) (uint64, error) {
	switch v := v.(type) {
	case string:
		i, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			var strconvErr *strconv.NumError
			if errors.As(err, &strconvErr) && isSignedInteger(v) {
				return 0, newUintSignError(v)
			}
			return 0, err
		}
		return i, nil
	case int:
		if v < 0 {
			return 0, newUintSignError(strconv.FormatInt(int64(v), 10))
		}
		return uint64(v), nil
	case int64:
		if v < 0 {
			return 0, newUintSignError(strconv.FormatInt(v, 10))
		}
		return uint64(v), nil
	case json.Number:
		i, err := strconv.ParseUint(string(v), 10, 64)
		if err != nil {
			var strconvErr *strconv.NumError
			if errors.As(err, &strconvErr) && isSignedInteger(string(v)) {
				return 0, newUintSignError(string(v))
			}
			return 0, err
		}
		return i, nil
	case nil:
		return 0, nil
	default:
		return 0, fmt.Errorf("%T is not an uint", v)
	}
}

func MarshalUint32(i uint32) Marshaler {
	return WriterFunc(func(w io.Writer) {
		_, _ = io.WriteString(w, strconv.FormatUint(uint64(i), 10))
	})
}

func UnmarshalUint32(v any) (uint32, error) {
	switch v := v.(type) {
	case string:
		iv, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			var strconvErr *strconv.NumError
			if errors.As(err, &strconvErr) && isSignedInteger(v) {
				return 0, newUintSignError(v)
			}
			return 0, err
		}
		return safeCastUint32(iv)
	case int:
		if v < 0 {
			return 0, newUintSignError(strconv.FormatInt(int64(v), 10))
		}
		return safeCastUint32(uint64(v))
	case int64:
		if v < 0 {
			return 0, newUintSignError(strconv.FormatInt(v, 10))
		}
		return safeCastUint32(uint64(v))
	case json.Number:
		iv, err := strconv.ParseUint(string(v), 10, 64)
		if err != nil {
			var strconvErr *strconv.NumError
			if errors.As(err, &strconvErr) && isSignedInteger(string(v)) {
				return 0, newUintSignError(string(v))
			}
			return 0, err
		}
		return safeCastUint32(iv)
	case nil:
		return 0, nil
	default:
		return 0, fmt.Errorf("%T is not an uint", v)
	}
}

type UintSignError struct {
	*IntegerError
}

func newUintSignError(v string) *UintSignError {
	return &UintSignError{
		IntegerError: &IntegerError{
			Message: fmt.Sprintf("%v is an invalid unsigned integer: includes sign", v),
		},
	}
}

func (e *UintSignError) Unwrap() error {
	return e.IntegerError
}

func isSignedInteger(v string) bool {
	if v == "" {
		return false
	}
	if v[0] != '-' && v[0] != '+' {
		return false
	}
	if _, err := strconv.ParseUint(v[1:], 10, 64); err == nil {
		return true
	}
	return false
}

type Uint32OverflowError struct {
	Value uint64
	*IntegerError
}

func newUint32OverflowError(i uint64) *Uint32OverflowError {
	return &Uint32OverflowError{
		Value: i,
		IntegerError: &IntegerError{
			Message: fmt.Sprintf("%d overflows unsigned 32-bit integer", i),
		},
	}
}

func (e *Uint32OverflowError) Unwrap() error {
	return e.IntegerError
}

func safeCastUint32(i uint64) (uint32, error) {
	if i > math.MaxUint32 {
		return 0, newUint32OverflowError(i)
	}
	return uint32(i), nil
}
