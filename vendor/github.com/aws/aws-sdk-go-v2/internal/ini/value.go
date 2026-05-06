package ini

import (
	"fmt"
	"strconv"
	"strings"
)

// ValueType is an enum that will signify what type
// the Value is
type ValueType int

func (v ValueType) String() string {
	switch v {
	case NoneType:
		return "NONE"
	case StringType:
		return "STRING"
	}

	return ""
}

// ValueType enums
const (
	NoneType = ValueType(iota)
	StringType
	QuotedStringType
)

// Value is a union container
type Value struct {
	Type ValueType

	str string
	mp  map[string]string
}

// NewStringValue returns a Value type generated using a string input.
func NewStringValue(str string) (Value, error) {
	return Value{str: str}, nil
}

func (v Value) String() string {
	switch v.Type {
	case StringType:
		return fmt.Sprintf("string: %s", string(v.str))
	case QuotedStringType:
		return fmt.Sprintf("quoted string: %s", string(v.str))
	default:
		return "union not set"
	}
}

// MapValue returns a map value for sub properties
func (v Value) MapValue() map[string]string {
	return v.mp
}

// IntValue returns an integer value
func (v Value) IntValue() (int64, bool) {
	i, err := strconv.ParseInt(string(v.str), 0, 64)
	if err != nil {
		return 0, false
	}
	return i, true
}

// FloatValue returns a float value
func (v Value) FloatValue() (float64, bool) {
	f, err := strconv.ParseFloat(string(v.str), 64)
	if err != nil {
		return 0, false
	}
	return f, true
}

// BoolValue returns a bool value
func (v Value) BoolValue() (bool, bool) {
	// we don't use ParseBool as it recognizes more than what we've
	// historically supported
	if strings.EqualFold(v.str, "true") {
		return true, true
	} else if strings.EqualFold(v.str, "false") {
		return false, true
	}
	return false, false
}

// StringValue returns the string value
func (v Value) StringValue() string {
	return v.str
}
