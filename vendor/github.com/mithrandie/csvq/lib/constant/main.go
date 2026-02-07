package constant

import (
	"errors"
	"strings"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"
)

var ErrInvalidType = errors.New("invalid constant type")
var ErrUndefined = errors.New("constant is not defined")

func Get(expr parser.Constant) (value.Primary, error) {
	if m, ok := Definition[strings.ToUpper(expr.Space)]; ok {
		if c, ok := m[strings.ToUpper(expr.Name)]; ok {
			return ConvertConstantToPrivamryValue(c)
		}
	}
	return nil, ErrUndefined
}

func ConvertConstantToPrivamryValue(c interface{}) (value.Primary, error) {
	switch v := c.(type) {
	case int64:
		return value.NewInteger(v), nil
	case float64:
		return value.NewFloat(v), nil
	default:
		return nil, ErrInvalidType
	}
}

func Count() int {
	count := 0

	for _, v := range Definition {
		count = count + len(v)
	}

	return count
}
