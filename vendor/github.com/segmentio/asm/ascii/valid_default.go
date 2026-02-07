//go:build purego || !amd64
// +build purego !amd64

package ascii

import (
	"unsafe"
)

// ValidString returns true if s contains only ASCII characters.
func ValidString(s string) bool {
	p := *(*unsafe.Pointer)(unsafe.Pointer(&s))
	i := uintptr(0)
	n := uintptr(len(s))

	for i+8 <= n {
		if (*(*uint64)(unsafe.Pointer(uintptr(p) + i)) & 0x8080808080808080) != 0 {
			return false
		}
		i += 8
	}

	if i+4 <= n {
		if (*(*uint32)(unsafe.Pointer(uintptr(p) + i)) & 0x80808080) != 0 {
			return false
		}
		i += 4
	}

	if i == n {
		return true
	}

	p = unsafe.Pointer(uintptr(p) + i)

	var x uint32
	switch n - i {
	case 3:
		x = uint32(*(*uint16)(p)) | uint32(*(*uint8)(unsafe.Pointer(uintptr(p) + 2)))<<16
	case 2:
		x = uint32(*(*uint16)(p))
	case 1:
		x = uint32(*(*uint8)(p))
	default:
		return true
	}
	return (x & 0x80808080) == 0
}
