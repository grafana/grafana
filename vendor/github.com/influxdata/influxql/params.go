package influxql

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Value represents a value that can be bound
// to a parameter when parsing the query.
type Value interface {
	TokenType() Token
	Value() string
}

type (
	// Identifier is an identifier value.
	Identifier string

	// StringValue is a string literal.
	StringValue string

	// RegexValue is a regexp literal.
	RegexValue string

	// NumberValue is a number literal.
	NumberValue float64

	// IntegerValue is an integer literal.
	IntegerValue int64

	// BooleanValue is a boolean literal.
	BooleanValue bool

	// DurationValue is a duration literal.
	DurationValue string

	// ErrorValue is a special value that returns an error during parsing
	// when it is used.
	ErrorValue string
)

// BindValue will bind an interface value to its influxql value.
// This method of binding values only supports literals.
func BindValue(v interface{}) Value {
	if jv, ok := v.(json.Number); ok {
		var err error
		v, err = jsonNumberToValue(jv)
		if err != nil {
			return ErrorValue(err.Error())
		}
	}

	switch v := v.(type) {
	case float64:
		return NumberValue(v)
	case int64:
		return IntegerValue(v)
	case string:
		return StringValue(v)
	case bool:
		return BooleanValue(v)
	case map[string]interface{}:
		return bindObjectValue(v)
	default:
		s := fmt.Sprintf("unable to bind parameter with type %T", v)
		return ErrorValue(s)
	}
}

// bindObjectValue will bind an object to a value.
func bindObjectValue(m map[string]interface{}) Value {
	if len(m) != 1 {
		return ErrorValue("bound object parameter value must have exactly one entry")
	}

	var (
		k string
		v interface{}
	)
	for k, v = range m {
		// Nothing done here.
	}

	if jv, ok := v.(json.Number); ok {
		var err error
		v, err = jsonNumberToValue(jv)
		if err != nil {
			return ErrorValue(err.Error())
		}
	}

	switch k {
	case "ident", "identifier":
		s, ok := v.(string)
		if !ok {
			return ErrorValue("identifier must be a string value")
		}
		return Identifier(s)
	case "regex":
		s, ok := v.(string)
		if !ok {
			return ErrorValue("regex literal must be a string value")
		}
		return RegexValue(s)
	case "string":
		s, ok := v.(string)
		if !ok {
			return ErrorValue("string literal must be a string value")
		}
		return StringValue(s)
	case "float", "number":
		switch f := v.(type) {
		case float64:
			return NumberValue(f)
		case int64:
			return NumberValue(f)
		default:
			return ErrorValue("number literal must be a float value")
		}
	case "int", "integer":
		i, ok := v.(int64)
		if !ok {
			return ErrorValue("integer literal must be an integer value")
		}
		return IntegerValue(i)
	case "duration":
		switch d := v.(type) {
		case string:
			return DurationValue(d)
		case int64:
			return DurationValue(FormatDuration(time.Duration(d)))
		default:
			return ErrorValue("duration literal must be a string or integer value")
		}
	default:
		return ErrorValue(fmt.Sprintf("unknown bind object type: %s", k))
	}
}

func (v Identifier) TokenType() Token   { return IDENT }
func (v Identifier) Value() string      { return string(v) }
func (v StringValue) TokenType() Token  { return STRING }
func (v StringValue) Value() string     { return string(v) }
func (v RegexValue) TokenType() Token   { return REGEX }
func (v RegexValue) Value() string      { return string(v) }
func (v NumberValue) TokenType() Token  { return NUMBER }
func (v NumberValue) Value() string     { return strconv.FormatFloat(float64(v), 'f', -1, 64) }
func (v IntegerValue) TokenType() Token { return INTEGER }
func (v IntegerValue) Value() string    { return strconv.FormatInt(int64(v), 10) }
func (v BooleanValue) TokenType() Token {
	if v {
		return TRUE
	} else {
		return FALSE
	}
}
func (v BooleanValue) Value() string     { return "" }
func (v DurationValue) TokenType() Token { return DURATIONVAL }
func (v DurationValue) Value() string    { return string(v) }
func (e ErrorValue) TokenType() Token    { return BOUNDPARAM }
func (e ErrorValue) Value() string       { return string(e) }

func jsonNumberToValue(v json.Number) (interface{}, error) {
	if strings.Contains(string(v), ".") {
		f, err := v.Float64()
		if err != nil {
			return nil, err
		}
		return f, nil
	} else {
		i, err := v.Int64()
		if err != nil {
			return nil, err
		}
		return i, nil
	}
}
