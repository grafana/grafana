package ieproxy

import (
	"unicode/utf16"
	"unsafe"
)

// StringFromUTF16Ptr converts a *uint16 C string to a Go String
func StringFromUTF16Ptr(s *uint16) string {
	if s == nil {
		return ""
	}

	p := (*[1<<30 - 1]uint16)(unsafe.Pointer(s))

	// find the string length
	sz := 0
	for p[sz] != 0 {
		sz++
	}

	return string(utf16.Decode(p[:sz:sz]))
}
