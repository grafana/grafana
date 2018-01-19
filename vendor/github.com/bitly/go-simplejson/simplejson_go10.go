// +build !go1.1

package simplejson

import (
	"encoding/json"
	"errors"
	"io"
	"reflect"
)

// NewFromReader returns a *Json by decoding from an io.Reader
func NewFromReader(r io.Reader) (*Json, error) {
	j := new(Json)
	dec := json.NewDecoder(r)
	err := dec.Decode(&j.data)
	return j, err
}

// Implements the json.Unmarshaler interface.
func (j *Json) UnmarshalJSON(p []byte) error {
	return json.Unmarshal(p, &j.data)
}

// Float64 coerces into a float64
func (j *Json) Float64() (float64, error) {
	switch j.data.(type) {
	case float32, float64:
		return reflect.ValueOf(j.data).Float(), nil
	case int, int8, int16, int32, int64:
		return float64(reflect.ValueOf(j.data).Int()), nil
	case uint, uint8, uint16, uint32, uint64:
		return float64(reflect.ValueOf(j.data).Uint()), nil
	}
	return 0, errors.New("invalid value type")
}

// Int coerces into an int
func (j *Json) Int() (int, error) {
	switch j.data.(type) {
	case float32, float64:
		return int(reflect.ValueOf(j.data).Float()), nil
	case int, int8, int16, int32, int64:
		return int(reflect.ValueOf(j.data).Int()), nil
	case uint, uint8, uint16, uint32, uint64:
		return int(reflect.ValueOf(j.data).Uint()), nil
	}
	return 0, errors.New("invalid value type")
}

// Int64 coerces into an int64
func (j *Json) Int64() (int64, error) {
	switch j.data.(type) {
	case float32, float64:
		return int64(reflect.ValueOf(j.data).Float()), nil
	case int, int8, int16, int32, int64:
		return reflect.ValueOf(j.data).Int(), nil
	case uint, uint8, uint16, uint32, uint64:
		return int64(reflect.ValueOf(j.data).Uint()), nil
	}
	return 0, errors.New("invalid value type")
}

// Uint64 coerces into an uint64
func (j *Json) Uint64() (uint64, error) {
	switch j.data.(type) {
	case float32, float64:
		return uint64(reflect.ValueOf(j.data).Float()), nil
	case int, int8, int16, int32, int64:
		return uint64(reflect.ValueOf(j.data).Int()), nil
	case uint, uint8, uint16, uint32, uint64:
		return reflect.ValueOf(j.data).Uint(), nil
	}
	return 0, errors.New("invalid value type")
}
