package ieproxy

import (
	"golang.org/x/sys/windows"
	"unsafe"
)

var kernel32 = windows.NewLazySystemDLL("kernel32.dll")
var globalFree = kernel32.NewProc("GlobalFree")

func globalFreeWrapper(ptr *uint16) {
	if ptr != nil {
		_, _, _ = globalFree.Call(uintptr(unsafe.Pointer(ptr)))
	}
}

func rTrue(r uintptr) bool {
	return r == 1
}
