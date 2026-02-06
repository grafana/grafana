package pgtype

import (
	"reflect"
)

func NullAssignTo(dst any) error {
	dstPtr := reflect.ValueOf(dst)

	// AssignTo dst must always be a pointer
	if dstPtr.Kind() != reflect.Ptr {
		return &nullAssignmentError{dst: dst}
	}

	dstVal := dstPtr.Elem()

	switch dstVal.Kind() {
	case reflect.Ptr, reflect.Slice, reflect.Map:
		dstVal.Set(reflect.Zero(dstVal.Type()))
		return nil
	}

	return &nullAssignmentError{dst: dst}
}

var kindTypes map[reflect.Kind]reflect.Type

func toInterface(dst reflect.Value, t reflect.Type) (any, bool) {
	nextDst := dst.Convert(t)
	return nextDst.Interface(), dst.Type() != nextDst.Type()
}

// GetAssignToDstType attempts to convert dst to something AssignTo can assign
// to. If dst is a pointer to pointer it allocates a value and returns the
// dereferences pointer. If dst is a named type such as *Foo where Foo is type
// Foo int16, it converts dst to *int16.
//
// GetAssignToDstType returns the converted dst and a bool representing if any
// change was made.
func GetAssignToDstType(dst any) (any, bool) {
	dstPtr := reflect.ValueOf(dst)

	// AssignTo dst must always be a pointer
	if dstPtr.Kind() != reflect.Ptr {
		return nil, false
	}

	dstVal := dstPtr.Elem()

	// if dst is a pointer to pointer, allocate space try again with the dereferenced pointer
	if dstVal.Kind() == reflect.Ptr {
		dstVal.Set(reflect.New(dstVal.Type().Elem()))
		return dstVal.Interface(), true
	}

	// if dst is pointer to a base type that has been renamed
	if baseValType, ok := kindTypes[dstVal.Kind()]; ok {
		return toInterface(dstPtr, reflect.PtrTo(baseValType))
	}

	if dstVal.Kind() == reflect.Slice {
		if baseElemType, ok := kindTypes[dstVal.Type().Elem().Kind()]; ok {
			return toInterface(dstPtr, reflect.PtrTo(reflect.SliceOf(baseElemType)))
		}
	}

	if dstVal.Kind() == reflect.Array {
		if baseElemType, ok := kindTypes[dstVal.Type().Elem().Kind()]; ok {
			return toInterface(dstPtr, reflect.PtrTo(reflect.ArrayOf(dstVal.Len(), baseElemType)))
		}
	}

	if dstVal.Kind() == reflect.Struct {
		if dstVal.Type().NumField() == 1 && dstVal.Type().Field(0).Anonymous {
			dstPtr = dstVal.Field(0).Addr()
			nested := dstVal.Type().Field(0).Type
			if nested.Kind() == reflect.Array {
				if baseElemType, ok := kindTypes[nested.Elem().Kind()]; ok {
					return toInterface(dstPtr, reflect.PtrTo(reflect.ArrayOf(nested.Len(), baseElemType)))
				}
			}
			if _, ok := kindTypes[nested.Kind()]; ok && dstPtr.CanInterface() {
				return dstPtr.Interface(), true
			}
		}
	}

	return nil, false
}

func init() {
	kindTypes = map[reflect.Kind]reflect.Type{
		reflect.Bool:    reflect.TypeOf(false),
		reflect.Float32: reflect.TypeOf(float32(0)),
		reflect.Float64: reflect.TypeOf(float64(0)),
		reflect.Int:     reflect.TypeOf(int(0)),
		reflect.Int8:    reflect.TypeOf(int8(0)),
		reflect.Int16:   reflect.TypeOf(int16(0)),
		reflect.Int32:   reflect.TypeOf(int32(0)),
		reflect.Int64:   reflect.TypeOf(int64(0)),
		reflect.Uint:    reflect.TypeOf(uint(0)),
		reflect.Uint8:   reflect.TypeOf(uint8(0)),
		reflect.Uint16:  reflect.TypeOf(uint16(0)),
		reflect.Uint32:  reflect.TypeOf(uint32(0)),
		reflect.Uint64:  reflect.TypeOf(uint64(0)),
		reflect.String:  reflect.TypeOf(""),
	}
}
