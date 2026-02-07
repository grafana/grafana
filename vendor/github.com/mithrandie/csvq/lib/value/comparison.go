package value

import (
	"errors"
	"math"
	"strings"
	"time"

	"github.com/mithrandie/csvq/lib/option"

	"github.com/mithrandie/ternary"
)

type ComparisonResult int

const (
	IsEqual ComparisonResult = iota
	IsBoolEqual
	IsNotEqual
	IsLess
	IsGreater
	IsIncommensurable
)

var comparisonResultLiterals = map[ComparisonResult]string{
	IsEqual:           "IsEqual",
	IsBoolEqual:       "IsBoolEqual",
	IsNotEqual:        "IsNotEqual",
	IsLess:            "IsLess",
	IsGreater:         "IsGreater",
	IsIncommensurable: "IsIncommensurable",
}

func (cr ComparisonResult) String() string {
	return comparisonResultLiterals[cr]
}

func compareInteger(v1 int64, v2 int64) ComparisonResult {
	if v1 == v2 {
		return IsEqual
	}
	if v1 < v2 {
		return IsLess
	}
	return IsGreater
}

func compareFloat(v1 float64, v2 float64) ComparisonResult {
	if math.IsNaN(v1) || math.IsNaN(v2) {
		return IsNotEqual
	}

	if v1 == v2 {
		return IsEqual
	}
	if v1 < v2 {
		return IsLess
	}
	return IsGreater
}

func CompareCombinedly(p1 Primary, p2 Primary, datetimeFormats []string, location *time.Location) ComparisonResult {
	if IsNull(p1) || IsNull(p2) {
		return IsIncommensurable
	}

	if i1 := ToIntegerStrictly(p1); !IsNull(i1) {
		if i2 := ToIntegerStrictly(p2); !IsNull(i2) {
			v1 := i1.(*Integer).Raw()
			v2 := i2.(*Integer).Raw()
			Discard(i1)
			Discard(i2)

			return compareInteger(v1, v2)
		}
		Discard(i1)
	}

	if f1 := ToFloat(p1); !IsNull(f1) {
		if f2 := ToFloat(p2); !IsNull(f2) {
			v1 := f1.(*Float).Raw()
			v2 := f2.(*Float).Raw()
			Discard(f1)
			Discard(f2)

			return compareFloat(v1, v2)
		}
		Discard(f1)
	}

	if d1 := ToDatetime(p1, datetimeFormats, location); !IsNull(d1) {
		if d2 := ToDatetime(p2, datetimeFormats, location); !IsNull(d2) {
			v1 := d1.(*Datetime).Raw()
			v2 := d2.(*Datetime).Raw()
			Discard(d1)
			Discard(d2)

			if v1.Equal(v2) {
				return IsEqual
			} else if v1.Before(v2) {
				return IsLess
			}
			return IsGreater
		}
		Discard(d1)
	}

	if b1 := ToBoolean(p1); !IsNull(b1) {
		if b2 := ToBoolean(p2); !IsNull(b2) {
			if b1.(*Boolean).Raw() == b2.(*Boolean).Raw() {
				return IsBoolEqual
			}
			return IsNotEqual
		}
	}

	if s1, ok := p1.(*String); ok {
		if s2, ok := p2.(*String); ok {
			v1 := strings.ToUpper(option.TrimSpace(s1.Raw()))
			v2 := strings.ToUpper(option.TrimSpace(s2.Raw()))

			if v1 == v2 {
				return IsEqual
			} else if v1 < v2 {
				return IsLess
			}
			return IsGreater
		}
	}

	return IsIncommensurable
}

func Identical(p1 Primary, p2 Primary) ternary.Value {
	if t, ok := p1.(*Ternary); (ok && t.value == ternary.UNKNOWN) || IsNull(p1) {
		return ternary.UNKNOWN
	}
	if t, ok := p2.(*Ternary); (ok && t.value == ternary.UNKNOWN) || IsNull(p2) {
		return ternary.UNKNOWN
	}

	if v1, ok := p1.(*Integer); ok {
		if v2, ok := p2.(*Integer); ok {
			return ternary.ConvertFromBool(v1.value == v2.value)
		}
	}

	if v1, ok := p1.(*Float); ok {
		if v2, ok := p2.(*Float); ok {
			return ternary.ConvertFromBool(v1.value == v2.value)
		}
	}

	if v1, ok := p1.(*Datetime); ok {
		if v2, ok := p2.(*Datetime); ok {
			return ternary.ConvertFromBool(v1.value.Equal(v2.value))
		}
	}

	if v1, ok := p1.(*Boolean); ok {
		if v2, ok := p2.(*Boolean); ok {
			return ternary.ConvertFromBool(v1.value == v2.value)
		}
	}

	if v1, ok := p1.(*Ternary); ok {
		if v2, ok := p2.(*Ternary); ok {
			return ternary.ConvertFromBool(v1.value == v2.value)
		}
	}

	if v1, ok := p1.(*String); ok {
		if v2, ok := p2.(*String); ok {
			return ternary.ConvertFromBool(v1.literal == v2.literal)
		}
	}

	return ternary.FALSE
}

func Equal(p1 Primary, p2 Primary, datetimeFormats []string, location *time.Location) ternary.Value {
	if r := CompareCombinedly(p1, p2, datetimeFormats, location); r != IsIncommensurable {
		return ternary.ConvertFromBool(r == IsEqual || r == IsBoolEqual)
	}
	return ternary.UNKNOWN
}

func NotEqual(p1 Primary, p2 Primary, datetimeFormats []string, location *time.Location) ternary.Value {
	if r := CompareCombinedly(p1, p2, datetimeFormats, location); r != IsIncommensurable {
		return ternary.ConvertFromBool(r != IsEqual && r != IsBoolEqual)
	}
	return ternary.UNKNOWN
}

func Less(p1 Primary, p2 Primary, datetimeFormats []string, location *time.Location) ternary.Value {
	if r := CompareCombinedly(p1, p2, datetimeFormats, location); r != IsIncommensurable && r != IsNotEqual && r != IsBoolEqual {
		return ternary.ConvertFromBool(r == IsLess)
	}
	return ternary.UNKNOWN
}

func Greater(p1 Primary, p2 Primary, datetimeFormats []string, location *time.Location) ternary.Value {
	if r := CompareCombinedly(p1, p2, datetimeFormats, location); r != IsIncommensurable && r != IsNotEqual && r != IsBoolEqual {
		return ternary.ConvertFromBool(r == IsGreater)
	}
	return ternary.UNKNOWN
}

func LessOrEqual(p1 Primary, p2 Primary, datetimeFormats []string, location *time.Location) ternary.Value {
	if r := CompareCombinedly(p1, p2, datetimeFormats, location); r != IsIncommensurable && r != IsNotEqual && r != IsBoolEqual {
		return ternary.ConvertFromBool(r != IsGreater)
	}
	return ternary.UNKNOWN
}

func GreaterOrEqual(p1 Primary, p2 Primary, datetimeFormats []string, location *time.Location) ternary.Value {
	if r := CompareCombinedly(p1, p2, datetimeFormats, location); r != IsIncommensurable && r != IsNotEqual && r != IsBoolEqual {
		return ternary.ConvertFromBool(r != IsLess)
	}
	return ternary.UNKNOWN
}

func Compare(p1 Primary, p2 Primary, operator string, datetimeFormats []string, location *time.Location) ternary.Value {
	switch operator {
	case "=":
		return Equal(p1, p2, datetimeFormats, location)
	case "==":
		return Identical(p1, p2)
	case ">":
		return Greater(p1, p2, datetimeFormats, location)
	case "<":
		return Less(p1, p2, datetimeFormats, location)
	case ">=":
		return GreaterOrEqual(p1, p2, datetimeFormats, location)
	case "<=":
		return LessOrEqual(p1, p2, datetimeFormats, location)
	default: //case "<>", "!=":
		return NotEqual(p1, p2, datetimeFormats, location)
	}
}

func CompareRowValues(rowValue1 RowValue, rowValue2 RowValue, operator string, datetimeFormats []string, location *time.Location) (ternary.Value, error) {
	if rowValue1 == nil || rowValue2 == nil {
		return ternary.UNKNOWN, nil
	}

	if len(rowValue1) != len(rowValue2) {
		return ternary.FALSE, errors.New("row value length does not match")
	}

	unknown := false
	for i := 0; i < len(rowValue1); i++ {
		if operator == "==" {
			t := Identical(rowValue1[i], rowValue2[i])
			if t == ternary.FALSE {
				return ternary.FALSE, nil
			}
			if t == ternary.UNKNOWN {
				unknown = true
			}
			continue
		}

		r := CompareCombinedly(rowValue1[i], rowValue2[i], datetimeFormats, location)

		if r == IsIncommensurable {
			switch operator {
			case "=", "<>", "!=":
				if i < len(rowValue1)-1 {
					unknown = true
					continue
				}
			}

			return ternary.UNKNOWN, nil
		}

		switch operator {
		case ">", "<", ">=", "<=":
			if r == IsNotEqual || r == IsBoolEqual {
				return ternary.UNKNOWN, nil
			}
		}

		switch operator {
		case "=":
			if r != IsEqual && r != IsBoolEqual {
				return ternary.FALSE, nil
			}
		case ">", ">=":
			switch r {
			case IsGreater:
				return ternary.TRUE, nil
			case IsLess:
				return ternary.FALSE, nil
			}
		case "<", "<=":
			switch r {
			case IsLess:
				return ternary.TRUE, nil
			case IsGreater:
				return ternary.FALSE, nil
			}
		case "<>", "!=":
			if r != IsEqual && r != IsBoolEqual {
				return ternary.TRUE, nil
			}
		}
	}

	if unknown {
		return ternary.UNKNOWN, nil
	}

	switch operator {
	case ">", "<", "<>", "!=":
		return ternary.FALSE, nil
	}
	return ternary.TRUE, nil
}

func Equivalent(p1 Primary, p2 Primary, datetimeFormats []string, location *time.Location) ternary.Value {
	if IsNull(p1) && IsNull(p2) {
		return ternary.TRUE
	}
	return Equal(p1, p2, datetimeFormats, location)
}
