package decimal128

import (
	"encoding/json"
	"reflect"
)

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (d Decimal) MarshalJSON() ([]byte, error) {
	if d.isSpecial() {
		return nil, &json.UnsupportedValueError{
			Value: reflect.ValueOf(d),
			Str:   d.String(),
		}
	}

	var digs digits
	d.digits(&digs)

	prec := 0
	if digs.ndig != 0 {
		prec = digs.ndig - 1
	}

	exp := digs.exp + prec

	if exp < -6 || exp >= 20 {
		return digs.fmtE(nil, prec, 0, false, false, false, false, false, false, 'e'), nil
	}

	prec = 0
	if digs.exp < 0 {
		prec = -digs.exp
	}

	return digs.fmtF(nil, prec, 0, false, false, false, false, false), nil
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (d *Decimal) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		return nil
	}

	l := len(data)

	if l == 0 {
		return nil
	}

	neg := false

	i := 0
	if data[0] == '+' {
		i = 1
	} else if data[0] == '-' {
		neg = true
		i = 1
	}

	tmp, err := parseNumber(data[i:], neg, false)
	if err != nil {
		switch err := err.(type) {
		case parseNumberRangeError:
			return &json.UnmarshalTypeError{
				Value: "number " + string(data),
				Type:  reflect.TypeOf(Decimal{}),
			}
		case parseNumberSyntaxError:
			switch data[0] {
			case '[':
				return &json.UnmarshalTypeError{
					Value: "array",
					Type:  reflect.TypeOf(Decimal{}),
				}
			case '{':
				return &json.UnmarshalTypeError{
					Value: "object",
					Type:  reflect.TypeOf(Decimal{}),
				}
			case 'f', 't':
				return &json.UnmarshalTypeError{
					Value: "bool",
					Type:  reflect.TypeOf(Decimal{}),
				}
			case '"':
				return &json.UnmarshalTypeError{
					Value: "string",
					Type:  reflect.TypeOf(Decimal{}),
				}
			default:
				return &json.UnmarshalTypeError{
					Value: "number " + string(data),
					Type:  reflect.TypeOf(Decimal{}),
				}
			}
		default:
			return err
		}
	}

	*d = tmp
	return nil
}
