package render

import (
	"reflect"
	"time"
)

func renderTime(value reflect.Value) (string, bool) {
	if instant, ok := convertTime(value); !ok {
		return "", false
	} else if instant.IsZero() {
		return "0", true
	} else {
		return instant.String(), true
	}
}

func convertTime(value reflect.Value) (t time.Time, ok bool) {
	if value.Type() == timeType {
		defer func() { recover() }()
		t, ok = value.Interface().(time.Time)
	}
	return
}

var timeType = reflect.TypeOf(time.Time{})
