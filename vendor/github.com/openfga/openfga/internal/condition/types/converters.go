package types

import (
	"fmt"
	"math/big"
	"reflect"
	"time"
)

func primitiveTypeConverterFunc[T any](value any) (any, error) {
	v, ok := value.(T)
	if !ok {
		return nil, fmt.Errorf("expected type value '%T', but found '%s'", *new(T), reflect.TypeOf(value))
	}

	return v, nil
}

func numericTypeConverterFunc[T int64 | uint64 | float64](value any) (any, error) {
	v, ok := value.(T)
	if ok {
		return v, nil
	}

	floatValue, ok := value.(float64)
	bigFloat := big.NewFloat(floatValue)
	if !ok {
		stringValue, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("expected type value '%T', but found '%s'", *new(T), reflect.TypeOf(value))
		}

		f, _, err := big.ParseFloat(stringValue, 10, 64, 0)
		if err != nil {
			return nil, fmt.Errorf("expected a %T value, but found invalid string value '%v'", *new(T), value)
		}

		bigFloat = f
	}

	n := *new(T)
	switch any(n).(type) {
	case int64:
		if !bigFloat.IsInt() {
			return nil, fmt.Errorf("expected an int value, but found numeric value '%s'", bigFloat.String())
		}

		numericValue, _ := bigFloat.Int64()
		return numericValue, nil

	case uint64:
		if !bigFloat.IsInt() {
			return nil, fmt.Errorf("expected a uint value, but found numeric value '%s'", bigFloat.String())
		}

		numericValue, _ := bigFloat.Int64()
		if numericValue < 0 {
			return nil, fmt.Errorf("expected a uint value, but found int64 value '%s'", bigFloat.String())
		}
		return uint64(numericValue), nil

	case float64:
		numericValue, a := bigFloat.Float64()
		if a == big.Above || a == big.Below {
			return nil, fmt.Errorf("number cannot be represented as a float64: %s", bigFloat.String())
		}
		return numericValue, nil

	default:
		return nil, fmt.Errorf("unsupported numeric type in numerical parameter type conversion: %T", n)
	}
}

func anyTypeConverterFunc(value any) (any, error) {
	return value, nil
}

func durationTypeConverterFunc(value any) (any, error) {
	v, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("expected a duration string, but found: %T '%v'", value, value)
	}

	d, err := time.ParseDuration(v)
	if err != nil {
		return nil, fmt.Errorf("expected a valid duration string, but found: '%v'", value)
	}

	return d, nil
}

func timestampTypeConverterFunc(value any) (any, error) {
	v, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("expected RFC 3339 formatted timestamp string, but found: %T '%v'", value, value)
	}

	d, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, fmt.Errorf("expected RFC 3339 formatted timestamp string, but found '%s'", v)
	}

	return d, nil
}

func ipaddressTypeConverterFunc(value any) (any, error) {
	ipaddr, ok := value.(IPAddress)
	if ok {
		return ipaddr, nil
	}

	v, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("expected an ipaddress string, but found: %T '%v'", value, value)
	}

	d, err := ParseIPAddress(v)
	if err != nil {
		return nil, fmt.Errorf("expected a well-formed IP address, but found: '%s'", v)
	}

	return d, nil
}
