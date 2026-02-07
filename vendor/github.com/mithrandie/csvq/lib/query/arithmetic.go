package query

import (
	"errors"
	"math"

	"github.com/mithrandie/csvq/lib/value"
)

var errIntegerDevidedByZero = errors.New("integer devided by zero")

func Calculate(p1 value.Primary, p2 value.Primary, operator int) (value.Primary, error) {
	if i1 := value.ToIntegerStrictly(p1); !value.IsNull(i1) {
		if i2 := value.ToIntegerStrictly(p2); !value.IsNull(i2) {
			val1 := i1.(*value.Integer).Raw()
			val2 := i2.(*value.Integer).Raw()

			value.Discard(i1)
			value.Discard(i2)
			return calculateInteger(val1, val2, operator)
		}
		value.Discard(i1)
	}

	if f1 := value.ToFloat(p1); !value.IsNull(f1) {
		if f2 := value.ToFloat(p2); !value.IsNull(f2) {
			val1 := f1.(*value.Float).Raw()
			val2 := f2.(*value.Float).Raw()

			value.Discard(f1)
			value.Discard(f2)
			return calculateFloat(val1, val2, operator), nil
		}
		value.Discard(f1)
	}

	return value.NewNull(), nil
}

func calculateInteger(i1 int64, i2 int64, operator int) (value.Primary, error) {
	var result int64 = 0
	switch operator {
	case '+':
		result = i1 + i2
	case '-':
		result = i1 - i2
	case '*':
		result = i1 * i2
	case '/':
		if i2 == 0 {
			return nil, errIntegerDevidedByZero
		}
		result = i1 / i2
	case '%':
		if i2 == 0 {
			return nil, errIntegerDevidedByZero
		}
		result = i1 % i2
	}

	return value.NewInteger(result), nil
}

func calculateFloat(f1 float64, f2 float64, operator int) value.Primary {
	result := 0.0
	switch operator {
	case '+':
		result = f1 + f2
	case '-':
		result = f1 - f2
	case '*':
		result = f1 * f2
	case '/':
		result = f1 / f2
	case '%':
		result = math.Remainder(f1, f2)
	}

	return value.NewFloat(result)
}
