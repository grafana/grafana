// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package validate

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"unicode/utf8"

	"github.com/go-openapi/errors"
	"github.com/go-openapi/strfmt"
	"github.com/go-openapi/swag/conv"
)

type valueError string

func (e valueError) Error() string {
	return string(e)
}

// ErrValue indicates that a value validation occurred
const ErrValue valueError = "value validation error"

// Enum validates if the data is a member of the enum
func Enum(path, in string, data any, enum any) *errors.Validation {
	return EnumCase(path, in, data, enum, true)
}

// EnumCase validates if the data is a member of the enum and may respect case-sensitivity for strings
func EnumCase(path, in string, data any, enum any, caseSensitive bool) *errors.Validation {
	val := reflect.ValueOf(enum)
	if val.Kind() != reflect.Slice {
		return nil
	}

	dataString := convertEnumCaseStringKind(data, caseSensitive)
	values := make([]any, 0, val.Len())
	for i := range val.Len() {
		ele := val.Index(i)
		enumValue := ele.Interface()
		if data != nil {
			if reflect.DeepEqual(data, enumValue) {
				return nil
			}
			enumString := convertEnumCaseStringKind(enumValue, caseSensitive)
			if dataString != nil && enumString != nil && strings.EqualFold(*dataString, *enumString) {
				return nil
			}
			actualType := reflect.TypeOf(enumValue)
			if actualType == nil { // Safeguard. Frankly, I don't know how we may get a nil
				continue
			}
			expectedValue := reflect.ValueOf(data)
			if expectedValue.IsValid() && expectedValue.Type().ConvertibleTo(actualType) {
				// Attempt comparison after type conversion
				if reflect.DeepEqual(expectedValue.Convert(actualType).Interface(), enumValue) {
					return nil
				}
			}
		}
		values = append(values, enumValue)
	}
	return errors.EnumFail(path, in, data, values)
}

// convertEnumCaseStringKind converts interface if it is kind of string and case insensitivity is set
func convertEnumCaseStringKind(value any, caseSensitive bool) *string {
	if caseSensitive {
		return nil
	}

	val := reflect.ValueOf(value)
	if val.Kind() != reflect.String {
		return nil
	}

	str := fmt.Sprintf("%v", value)
	return &str
}

// MinItems validates that there are at least n items in a slice
func MinItems(path, in string, size, minimum int64) *errors.Validation {
	if size < minimum {
		return errors.TooFewItems(path, in, minimum, size)
	}
	return nil
}

// MaxItems validates that there are at most n items in a slice
func MaxItems(path, in string, size, maximum int64) *errors.Validation {
	if size > maximum {
		return errors.TooManyItems(path, in, maximum, size)
	}
	return nil
}

// UniqueItems validates that the provided slice has unique elements
func UniqueItems(path, in string, data any) *errors.Validation {
	val := reflect.ValueOf(data)
	if val.Kind() != reflect.Slice {
		return nil
	}
	unique := make([]any, 0, val.Len())
	for i := range val.Len() {
		v := val.Index(i).Interface()
		for _, u := range unique {
			if reflect.DeepEqual(v, u) {
				return errors.DuplicateItems(path, in)
			}
		}
		unique = append(unique, v)
	}
	return nil
}

// MinLength validates a string for minimum length
func MinLength(path, in, data string, minLength int64) *errors.Validation {
	strLen := int64(utf8.RuneCountInString(data))
	if strLen < minLength {
		return errors.TooShort(path, in, minLength, data)
	}
	return nil
}

// MaxLength validates a string for maximum length
func MaxLength(path, in, data string, maxLength int64) *errors.Validation {
	strLen := int64(utf8.RuneCountInString(data))
	if strLen > maxLength {
		return errors.TooLong(path, in, maxLength, data)
	}
	return nil
}

// ReadOnly validates an interface for readonly
func ReadOnly(ctx context.Context, path, in string, data any) *errors.Validation {

	// read only is only validated when operationType is request
	if op := extractOperationType(ctx); op != request {
		return nil
	}

	// data must be of zero value of its type
	val := reflect.ValueOf(data)
	if val.IsValid() {
		if reflect.DeepEqual(reflect.Zero(val.Type()).Interface(), val.Interface()) {
			return nil
		}
	} else {
		return nil
	}

	return errors.ReadOnly(path, in, data)
}

// Required validates an interface for requiredness
func Required(path, in string, data any) *errors.Validation {
	val := reflect.ValueOf(data)
	if val.IsValid() {
		if reflect.DeepEqual(reflect.Zero(val.Type()).Interface(), val.Interface()) {
			return errors.Required(path, in, data)
		}
		return nil
	}
	return errors.Required(path, in, data)
}

// RequiredString validates a string for requiredness
func RequiredString(path, in, data string) *errors.Validation {
	if data == "" {
		return errors.Required(path, in, data)
	}
	return nil
}

// RequiredNumber validates a number for requiredness
func RequiredNumber(path, in string, data float64) *errors.Validation {
	if data == 0 {
		return errors.Required(path, in, data)
	}
	return nil
}

// Pattern validates a string against a regular expression
func Pattern(path, in, data, pattern string) *errors.Validation {
	re, err := compileRegexp(pattern)
	if err != nil {
		return errors.FailedPattern(path, in, fmt.Sprintf("%s, but pattern is invalid: %s", pattern, err.Error()), data)
	}
	if !re.MatchString(data) {
		return errors.FailedPattern(path, in, pattern, data)
	}
	return nil
}

// MaximumInt validates if a number is smaller than a given maximum
func MaximumInt(path, in string, data, maximum int64, exclusive bool) *errors.Validation {
	if (!exclusive && data > maximum) || (exclusive && data >= maximum) {
		return errors.ExceedsMaximumInt(path, in, maximum, exclusive, data)
	}
	return nil
}

// MaximumUint validates if a number is smaller than a given maximum
func MaximumUint(path, in string, data, maximum uint64, exclusive bool) *errors.Validation {
	if (!exclusive && data > maximum) || (exclusive && data >= maximum) {
		return errors.ExceedsMaximumUint(path, in, maximum, exclusive, data)
	}
	return nil
}

// Maximum validates if a number is smaller than a given maximum
func Maximum(path, in string, data, maximum float64, exclusive bool) *errors.Validation {
	if (!exclusive && data > maximum) || (exclusive && data >= maximum) {
		return errors.ExceedsMaximum(path, in, maximum, exclusive, data)
	}
	return nil
}

// Minimum validates if a number is smaller than a given minimum
func Minimum(path, in string, data, minimum float64, exclusive bool) *errors.Validation {
	if (!exclusive && data < minimum) || (exclusive && data <= minimum) {
		return errors.ExceedsMinimum(path, in, minimum, exclusive, data)
	}
	return nil
}

// MinimumInt validates if a number is smaller than a given minimum
func MinimumInt(path, in string, data, minimum int64, exclusive bool) *errors.Validation {
	if (!exclusive && data < minimum) || (exclusive && data <= minimum) {
		return errors.ExceedsMinimumInt(path, in, minimum, exclusive, data)
	}
	return nil
}

// MinimumUint validates if a number is smaller than a given minimum
func MinimumUint(path, in string, data, minimum uint64, exclusive bool) *errors.Validation {
	if (!exclusive && data < minimum) || (exclusive && data <= minimum) {
		return errors.ExceedsMinimumUint(path, in, minimum, exclusive, data)
	}
	return nil
}

// MultipleOf validates if the provided number is a multiple of the factor
func MultipleOf(path, in string, data, factor float64) *errors.Validation {
	// multipleOf factor must be positive
	if factor <= 0 {
		return errors.MultipleOfMustBePositive(path, in, factor)
	}
	var mult float64
	if factor < 1 {
		mult = 1 / factor * data
	} else {
		mult = data / factor
	}
	if !conv.IsFloat64AJSONInteger(mult) {
		return errors.NotMultipleOf(path, in, factor, data)
	}
	return nil
}

// MultipleOfInt validates if the provided integer is a multiple of the factor
func MultipleOfInt(path, in string, data int64, factor int64) *errors.Validation {
	// multipleOf factor must be positive
	if factor <= 0 {
		return errors.MultipleOfMustBePositive(path, in, factor)
	}
	mult := data / factor
	if mult*factor != data {
		return errors.NotMultipleOf(path, in, factor, data)
	}
	return nil
}

// MultipleOfUint validates if the provided unsigned integer is a multiple of the factor
func MultipleOfUint(path, in string, data, factor uint64) *errors.Validation {
	// multipleOf factor must be positive
	if factor == 0 {
		return errors.MultipleOfMustBePositive(path, in, factor)
	}
	mult := data / factor
	if mult*factor != data {
		return errors.NotMultipleOf(path, in, factor, data)
	}
	return nil
}

// FormatOf validates if a string matches a format in the format registry
func FormatOf(path, in, format, data string, registry strfmt.Registry) *errors.Validation {
	if registry == nil {
		registry = strfmt.Default
	}
	if ok := registry.ContainsName(format); !ok {
		return errors.InvalidTypeName(format)
	}
	if ok := registry.Validates(format, data); !ok {
		return errors.InvalidType(path, in, format, data)
	}
	return nil
}

// MaximumNativeType provides native type constraint validation as a facade
// to various numeric types versions of Maximum constraint check.
//
// Assumes that any possible loss conversion during conversion has been
// checked beforehand.
//
// NOTE: currently, the max value is marshalled as a float64, no matter what,
// which means there may be a loss during conversions (e.g. for very large integers)
//
// TODO: Normally, a JSON MAX_SAFE_INTEGER check would ensure conversion remains loss-free
func MaximumNativeType(path, in string, val any, maximum float64, exclusive bool) *errors.Validation {
	kind := reflect.ValueOf(val).Type().Kind()
	switch kind { //nolint:exhaustive
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		value := valueHelp.asInt64(val)
		return MaximumInt(path, in, value, int64(maximum), exclusive)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		value := valueHelp.asUint64(val)
		if maximum < 0 {
			return errors.ExceedsMaximum(path, in, maximum, exclusive, val)
		}
		return MaximumUint(path, in, value, uint64(maximum), exclusive)
	case reflect.Float32, reflect.Float64:
		fallthrough
	default:
		value := valueHelp.asFloat64(val)
		return Maximum(path, in, value, maximum, exclusive)
	}
}

// MinimumNativeType provides native type constraint validation as a facade
// to various numeric types versions of Minimum constraint check.
//
// Assumes that any possible loss conversion during conversion has been
// checked beforehand.
//
// NOTE: currently, the min value is marshalled as a float64, no matter what,
// which means there may be a loss during conversions (e.g. for very large integers)
//
// TODO: Normally, a JSON MAX_SAFE_INTEGER check would ensure conversion remains loss-free
func MinimumNativeType(path, in string, val any, minimum float64, exclusive bool) *errors.Validation {
	kind := reflect.ValueOf(val).Type().Kind()
	switch kind { //nolint:exhaustive
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		value := valueHelp.asInt64(val)
		return MinimumInt(path, in, value, int64(minimum), exclusive)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		value := valueHelp.asUint64(val)
		if minimum < 0 {
			return nil
		}
		return MinimumUint(path, in, value, uint64(minimum), exclusive)
	case reflect.Float32, reflect.Float64:
		fallthrough
	default:
		value := valueHelp.asFloat64(val)
		return Minimum(path, in, value, minimum, exclusive)
	}
}

// MultipleOfNativeType provides native type constraint validation as a facade
// to various numeric types version of MultipleOf constraint check.
//
// Assumes that any possible loss conversion during conversion has been
// checked beforehand.
//
// NOTE: currently, the multipleOf factor is marshalled as a float64, no matter what,
// which means there may be a loss during conversions (e.g. for very large integers)
//
// TODO: Normally, a JSON MAX_SAFE_INTEGER check would ensure conversion remains loss-free
func MultipleOfNativeType(path, in string, val any, multipleOf float64) *errors.Validation {
	kind := reflect.ValueOf(val).Type().Kind()
	switch kind { //nolint:exhaustive
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		value := valueHelp.asInt64(val)
		return MultipleOfInt(path, in, value, int64(multipleOf))
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		value := valueHelp.asUint64(val)
		return MultipleOfUint(path, in, value, uint64(multipleOf))
	case reflect.Float32, reflect.Float64:
		fallthrough
	default:
		value := valueHelp.asFloat64(val)
		return MultipleOf(path, in, value, multipleOf)
	}
}

// IsValueValidAgainstRange checks that a numeric value is compatible with
// the range defined by Type and Format, that is, may be converted without loss.
//
// NOTE: this check is about type capacity and not formal verification such as: 1.0 != 1L
func IsValueValidAgainstRange(val any, typeName, format, prefix, path string) error {
	kind := reflect.ValueOf(val).Type().Kind()

	// What is the string representation of val
	var stringRep string
	switch kind { //nolint:exhaustive
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		stringRep = conv.FormatUinteger(valueHelp.asUint64(val))
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		stringRep = conv.FormatInteger(valueHelp.asInt64(val))
	case reflect.Float32, reflect.Float64:
		stringRep = conv.FormatFloat(valueHelp.asFloat64(val))
	default:
		return fmt.Errorf("%s value number range checking called with invalid (non numeric) val type in %s: %w", prefix, path, ErrValue)
	}

	var errVal error

	switch typeName {
	case integerType:
		switch format {
		case integerFormatInt32:
			_, errVal = conv.ConvertInt32(stringRep)
		case integerFormatUInt32:
			_, errVal = conv.ConvertUint32(stringRep)
		case integerFormatUInt64:
			_, errVal = conv.ConvertUint64(stringRep)
		case integerFormatInt64:
			fallthrough
		default:
			_, errVal = conv.ConvertInt64(stringRep)
		}
	case numberType:
		fallthrough
	default:
		switch format {
		case numberFormatFloat, numberFormatFloat32:
			_, errVal = conv.ConvertFloat32(stringRep)
		case numberFormatDouble, numberFormatFloat64:
			fallthrough
		default:
			// No check can be performed here since
			// no number beyond float64 is supported
		}
	}
	if errVal != nil { // We don't report the actual errVal from strconv
		if format != "" {
			errVal = fmt.Errorf("%s value must be of type %s with format %s in %s: %w", prefix, typeName, format, path, ErrValue)
		} else {
			errVal = fmt.Errorf("%s value must be of type %s (default format) in %s: %w", prefix, typeName, path, ErrValue)
		}
	}
	return errVal
}
