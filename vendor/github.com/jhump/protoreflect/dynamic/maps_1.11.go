//go:build !go1.12
// +build !go1.12

package dynamic

import (
	"reflect"

	"github.com/jhump/protoreflect/desc"
)

// Pre-Go-1.12, we must use reflect.Value.MapKeys to reflectively
// iterate a map. (We can be more efficient in Go 1.12 and up...)

func mapsEqual(a, b reflect.Value) bool {
	if a.Len() != b.Len() {
		return false
	}
	if a.Len() == 0 && b.Len() == 0 {
		// Optimize the case where maps are frequently empty because MapKeys()
		// function allocates heavily.
		return true
	}

	for _, k := range a.MapKeys() {
		av := a.MapIndex(k)
		bv := b.MapIndex(k)
		if !bv.IsValid() {
			return false
		}
		if !fieldsEqual(av.Interface(), bv.Interface()) {
			return false
		}
	}
	return true
}

func validFieldValueForMapField(fd *desc.FieldDescriptor, val reflect.Value) (interface{}, error) {
	// make a defensive copy while we check the contents
	// (also converts to map[interface{}]interface{} if it's some other type)
	keyField := fd.GetMessageType().GetFields()[0]
	valField := fd.GetMessageType().GetFields()[1]
	m := map[interface{}]interface{}{}
	for _, k := range val.MapKeys() {
		if k.Kind() == reflect.Interface {
			// unwrap it
			k = reflect.ValueOf(k.Interface())
		}
		kk, err := validElementFieldValueForRv(keyField, k, false)
		if err != nil {
			return nil, err
		}
		v := val.MapIndex(k)
		if v.Kind() == reflect.Interface {
			// unwrap it
			v = reflect.ValueOf(v.Interface())
		}
		vv, err := validElementFieldValueForRv(valField, v, true)
		if err != nil {
			return nil, err
		}
		m[kk] = vv
	}
	return m, nil
}

func canConvertMap(src reflect.Value, target reflect.Type) bool {
	kt := target.Key()
	vt := target.Elem()
	for _, k := range src.MapKeys() {
		if !canConvert(k, kt) {
			return false
		}
		if !canConvert(src.MapIndex(k), vt) {
			return false
		}
	}
	return true
}

func mergeMapVal(src, target reflect.Value, targetType reflect.Type, deterministic bool) error {
	tkt := targetType.Key()
	tvt := targetType.Elem()
	for _, k := range src.MapKeys() {
		v := src.MapIndex(k)
		skt := k.Type()
		svt := v.Type()
		var nk, nv reflect.Value
		if tkt == skt {
			nk = k
		} else if tkt.Kind() == reflect.Ptr && tkt.Elem() == skt {
			nk = k.Addr()
		} else {
			nk = reflect.New(tkt).Elem()
			if err := mergeVal(k, nk, deterministic); err != nil {
				return err
			}
		}
		if tvt == svt {
			nv = v
		} else if tvt.Kind() == reflect.Ptr && tvt.Elem() == svt {
			nv = v.Addr()
		} else {
			nv = reflect.New(tvt).Elem()
			if err := mergeVal(v, nv, deterministic); err != nil {
				return err
			}
		}
		if target.IsNil() {
			target.Set(reflect.MakeMap(targetType))
		}
		target.SetMapIndex(nk, nv)
	}
	return nil
}

func mergeMapField(m *Message, fd *desc.FieldDescriptor, rv reflect.Value) error {
	for _, k := range rv.MapKeys() {
		if k.Kind() == reflect.Interface && !k.IsNil() {
			k = k.Elem()
		}
		v := rv.MapIndex(k)
		if v.Kind() == reflect.Interface && !v.IsNil() {
			v = v.Elem()
		}
		if err := m.putMapField(fd, k.Interface(), v.Interface()); err != nil {
			return err
		}
	}
	return nil
}
