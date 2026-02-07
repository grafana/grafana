//go:build purego || !amd64
// +build purego !amd64

package ascii

import "unsafe"

// ValidString returns true if s contains only printable ASCII characters.
func ValidPrintString(s string) bool {
	p := *(*unsafe.Pointer)(unsafe.Pointer(&s))
	i := uintptr(0)
	n := uintptr(len(s))

	for i+8 <= n {
		if hasLess64(*(*uint64)(unsafe.Pointer(uintptr(p) + i)), 0x20) || hasMore64(*(*uint64)(unsafe.Pointer(uintptr(p) + i)), 0x7e) {
			return false
		}
		i += 8
	}

	if i+4 <= n {
		if hasLess32(*(*uint32)(unsafe.Pointer(uintptr(p) + i)), 0x20) || hasMore32(*(*uint32)(unsafe.Pointer(uintptr(p) + i)), 0x7e) {
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
		x = 0x20000000 | uint32(*(*uint16)(p)) | uint32(*(*uint8)(unsafe.Pointer(uintptr(p) + 2)))<<16
	case 2:
		x = 0x20200000 | uint32(*(*uint16)(p))
	case 1:
		x = 0x20202000 | uint32(*(*uint8)(p))
	default:
		return true
	}
	return !(hasLess32(x, 0x20) || hasMore32(x, 0x7e))
}
