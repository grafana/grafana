// Copyright 2024 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"sync"
	"sync/atomic"
	"unsafe"
)

var (
	int8Mu  sync.Mutex
	int16Mu sync.Mutex
	int32Mu sync.Mutex
	int64Mu sync.Mutex
)

// type __atomic_fetch_add(type *ptr, type val, int memorder)
//
// { tmp = *ptr; *ptr op= val; return tmp; }
// { tmp = *ptr; *ptr = ~(*ptr & val); return tmp; } // nand

func X__c11_atomic_fetch_addInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	return X__atomic_fetch_addInt8(t, ptr, val, 0)
}

func X__atomic_fetch_addInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*int8)(unsafe.Pointer(ptr))
	*(*int8)(unsafe.Pointer(ptr)) += val
	return r
}

func X__c11_atomic_fetch_addUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	return X__atomic_fetch_addUint8(t, ptr, val, 0)
}

func X__atomic_fetch_addUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*uint8)(unsafe.Pointer(ptr))
	*(*uint8)(unsafe.Pointer(ptr)) += val
	return r
}

func X__c11_atomic_fetch_addInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	return X__atomic_fetch_addInt16(t, ptr, val, 0)
}

func X__atomic_fetch_addInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*int16)(unsafe.Pointer(ptr))
	*(*int16)(unsafe.Pointer(ptr)) += val
	return r
}

func X__c11_atomic_fetch_addUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	return X__atomic_fetch_addUint16(t, ptr, val, 0)
}

func X__atomic_fetch_addUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*uint16)(unsafe.Pointer(ptr))
	*(*uint16)(unsafe.Pointer(ptr)) += val
	return r
}

func X__c11_atomic_fetch_addInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	return X__atomic_fetch_addInt32(t, ptr, val, 0)
}

func X__atomic_fetch_addInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*int32)(unsafe.Pointer(ptr))
	*(*int32)(unsafe.Pointer(ptr)) += val
	return r
}

func X__c11_atomic_fetch_addUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	return X__atomic_fetch_addUint32(t, ptr, val, 0)
}

func X__atomic_fetch_addUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*uint32)(unsafe.Pointer(ptr))
	*(*uint32)(unsafe.Pointer(ptr)) += val
	return r
}

func X__c11_atomic_fetch_addInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	return X__atomic_fetch_addInt64(t, ptr, val, 0)
}

func X__atomic_fetch_addInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*int64)(unsafe.Pointer(ptr))
	*(*int64)(unsafe.Pointer(ptr)) += val
	return r
}

func X__c11_atomic_fetch_addUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	return X__atomic_fetch_addUint64(t, ptr, val, 0)
}

func X__atomic_fetch_addUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*uint64)(unsafe.Pointer(ptr))
	*(*uint64)(unsafe.Pointer(ptr)) += val
	return r
}

// ----

func X__c11_atomic_fetch_andInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	return X__atomic_fetch_andInt8(t, ptr, val, 0)
}

func X__atomic_fetch_andInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*int8)(unsafe.Pointer(ptr))
	*(*int8)(unsafe.Pointer(ptr)) &= val
	return r
}

func X__c11_atomic_fetch_andUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	return X__atomic_fetch_andUint8(t, ptr, val, 0)
}

func X__atomic_fetch_andUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*uint8)(unsafe.Pointer(ptr))
	*(*uint8)(unsafe.Pointer(ptr)) &= val
	return r
}

func X__c11_atomic_fetch_andInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	return X__atomic_fetch_andInt16(t, ptr, val, 0)
}

func X__atomic_fetch_andInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*int16)(unsafe.Pointer(ptr))
	*(*int16)(unsafe.Pointer(ptr)) &= val
	return r
}

func X__c11_atomic_fetch_andUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	return X__atomic_fetch_andUint16(t, ptr, val, 0)
}

func X__atomic_fetch_andUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*uint16)(unsafe.Pointer(ptr))
	*(*uint16)(unsafe.Pointer(ptr)) &= val
	return r
}

func X__c11_atomic_fetch_andInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	return X__atomic_fetch_andInt32(t, ptr, val, 0)
}

func X__atomic_fetch_andInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*int32)(unsafe.Pointer(ptr))
	*(*int32)(unsafe.Pointer(ptr)) &= val
	return r
}

func X__c11_atomic_fetch_andUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	return X__atomic_fetch_andUint32(t, ptr, val, 0)
}

func X__atomic_fetch_andUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*uint32)(unsafe.Pointer(ptr))
	*(*uint32)(unsafe.Pointer(ptr)) &= val
	return r
}

func X__c11_atomic_fetch_andInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	return X__atomic_fetch_andInt64(t, ptr, val, 0)
}

func X__atomic_fetch_andInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*int64)(unsafe.Pointer(ptr))
	*(*int64)(unsafe.Pointer(ptr)) &= val
	return r
}

func X__c11_atomic_fetch_andUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	return X__atomic_fetch_andUint64(t, ptr, val, 0)
}

func X__atomic_fetch_andUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*uint64)(unsafe.Pointer(ptr))
	*(*uint64)(unsafe.Pointer(ptr)) &= val
	return r
}

// ----

func X__c11_atomic_fetch_orInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	return X__atomic_fetch_orInt8(t, ptr, val, 0)
}

func X__atomic_fetch_orInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*int8)(unsafe.Pointer(ptr))
	*(*int8)(unsafe.Pointer(ptr)) |= val
	return r
}

func X__c11_atomic_fetch_orUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	return X__atomic_fetch_orUint8(t, ptr, val, 0)
}

func X__atomic_fetch_orUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*uint8)(unsafe.Pointer(ptr))
	*(*uint8)(unsafe.Pointer(ptr)) |= val
	return r
}

func X__c11_atomic_fetch_orInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	return X__atomic_fetch_orInt16(t, ptr, val, 0)
}

func X__atomic_fetch_orInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*int16)(unsafe.Pointer(ptr))
	*(*int16)(unsafe.Pointer(ptr)) |= val
	return r
}

func X__c11_atomic_fetch_orUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	return X__atomic_fetch_orUint16(t, ptr, val, 0)
}

func X__atomic_fetch_orUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*uint16)(unsafe.Pointer(ptr))
	*(*uint16)(unsafe.Pointer(ptr)) |= val
	return r
}

func X__c11_atomic_fetch_orInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	return X__atomic_fetch_orInt32(t, ptr, val, 0)
}

func X__atomic_fetch_orInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*int32)(unsafe.Pointer(ptr))
	*(*int32)(unsafe.Pointer(ptr)) |= val
	return r
}

func X__c11_atomic_fetch_orUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	return X__atomic_fetch_orUint32(t, ptr, val, 0)
}

func X__atomic_fetch_orUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*uint32)(unsafe.Pointer(ptr))
	*(*uint32)(unsafe.Pointer(ptr)) |= val
	return r
}

func X__c11_atomic_fetch_orInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	return X__atomic_fetch_orInt64(t, ptr, val, 0)
}

func X__atomic_fetch_orInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*int64)(unsafe.Pointer(ptr))
	*(*int64)(unsafe.Pointer(ptr)) |= val
	return r
}

func X__c11_atomic_fetch_orUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	return X__atomic_fetch_orUint64(t, ptr, val, 0)
}

func X__atomic_fetch_orUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*uint64)(unsafe.Pointer(ptr))
	*(*uint64)(unsafe.Pointer(ptr)) |= val
	return r
}

// ----

func X__c11_atomic_fetch_subInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	return X__atomic_fetch_subInt8(t, ptr, val, 0)
}

func X__atomic_fetch_subInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*int8)(unsafe.Pointer(ptr))
	*(*int8)(unsafe.Pointer(ptr)) -= val
	return r
}

func X__c11_atomic_fetch_subUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	return X__atomic_fetch_subUint8(t, ptr, val, 0)
}

func X__atomic_fetch_subUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*uint8)(unsafe.Pointer(ptr))
	*(*uint8)(unsafe.Pointer(ptr)) -= val
	return r
}

func X__c11_atomic_fetch_subInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	return X__atomic_fetch_subInt16(t, ptr, val, 0)
}

func X__atomic_fetch_subInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*int16)(unsafe.Pointer(ptr))
	*(*int16)(unsafe.Pointer(ptr)) -= val
	return r
}

func X__c11_atomic_fetch_subUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	return X__atomic_fetch_subUint16(t, ptr, val, 0)
}

func X__atomic_fetch_subUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*uint16)(unsafe.Pointer(ptr))
	*(*uint16)(unsafe.Pointer(ptr)) -= val
	return r
}

func X__c11_atomic_fetch_subInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	return X__atomic_fetch_subInt32(t, ptr, val, 0)
}

func X__atomic_fetch_subInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*int32)(unsafe.Pointer(ptr))
	*(*int32)(unsafe.Pointer(ptr)) -= val
	return r
}

func X__c11_atomic_fetch_subUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	return X__atomic_fetch_subUint32(t, ptr, val, 0)
}

func X__atomic_fetch_subUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*uint32)(unsafe.Pointer(ptr))
	*(*uint32)(unsafe.Pointer(ptr)) -= val
	return r
}

func X__c11_atomic_fetch_subInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	return X__atomic_fetch_subInt64(t, ptr, val, 0)
}

func X__atomic_fetch_subInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*int64)(unsafe.Pointer(ptr))
	*(*int64)(unsafe.Pointer(ptr)) -= val
	return r
}

func X__c11_atomic_fetch_subUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	return X__atomic_fetch_subUint64(t, ptr, val, 0)
}

func X__atomic_fetch_subUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*uint64)(unsafe.Pointer(ptr))
	*(*uint64)(unsafe.Pointer(ptr)) -= val
	return r
}

// ----

func X__c11_atomic_fetch_xorInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	return X__atomic_fetch_xorInt8(t, ptr, val, 0)
}

func X__atomic_fetch_xorInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*int8)(unsafe.Pointer(ptr))
	*(*int8)(unsafe.Pointer(ptr)) ^= val
	return r
}

func X__c11_atomic_fetch_xorUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	return X__atomic_fetch_xorUint8(t, ptr, val, 0)
}

func X__atomic_fetch_xorUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*uint8)(unsafe.Pointer(ptr))
	*(*uint8)(unsafe.Pointer(ptr)) ^= val
	return r
}

func X__c11_atomic_fetch_xorInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	return X__atomic_fetch_xorInt16(t, ptr, val, 0)
}

func X__atomic_fetch_xorInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*int16)(unsafe.Pointer(ptr))
	*(*int16)(unsafe.Pointer(ptr)) ^= val
	return r
}

func X__c11_atomic_fetch_xorUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	return X__atomic_fetch_xorUint16(t, ptr, val, 0)
}

func X__atomic_fetch_xorUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*uint16)(unsafe.Pointer(ptr))
	*(*uint16)(unsafe.Pointer(ptr)) ^= val
	return r
}

func X__c11_atomic_fetch_xorInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	return X__atomic_fetch_xorInt32(t, ptr, val, 0)
}

func X__atomic_fetch_xorInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*int32)(unsafe.Pointer(ptr))
	*(*int32)(unsafe.Pointer(ptr)) ^= val
	return r
}

func X__c11_atomic_fetch_xorUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	return X__atomic_fetch_xorUint32(t, ptr, val, 0)
}

func X__atomic_fetch_xorUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	r = *(*uint32)(unsafe.Pointer(ptr))
	*(*uint32)(unsafe.Pointer(ptr)) ^= val
	return r
}

func X__c11_atomic_fetch_xorInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	return X__atomic_fetch_xorInt64(t, ptr, val, 0)
}

func X__atomic_fetch_xorInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*int64)(unsafe.Pointer(ptr))
	*(*int64)(unsafe.Pointer(ptr)) ^= val
	return r
}

func X__c11_atomic_fetch_xorUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	return X__atomic_fetch_xorUint64(t, ptr, val, 0)
}

func X__atomic_fetch_xorUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	r = *(*uint64)(unsafe.Pointer(ptr))
	*(*uint64)(unsafe.Pointer(ptr)) ^= val
	return r
}

// ----

// void __atomic_exchange (type *ptr, type *val, type *ret, int memorder)

func X__c11_atomic_exchangeInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*int8)(unsafe.Pointer(ptr))
	*(*int8)(unsafe.Pointer(ptr)) = val
	return r
}

func X__atomic_exchangeInt8(t *TLS, ptr, val, ret uintptr, _ int32) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	*(*int8)(unsafe.Pointer(ret)) = *(*int8)(unsafe.Pointer(ptr))
	*(*int8)(unsafe.Pointer(ptr)) = *(*int8)(unsafe.Pointer(val))
}

func X__c11_atomic_exchangeUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	r = *(*uint8)(unsafe.Pointer(ptr))
	*(*uint8)(unsafe.Pointer(ptr)) = val
	return r
}

func X__atomic_exchangeUint8(t *TLS, ptr, val, ret uintptr, _ int32) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	*(*uint8)(unsafe.Pointer(ret)) = *(*uint8)(unsafe.Pointer(ptr))
	*(*uint8)(unsafe.Pointer(ptr)) = *(*uint8)(unsafe.Pointer(val))
}

func X__c11_atomic_exchangeInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*int16)(unsafe.Pointer(ptr))
	*(*int16)(unsafe.Pointer(ptr)) = val
	return r
}

func X__atomic_exchangeInt16(t *TLS, ptr, val, ret uintptr, _ int32) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	*(*int16)(unsafe.Pointer(ret)) = *(*int16)(unsafe.Pointer(ptr))
	*(*int16)(unsafe.Pointer(ptr)) = *(*int16)(unsafe.Pointer(val))
}

func X__c11_atomic_exchangeUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	r = *(*uint16)(unsafe.Pointer(ptr))
	*(*uint16)(unsafe.Pointer(ptr)) = val
	return r
}

func X__atomic_exchangeUint16(t *TLS, ptr, val, ret uintptr, _ int32) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	*(*uint16)(unsafe.Pointer(ret)) = *(*uint16)(unsafe.Pointer(ptr))
	*(*uint16)(unsafe.Pointer(ptr)) = *(*uint16)(unsafe.Pointer(val))
}

func X__c11_atomic_exchangeInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32) {
	return atomic.SwapInt32((*int32)(unsafe.Pointer(ptr)), val)
}

func X__atomic_exchangeInt32(t *TLS, ptr, val, ret uintptr, _ int32) {
	*(*int32)(unsafe.Pointer(ret)) = atomic.SwapInt32((*int32)(unsafe.Pointer(ptr)), *(*int32)(unsafe.Pointer(val)))
}

func X__c11_atomic_exchangeUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32) {
	return uint32(atomic.SwapInt32((*int32)(unsafe.Pointer(ptr)), int32(val)))
}

func X__atomic_exchangeUint32(t *TLS, ptr, val, ret uintptr, _ int32) {
	*(*uint32)(unsafe.Pointer(ret)) = atomic.SwapUint32((*uint32)(unsafe.Pointer(ptr)), *(*uint32)(unsafe.Pointer(val)))
}

func X__c11_atomic_exchangeInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64) {
	return atomic.SwapInt64((*int64)(unsafe.Pointer(ptr)), val)
}

func X__atomic_exchangeInt64(t *TLS, ptr, val, ret uintptr, _ int32) {
	*(*int64)(unsafe.Pointer(ret)) = atomic.SwapInt64((*int64)(unsafe.Pointer(ptr)), *(*int64)(unsafe.Pointer(val)))
}

func X__c11_atomic_exchangeUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64) {
	return uint64(atomic.SwapInt64((*int64)(unsafe.Pointer(ptr)), int64(val)))
}

func X__atomic_exchangeUint64(t *TLS, ptr, val, ret uintptr, _ int32) {
	*(*uint64)(unsafe.Pointer(ret)) = atomic.SwapUint64((*uint64)(unsafe.Pointer(ptr)), *(*uint64)(unsafe.Pointer(val)))
}

// ----

// bool __atomic_compare_exchange (type *ptr, type *expected, type *desired, bool weak, int success_memorder, int failure_memorder)

// https://gcc.gnu.org/onlinedocs/gcc/_005f_005fatomic-Builtins.html
//
// This built-in function implements an atomic compare and exchange operation.
// This compares the contents of *ptr with the contents of *expected. If equal,
// the operation is a read-modify-write operation that writes desired into
// *ptr. If they are not equal, the operation is a read and the current
// contents of *ptr are written into *expected. weak is true for weak
// compare_exchange, which may fail spuriously, and false for the strong
// variation, which never fails spuriously. Many targets only offer the strong
// variation and ignore the parameter. When in doubt, use the strong variation.
//
// If desired is written into *ptr then true is returned and memory is affected
// according to the memory order specified by success_memorder. There are no
// restrictions on what memory order can be used here.
//
// Otherwise, false is returned and memory is affected according to
// failure_memorder. This memory order cannot be __ATOMIC_RELEASE nor
// __ATOMIC_ACQ_REL. It also cannot be a stronger order than that specified by
// success_memorder.

func X__atomic_compare_exchangeInt8(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) int32 {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	have := *(*int8)(unsafe.Pointer(ptr))
	if have == *(*int8)(unsafe.Pointer(expected)) {
		*(*int8)(unsafe.Pointer(ptr)) = *(*int8)(unsafe.Pointer(desired))
		return 1
	}

	*(*int8)(unsafe.Pointer(expected)) = have
	return 0
}

func X__atomic_compare_exchangeUint8(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) int32 {
	return X__atomic_compare_exchangeInt8(t, ptr, expected, desired, weak, success, failure)
}

func X__atomic_compare_exchangeInt16(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) int32 {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	have := *(*int16)(unsafe.Pointer(ptr))
	if have == *(*int16)(unsafe.Pointer(expected)) {
		*(*int16)(unsafe.Pointer(ptr)) = *(*int16)(unsafe.Pointer(desired))
		return 1
	}

	*(*int16)(unsafe.Pointer(expected)) = have
	return 0
}

func X__atomic_compare_exchangeUint16(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) int32 {
	return X__atomic_compare_exchangeInt16(t, ptr, expected, desired, weak, success, failure)
}

func X__atomic_compare_exchangeInt32(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) int32 {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	have := *(*int32)(unsafe.Pointer(ptr))
	if have == *(*int32)(unsafe.Pointer(expected)) {
		*(*int32)(unsafe.Pointer(ptr)) = *(*int32)(unsafe.Pointer(desired))
		return 1
	}

	*(*int32)(unsafe.Pointer(expected)) = have
	return 0
}

func X__atomic_compare_exchangeUint32(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) int32 {
	return X__atomic_compare_exchangeInt32(t, ptr, expected, desired, weak, success, failure)
}

func X__atomic_compare_exchangeInt64(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) int32 {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	have := *(*int64)(unsafe.Pointer(ptr))
	if have == *(*int64)(unsafe.Pointer(expected)) {
		*(*int64)(unsafe.Pointer(ptr)) = *(*int64)(unsafe.Pointer(desired))
		return 1
	}

	*(*int64)(unsafe.Pointer(expected)) = have
	return 0
}

func X__atomic_compare_exchangeUint64(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) int32 {
	return X__atomic_compare_exchangeInt64(t, ptr, expected, desired, weak, success, failure)
}

func X__c11_atomic_compare_exchange_strongInt8(t *TLS, ptr, expected uintptr, desired int8, success, failure int32) int32 {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	have := *(*int8)(unsafe.Pointer(ptr))
	if have == *(*int8)(unsafe.Pointer(expected)) {
		*(*int8)(unsafe.Pointer(ptr)) = desired
		return 1
	}

	*(*int8)(unsafe.Pointer(expected)) = have
	return 0
}

func X__c11_atomic_compare_exchange_strongUint8(t *TLS, ptr, expected uintptr, desired uint8, success, failure int32) int32 {
	return X__c11_atomic_compare_exchange_strongInt8(t, ptr, expected, int8(desired), success, failure)
}

func X__c11_atomic_compare_exchange_strongInt16(t *TLS, ptr, expected uintptr, desired int16, success, failure int32) int32 {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	have := *(*int16)(unsafe.Pointer(ptr))
	if have == *(*int16)(unsafe.Pointer(expected)) {
		*(*int16)(unsafe.Pointer(ptr)) = desired
		return 1
	}

	*(*int16)(unsafe.Pointer(expected)) = have
	return 0
}

func X__c11_atomic_compare_exchange_strongUint16(t *TLS, ptr, expected uintptr, desired uint16, success, failure int32) int32 {
	return X__c11_atomic_compare_exchange_strongInt16(t, ptr, expected, int16(desired), success, failure)
}

func X__c11_atomic_compare_exchange_strongInt32(t *TLS, ptr, expected uintptr, desired, success, failure int32) int32 {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	have := *(*int32)(unsafe.Pointer(ptr))
	if have == *(*int32)(unsafe.Pointer(expected)) {
		*(*int32)(unsafe.Pointer(ptr)) = desired
		return 1
	}

	*(*int32)(unsafe.Pointer(expected)) = have
	return 0
}

func X__c11_atomic_compare_exchange_strongUint32(t *TLS, ptr, expected uintptr, desired uint32, success, failure int32) int32 {
	return X__c11_atomic_compare_exchange_strongInt32(t, ptr, expected, int32(desired), success, failure)
}

func X__c11_atomic_compare_exchange_strongInt64(t *TLS, ptr, expected uintptr, desired int64, success, failure int32) int32 {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	have := *(*int64)(unsafe.Pointer(ptr))
	if have == *(*int64)(unsafe.Pointer(expected)) {
		*(*int64)(unsafe.Pointer(ptr)) = desired
		return 1
	}

	*(*int64)(unsafe.Pointer(expected)) = have
	return 0
}

func X__c11_atomic_compare_exchange_strongUint64(t *TLS, ptr, expected uintptr, desired uint64, success, failure int32) int32 {
	return X__c11_atomic_compare_exchange_strongInt64(t, ptr, expected, int64(desired), success, failure)
}

// ----

// void __atomic_load (type *ptr, type *ret, int memorder)

func X__c11_atomic_loadInt8(t *TLS, ptr uintptr, memorder int32) (r int8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	return *(*int8)(unsafe.Pointer(ptr))
}

func X__atomic_loadInt8(t *TLS, ptr, ret uintptr, memorder int32) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	*(*int8)(unsafe.Pointer(ret)) = *(*int8)(unsafe.Pointer(ptr))
}

func X__c11_atomic_loadUint8(t *TLS, ptr uintptr, memorder int32) (r uint8) {
	return uint8(X__c11_atomic_loadInt8(t, ptr, memorder))
}

func X__atomic_loadUint8(t *TLS, ptr, ret uintptr, memorder int32) {
	X__atomic_loadInt8(t, ptr, ret, memorder)
}

func X__c11_atomic_loadInt16(t *TLS, ptr uintptr, memorder int32) (r int16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	return *(*int16)(unsafe.Pointer(ptr))
}

func X__atomic_loadInt16(t *TLS, ptr, ret uintptr, memorder int32) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	*(*int16)(unsafe.Pointer(ret)) = *(*int16)(unsafe.Pointer(ptr))
}

func X__c11_atomic_loadUint16(t *TLS, ptr uintptr, memorder int32) (r uint16) {
	return uint16(X__c11_atomic_loadInt16(t, ptr, memorder))
}

func X__atomic_loadUint16(t *TLS, ptr, ret uintptr, memorder int32) {
	X__atomic_loadInt16(t, ptr, ret, memorder)
}

func X__c11_atomic_loadInt32(t *TLS, ptr uintptr, memorder int32) (r int32) {
	return atomic.LoadInt32((*int32)(unsafe.Pointer(ptr)))
}

func X__atomic_loadInt32(t *TLS, ptr, ret uintptr, memorder int32) {
	*(*int32)(unsafe.Pointer(ret)) = atomic.LoadInt32((*int32)(unsafe.Pointer(ptr)))
}

func X__c11_atomic_loadUint32(t *TLS, ptr uintptr, memorder int32) (r uint32) {
	return uint32(X__c11_atomic_loadInt32(t, ptr, memorder))
}

func X__atomic_loadUint32(t *TLS, ptr, ret uintptr, memorder int32) {
	X__atomic_loadInt32(t, ptr, ret, memorder)
}

func X__c11_atomic_loadInt64(t *TLS, ptr uintptr, memorder int32) (r int64) {
	return atomic.LoadInt64((*int64)(unsafe.Pointer(ptr)))
}

func X__atomic_loadInt64(t *TLS, ptr, ret uintptr, memorder int32) {
	*(*int64)(unsafe.Pointer(ret)) = atomic.LoadInt64((*int64)(unsafe.Pointer(ptr)))
}

func X__c11_atomic_loadUint64(t *TLS, ptr uintptr, memorder int32) (r uint64) {
	return uint64(X__c11_atomic_loadInt64(t, ptr, memorder))
}

func X__atomic_loadUint64(t *TLS, ptr, ret uintptr, memorder int32) {
	X__atomic_loadInt64(t, ptr, ret, memorder)
}

// ----

// void __atomic_store (type *ptr, type *val, int memorder)

func X__c11_atomic_storeInt8(t *TLS, ptr uintptr, val int8, memorder int32) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	*(*int8)(unsafe.Pointer(ptr)) = val
}

func X__atomic_storeInt8(t *TLS, ptr, val uintptr, memorder int32) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	*(*int8)(unsafe.Pointer(ptr)) = *(*int8)(unsafe.Pointer(val))
}

func X__c11_atomic_storeUint8(t *TLS, ptr uintptr, val uint8, memorder int32) {
	X__c11_atomic_storeInt8(t, ptr, int8(val), memorder)
}

func X__atomic_storeUint8(t *TLS, ptr, val uintptr, memorder int32) {
	X__atomic_storeInt8(t, ptr, val, memorder)
}

func X__c11_atomic_storeInt16(t *TLS, ptr uintptr, val int16, memorder int32) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	*(*int16)(unsafe.Pointer(ptr)) = val
}

func X__atomic_storeInt16(t *TLS, ptr, val uintptr, memorder int32) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	*(*int16)(unsafe.Pointer(ptr)) = *(*int16)(unsafe.Pointer(val))
}

func X__c11_atomic_storeUint16(t *TLS, ptr uintptr, val uint16, memorder int32) {
	X__c11_atomic_storeInt16(t, ptr, int16(val), memorder)
}

func X__atomic_storeUint16(t *TLS, ptr, val uintptr, memorder int32) {
	X__atomic_storeInt16(t, ptr, val, memorder)
}

func X__c11_atomic_storeInt32(t *TLS, ptr uintptr, val int32, memorder int32) {
	atomic.StoreInt32((*int32)(unsafe.Pointer(ptr)), val)
}

func X__atomic_storeInt32(t *TLS, ptr, val uintptr, memorder int32) {
	atomic.StoreInt32((*int32)(unsafe.Pointer(ptr)), *(*int32)(unsafe.Pointer(val)))
}

func X__c11_atomic_storeUint32(t *TLS, ptr uintptr, val uint32, memorder int32) {
	X__c11_atomic_storeInt32(t, ptr, int32(val), memorder)
}

func X__atomic_storeUint32(t *TLS, ptr, val uintptr, memorder int32) {
	X__atomic_storeInt32(t, ptr, val, memorder)
}

func X__c11_atomic_storeInt64(t *TLS, ptr uintptr, val int64, memorder int32) {
	atomic.StoreInt64((*int64)(unsafe.Pointer(ptr)), val)
}

func X__atomic_storeInt64(t *TLS, ptr, val uintptr, memorder int32) {
	atomic.StoreInt64((*int64)(unsafe.Pointer(ptr)), *(*int64)(unsafe.Pointer(val)))
}

func X__c11_atomic_storeUint64(t *TLS, ptr uintptr, val uint64, memorder int32) {
	X__c11_atomic_storeInt64(t, ptr, int64(val), memorder)
}

func X__atomic_storeUint64(t *TLS, ptr, val uintptr, memorder int32) {
	X__atomic_storeInt64(t, ptr, val, memorder)
}

// type __sync_val_compare_and_swap (type *ptr, type oldval type newval, ...)
func X__sync_val_compare_and_swapInt8(t *TLS, ptr uintptr, oldval, newval int8) (r int8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	if r = *(*int8)(unsafe.Pointer(ptr)); r == oldval {
		*(*int8)(unsafe.Pointer(ptr)) = newval
	}

	return r
}

func X__sync_val_compare_and_swapUint8(t *TLS, ptr uintptr, oldval, newval uint8) (r uint8) {
	int8Mu.Lock()

	defer int8Mu.Unlock()

	if r = *(*uint8)(unsafe.Pointer(ptr)); r == oldval {
		*(*uint8)(unsafe.Pointer(ptr)) = newval
	}

	return r
}

func X__sync_val_compare_and_swapInt16(t *TLS, ptr uintptr, oldval, newval int16) (r int16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	if r = *(*int16)(unsafe.Pointer(ptr)); r == oldval {
		*(*int16)(unsafe.Pointer(ptr)) = newval
	}

	return r
}

func X__sync_val_compare_and_swapUint16(t *TLS, ptr uintptr, oldval, newval uint16) (r uint16) {
	int16Mu.Lock()

	defer int16Mu.Unlock()

	if r = *(*uint16)(unsafe.Pointer(ptr)); r == oldval {
		*(*uint16)(unsafe.Pointer(ptr)) = newval
	}

	return r
}

func X__sync_val_compare_and_swapInt32(t *TLS, ptr uintptr, oldval, newval int32) (r int32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	if r = *(*int32)(unsafe.Pointer(ptr)); r == oldval {
		*(*int32)(unsafe.Pointer(ptr)) = newval
	}

	return r
}

func X__sync_val_compare_and_swapUint32(t *TLS, ptr uintptr, oldval, newval uint32) (r uint32) {
	int32Mu.Lock()

	defer int32Mu.Unlock()

	if r = *(*uint32)(unsafe.Pointer(ptr)); r == oldval {
		*(*uint32)(unsafe.Pointer(ptr)) = newval
	}

	return r
}

func X__sync_val_compare_and_swapInt64(t *TLS, ptr uintptr, oldval, newval int64) (r int64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	if r = *(*int64)(unsafe.Pointer(ptr)); r == oldval {
		*(*int64)(unsafe.Pointer(ptr)) = newval
	}

	return r
}

func X__sync_val_compare_and_swapUint64(t *TLS, ptr uintptr, oldval, newval uint64) (r uint64) {
	int64Mu.Lock()

	defer int64Mu.Unlock()

	if r = *(*uint64)(unsafe.Pointer(ptr)); r == oldval {
		*(*uint64)(unsafe.Pointer(ptr)) = newval
	}

	return r
}
