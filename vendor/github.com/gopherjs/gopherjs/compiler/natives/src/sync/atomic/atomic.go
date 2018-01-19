// +build js

package atomic

import (
	"unsafe"

	"github.com/gopherjs/gopherjs/js"
)

func SwapInt32(addr *int32, new int32) int32 {
	old := *addr
	*addr = new
	return old
}

func SwapInt64(addr *int64, new int64) int64 {
	old := *addr
	*addr = new
	return old
}

func SwapUint32(addr *uint32, new uint32) uint32 {
	old := *addr
	*addr = new
	return old
}

func SwapUint64(addr *uint64, new uint64) uint64 {
	old := *addr
	*addr = new
	return old
}

func SwapUintptr(addr *uintptr, new uintptr) uintptr {
	old := *addr
	*addr = new
	return old
}

func SwapPointer(addr *unsafe.Pointer, new unsafe.Pointer) unsafe.Pointer {
	old := *addr
	*addr = new
	return old
}

func CompareAndSwapInt32(addr *int32, old, new int32) bool {
	if *addr == old {
		*addr = new
		return true
	}
	return false
}

func CompareAndSwapInt64(addr *int64, old, new int64) bool {
	if *addr == old {
		*addr = new
		return true
	}
	return false
}

func CompareAndSwapUint32(addr *uint32, old, new uint32) bool {
	if *addr == old {
		*addr = new
		return true
	}
	return false
}

func CompareAndSwapUint64(addr *uint64, old, new uint64) bool {
	if *addr == old {
		*addr = new
		return true
	}
	return false
}

func CompareAndSwapUintptr(addr *uintptr, old, new uintptr) bool {
	if *addr == old {
		*addr = new
		return true
	}
	return false
}

func CompareAndSwapPointer(addr *unsafe.Pointer, old, new unsafe.Pointer) bool {
	if *addr == old {
		*addr = new
		return true
	}
	return false
}

func AddInt32(addr *int32, delta int32) int32 {
	new := *addr + delta
	*addr = new
	return new
}

func AddUint32(addr *uint32, delta uint32) uint32 {
	new := *addr + delta
	*addr = new
	return new
}

func AddInt64(addr *int64, delta int64) int64 {
	new := *addr + delta
	*addr = new
	return new
}

func AddUint64(addr *uint64, delta uint64) uint64 {
	new := *addr + delta
	*addr = new
	return new
}

func AddUintptr(addr *uintptr, delta uintptr) uintptr {
	new := *addr + delta
	*addr = new
	return new
}

func LoadInt32(addr *int32) int32 {
	return *addr
}

func LoadInt64(addr *int64) int64 {
	return *addr
}

func LoadUint32(addr *uint32) uint32 {
	return *addr
}

func LoadUint64(addr *uint64) uint64 {
	return *addr
}

func LoadUintptr(addr *uintptr) uintptr {
	return *addr
}

func LoadPointer(addr *unsafe.Pointer) unsafe.Pointer {
	return *addr
}

func StoreInt32(addr *int32, val int32) {
	*addr = val
}

func StoreInt64(addr *int64, val int64) {
	*addr = val
}

func StoreUint32(addr *uint32, val uint32) {
	*addr = val
}

func StoreUint64(addr *uint64, val uint64) {
	*addr = val
}

func StoreUintptr(addr *uintptr, val uintptr) {
	*addr = val
}

func StorePointer(addr *unsafe.Pointer, val unsafe.Pointer) {
	*addr = val
}

func (v *Value) Load() (x interface{}) {
	return v.v
}

func (v *Value) Store(x interface{}) {
	if x == nil {
		panic("sync/atomic: store of nil value into Value")
	}
	if v.v != nil && js.InternalObject(x).Get("constructor") != js.InternalObject(v.v).Get("constructor") {
		panic("sync/atomic: store of inconsistently typed value into Value")
	}
	v.v = x
}
