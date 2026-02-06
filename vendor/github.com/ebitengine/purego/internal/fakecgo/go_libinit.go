// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo && (darwin || freebsd || linux)

package fakecgo

import (
	"syscall"
	"unsafe"
)

var (
	pthread_g pthread_key_t

	runtime_init_cond = PTHREAD_COND_INITIALIZER
	runtime_init_mu   = PTHREAD_MUTEX_INITIALIZER
	runtime_init_done int
)

//go:nosplit
func x_cgo_notify_runtime_init_done() {
	pthread_mutex_lock(&runtime_init_mu)
	runtime_init_done = 1
	pthread_cond_broadcast(&runtime_init_cond)
	pthread_mutex_unlock(&runtime_init_mu)
}

// Store the g into a thread-specific value associated with the pthread key pthread_g.
// And pthread_key_destructor will dropm when the thread is exiting.
func x_cgo_bindm(g unsafe.Pointer) {
	// We assume this will always succeed, otherwise, there might be extra M leaking,
	// when a C thread exits after a cgo call.
	// We only invoke this function once per thread in runtime.needAndBindM,
	// and the next calls just reuse the bound m.
	pthread_setspecific(pthread_g, g)
}

// _cgo_try_pthread_create retries pthread_create if it fails with
// EAGAIN.
//
//go:nosplit
//go:norace
func _cgo_try_pthread_create(thread *pthread_t, attr *pthread_attr_t, pfn unsafe.Pointer, arg *ThreadStart) int {
	var ts syscall.Timespec
	// tries needs to be the same type as syscall.Timespec.Nsec
	// but the fields are int32 on 32bit and int64 on 64bit.
	// tries is assigned to syscall.Timespec.Nsec in order to match its type.
	tries := ts.Nsec
	var err int

	for tries = 0; tries < 20; tries++ {
		// inlined this call because it ran out of stack when inlining was disabled
		err = int(call5(pthread_createABI0, uintptr(unsafe.Pointer(thread)), uintptr(unsafe.Pointer(attr)), uintptr(pfn), uintptr(unsafe.Pointer(arg)), 0))
		if err == 0 {
			// inlined this call because it ran out of stack when inlining was disabled
			call5(pthread_detachABI0, uintptr(*thread), 0, 0, 0, 0)
			return 0
		}
		if err != int(syscall.EAGAIN) {
			return err
		}
		ts.Sec = 0
		ts.Nsec = (tries + 1) * 1000 * 1000 // Milliseconds.
		// inlined this call because it ran out of stack when inlining was disabled
		call5(nanosleepABI0, uintptr(unsafe.Pointer(&ts)), 0, 0, 0, 0)
	}
	return int(syscall.EAGAIN)
}
