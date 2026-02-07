//go:build !go1.20
// +build !go1.20

package json

import (
	"reflect"
	"unsafe"
)

//go:linkname unsafe_NewArray reflect.unsafe_NewArray
func unsafe_NewArray(rtype unsafe.Pointer, length int) unsafe.Pointer

//go:linkname typedslicecopy reflect.typedslicecopy
//go:noescape
func typedslicecopy(elemType unsafe.Pointer, dst, src slice) int

func extendSlice(t reflect.Type, s *slice, n int) slice {
	elemTypeRef := t.Elem()
	elemTypePtr := ((*iface)(unsafe.Pointer(&elemTypeRef))).ptr

	d := slice{
		data: unsafe_NewArray(elemTypePtr, n),
		len:  s.len,
		cap:  n,
	}

	typedslicecopy(elemTypePtr, d, *s)
	return d
}
