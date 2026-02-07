// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo && (darwin || freebsd || linux)

package fakecgo

import "unsafe"

// _cgo_thread_start is split into three parts in cgo since only one part is system dependent (keep it here for easier handling)

// _cgo_thread_start(ThreadStart *arg) (runtime/cgo/gcc_util.c)
// This get's called instead of the go code for creating new threads
// -> pthread_* stuff is used, so threads are setup correctly for C
// If this is missing, TLS is only setup correctly on thread 1!
// This function should be go:systemstack instead of go:nosplit (but that requires runtime)
//
//go:nosplit
//go:norace
func x_cgo_thread_start(arg *ThreadStart) {
	var ts *ThreadStart
	// Make our own copy that can persist after we return.
	//	_cgo_tsan_acquire();
	ts = (*ThreadStart)(malloc(unsafe.Sizeof(*ts)))
	//	_cgo_tsan_release();
	if ts == nil {
		println("fakecgo: out of memory in thread_start")
		abort()
	}
	// *ts = *arg would cause a writebarrier so copy using slices
	s1 := unsafe.Slice((*uintptr)(unsafe.Pointer(ts)), unsafe.Sizeof(*ts)/8)
	s2 := unsafe.Slice((*uintptr)(unsafe.Pointer(arg)), unsafe.Sizeof(*arg)/8)
	for i := range s2 {
		s1[i] = s2[i]
	}
	_cgo_sys_thread_start(ts) // OS-dependent half
}
