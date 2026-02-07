package unsafebytes

import "unsafe"

func Pointer(b []byte) *byte {
	return *(**byte)(unsafe.Pointer(&b))
}

func String(b []byte) string {
	return *(*string)(unsafe.Pointer(&b))
}

func BytesOf(s string) []byte {
	return *(*[]byte)(unsafe.Pointer(&sliceHeader{str: s, cap: len(s)}))
}

type sliceHeader struct {
	str string
	cap int
}
