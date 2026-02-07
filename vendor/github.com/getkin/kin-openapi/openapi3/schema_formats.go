package openapi3

import (
	"fmt"
	"math"
	"net/netip"
	"regexp"
)

type (
	// FormatValidator is an interface for custom format validators.
	FormatValidator[T any] interface {
		Validate(value T) error
	}
	// StringFormatValidator is a type alias for FormatValidator[string]
	StringFormatValidator = FormatValidator[string]
	// NumberFormatValidator is a type alias for FormatValidator[float64]
	NumberFormatValidator = FormatValidator[float64]
	// IntegerFormatValidator is a type alias for FormatValidator[int64]
	IntegerFormatValidator = FormatValidator[int64]
)

var (
	// SchemaStringFormats is a map of custom string format validators.
	SchemaStringFormats = make(map[string]StringFormatValidator)
	// SchemaNumberFormats is a map of custom number format validators.
	SchemaNumberFormats = make(map[string]NumberFormatValidator)
	// SchemaIntegerFormats is a map of custom integer format validators.
	SchemaIntegerFormats = make(map[string]IntegerFormatValidator)
)

const (
	// FormatOfStringForUUIDOfRFC4122 is an optional predefined format for UUID v1-v5 as specified by RFC4122
	FormatOfStringForUUIDOfRFC4122 = `^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$`

	// FormatOfStringForEmail pattern catches only some suspiciously wrong-looking email addresses.
	// Use DefineStringFormat(...) if you need something stricter.
	FormatOfStringForEmail = `^[^@]+@[^@<>",\s]+$`

	// FormatOfStringByte is a regexp for base64-encoded characters, for example, "U3dhZ2dlciByb2Nrcw=="
	FormatOfStringByte = `(^$|^[a-zA-Z0-9+/\-_]*=*$)`

	// FormatOfStringDate is a RFC3339 date format regexp, for example "2017-07-21".
	FormatOfStringDate = `^[0-9]{4}-(0[1-9]|10|11|12)-(0[1-9]|[12][0-9]|3[01])$`

	// FormatOfStringDateTime is a RFC3339 date-time format regexp, for example "2017-07-21T17:32:28Z".
	FormatOfStringDateTime = `^[0-9]{4}-(0[1-9]|10|11|12)-(0[1-9]|[12][0-9]|3[01])T([0-1][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)[0-9]{2}:[0-9]{2})?$`
)

func init() {
	DefineStringFormatValidator("byte", NewRegexpFormatValidator(FormatOfStringByte))
	DefineStringFormatValidator("date", NewRegexpFormatValidator(FormatOfStringDate))
	DefineStringFormatValidator("date-time", NewRegexpFormatValidator(FormatOfStringDateTime))
	DefineIntegerFormatValidator("int32", NewRangeFormatValidator(int64(math.MinInt32), int64(math.MaxInt32)))
	DefineIntegerFormatValidator("int64", NewRangeFormatValidator(int64(math.MinInt64), int64(math.MaxInt64)))
}

// DefineIPv4Format opts in ipv4 format validation on top of OAS 3 spec
func DefineIPv4Format() {
	DefineStringFormatValidator("ipv4", NewIPValidator(true))
}

// DefineIPv6Format opts in ipv6 format validation on top of OAS 3 spec
func DefineIPv6Format() {
	DefineStringFormatValidator("ipv6", NewIPValidator(false))
}

type stringRegexpFormatValidator struct {
	re *regexp.Regexp
}

func (s stringRegexpFormatValidator) Validate(value string) error {
	if !s.re.MatchString(value) {
		return fmt.Errorf(`string doesn't match pattern "%s"`, s.re.String())
	}
	return nil
}

type callbackValidator[T any] struct {
	fn func(T) error
}

func (c callbackValidator[T]) Validate(value T) error {
	return c.fn(value)
}

type rangeFormat[T int64 | float64] struct {
	min, max T
}

func (r rangeFormat[T]) Validate(value T) error {
	if value < r.min || value > r.max {
		return fmt.Errorf("value should be between %v and %v", r.min, r.max)
	}
	return nil
}

// NewRangeFormatValidator creates a new FormatValidator that validates the value is within a given range.
func NewRangeFormatValidator[T int64 | float64](min, max T) FormatValidator[T] {
	return rangeFormat[T]{min: min, max: max}
}

// NewRegexpFormatValidator creates a new FormatValidator that uses a regular expression to validate the value.
func NewRegexpFormatValidator(pattern string) StringFormatValidator {
	re, err := regexp.Compile(pattern)
	if err != nil {
		err := fmt.Errorf("string regexp format has invalid pattern %q: %w", pattern, err)
		panic(err)
	}
	return stringRegexpFormatValidator{re: re}
}

// NewCallbackValidator creates a new FormatValidator that uses a callback function to validate the value.
func NewCallbackValidator[T any](fn func(T) error) FormatValidator[T] {
	return callbackValidator[T]{fn: fn}
}

// DefineStringFormatValidator defines a custom format validator for a given string format.
func DefineStringFormatValidator(name string, validator StringFormatValidator) {
	SchemaStringFormats[name] = validator
}

// DefineNumberFormatValidator defines a custom format validator for a given number format.
func DefineNumberFormatValidator(name string, validator NumberFormatValidator) {
	SchemaNumberFormats[name] = validator
}

// DefineIntegerFormatValidator defines a custom format validator for a given integer format.
func DefineIntegerFormatValidator(name string, validator IntegerFormatValidator) {
	SchemaIntegerFormats[name] = validator
}

// DefineStringFormat defines a regexp pattern for a given string format
//
// Deprecated: Use openapi3.DefineStringFormatValidator(name, NewRegexpFormatValidator(pattern)) instead.
func DefineStringFormat(name string, pattern string) {
	DefineStringFormatValidator(name, NewRegexpFormatValidator(pattern))
}

// DefineStringFormatCallback defines a callback function for a given string format
//
// Deprecated: Use openapi3.DefineStringFormatValidator(name, NewCallbackValidator(fn)) instead.
func DefineStringFormatCallback(name string, callback func(string) error) {
	DefineStringFormatValidator(name, NewCallbackValidator(callback))
}

// NewIPValidator creates a new FormatValidator that validates the value is an IP address.
func NewIPValidator(isIPv4 bool) FormatValidator[string] {
	return callbackValidator[string]{fn: func(ip string) error {
		addr, err := netip.ParseAddr(ip)
		if err != nil {
			return &SchemaError{
				Value:  ip,
				Reason: "Not an IP address",
			}
		}
		if isIPv4 && !addr.Is4() {
			return &SchemaError{
				Value:  ip,
				Reason: "Not an IPv4 address (it's IPv6)",
			}
		}
		if !isIPv4 && !addr.Is6() {
			return &SchemaError{
				Value:  ip,
				Reason: "Not an IPv6 address (it's IPv4)",
			}
		}
		return nil
	}}
}
