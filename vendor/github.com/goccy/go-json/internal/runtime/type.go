package runtime

import (
	"reflect"
	"sync"
	"unsafe"
)

type SliceHeader struct {
	Data unsafe.Pointer
	Len  int
	Cap  int
}

const (
	maxAcceptableTypeAddrRange = 1024 * 1024 * 2 // 2 Mib
)

type TypeAddr struct {
	BaseTypeAddr uintptr
	MaxTypeAddr  uintptr
	AddrRange    uintptr
	AddrShift    uintptr
}

var (
	typeAddr *TypeAddr
	once     sync.Once
)

//go:linkname typelinks reflect.typelinks
func typelinks() ([]unsafe.Pointer, [][]int32)

//go:linkname rtypeOff reflect.rtypeOff
func rtypeOff(unsafe.Pointer, int32) unsafe.Pointer

func AnalyzeTypeAddr() *TypeAddr {
	once.Do(func() {
		sections, offsets := typelinks()
		if len(sections) != 1 {
			return
		}
		if len(offsets) != 1 {
			return
		}
		section := sections[0]
		offset := offsets[0]
		var (
			min         uintptr = uintptr(^uint(0))
			max         uintptr = 0
			isAligned64         = true
			isAligned32         = true
		)
		for i := 0; i < len(offset); i++ {
			typ := (*Type)(rtypeOff(section, offset[i]))
			addr := uintptr(unsafe.Pointer(typ))
			if min > addr {
				min = addr
			}
			if max < addr {
				max = addr
			}
			if typ.Kind() == reflect.Ptr {
				addr = uintptr(unsafe.Pointer(typ.Elem()))
				if min > addr {
					min = addr
				}
				if max < addr {
					max = addr
				}
			}
			isAligned64 = isAligned64 && (addr-min)&63 == 0
			isAligned32 = isAligned32 && (addr-min)&31 == 0
		}
		addrRange := max - min
		if addrRange == 0 {
			return
		}
		var addrShift uintptr
		if isAligned64 {
			addrShift = 6
		} else if isAligned32 {
			addrShift = 5
		}
		cacheSize := addrRange >> addrShift
		if cacheSize > maxAcceptableTypeAddrRange {
			return
		}
		typeAddr = &TypeAddr{
			BaseTypeAddr: min,
			MaxTypeAddr:  max,
			AddrRange:    addrRange,
			AddrShift:    addrShift,
		}
	})

	return typeAddr
}
