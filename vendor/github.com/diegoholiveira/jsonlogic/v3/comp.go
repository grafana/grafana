package jsonlogic

import (
	"reflect"
)

type undefinedType struct{}

// at simulate undefined in javascript
func at(values []any, index int) any {
	if index >= 0 && index < len(values) {
		return values[index]
	}
	return undefinedType{}
}

// less reference javascript implementation
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Less_than#description
func less(a, b any) bool {
	// If both values are strings, they are compared as strings,
	// based on the values of the Unicode code points they contain.
	if isString(a) && isString(b) {
		return toString(b) > toString(a)
	}

	// Otherwise the values are compared as numeric values.
	return toNumberFromAny(b) > toNumberFromAny(a)
}

func hardEquals(a, b any) bool {
	ra := reflect.ValueOf(a).Kind()
	rb := reflect.ValueOf(b).Kind()

	if ra != rb {
		return false
	}

	return equals(a, b)
}

func equals(a, b any) bool {
	// comparison to a nil value is falsy
	if a == nil || b == nil {
		// if a and b is nil, return true, else return falsy
		return a == b
	}

	if isString(a) && isString(b) {
		return a == b
	}

	return toNumberFromAny(a) == toNumberFromAny(b)
}
