package deref

import (
	"fmt"
	"reflect"
)

func Interface(p any) any {
	if p == nil {
		return nil
	}

	v := reflect.ValueOf(p)

	for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
		if v.IsNil() {
			return nil
		}
		v = v.Elem()
	}

	if v.IsValid() {
		return v.Interface()
	}

	panic(fmt.Sprintf("cannot dereference %v", p))
}

func Type(t reflect.Type) reflect.Type {
	if t == nil {
		return nil
	}
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t
}

func Value(v reflect.Value) reflect.Value {
	for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
		if v.IsNil() {
			return v
		}
		v = v.Elem()
	}
	return v
}

func TypeKind(t reflect.Type, k reflect.Kind) (_ reflect.Type, _ reflect.Kind, changed bool) {
	for k == reflect.Pointer {
		changed = true
		t = t.Elem()
		k = t.Kind()
	}
	return t, k, changed
}
