package gomock

import (
	"fmt"
	"reflect"
)

// getString is a safe way to convert a value to a string for printing results
// If the value is a a mock, getString avoids calling the mocked String() method,
// which avoids potential deadlocks
func getString(x any) string {
	if isGeneratedMock(x) {
		return fmt.Sprintf("%T", x)
	}
	if s, ok := x.(fmt.Stringer); ok {
		return s.String()
	}
	return fmt.Sprintf("%v", x)
}

// isGeneratedMock checks if the given type has a "isgomock" field,
// indicating it is a generated mock.
func isGeneratedMock(x any) bool {
	typ := reflect.TypeOf(x)
	if typ == nil {
		return false
	}
	if typ.Kind() == reflect.Ptr {
		typ = typ.Elem()
	}
	if typ.Kind() != reflect.Struct {
		return false
	}
	_, isgomock := typ.FieldByName("isgomock")
	return isgomock
}
