package api

import (
	"reflect"
	"time"
)

// getFieldType extracts type of value
func getFieldType(v reflect.Value) reflect.Type {
	t := v.Type()
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
		v = v.Elem()
	}
	if t.Kind() == reflect.Interface && !v.IsNil() {
		t = reflect.ValueOf(v.Interface()).Type()
	}
	return t
}

// timeType is the exact type for the Time
var timeType = reflect.TypeOf(time.Time{})

// validFieldType validates that t is primitive type or string or interface
func validFieldType(t reflect.Type) bool {
	return (t.Kind() > reflect.Invalid && t.Kind() < reflect.Complex64) ||
		t.Kind() == reflect.String ||
		t == timeType
}
