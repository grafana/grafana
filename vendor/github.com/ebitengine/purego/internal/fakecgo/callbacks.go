// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !cgo && (darwin || freebsd || linux)

package fakecgo

import (
	_ "unsafe"
)

// TODO: decide if we need _runtime_cgo_panic_internal

//go:linkname x_cgo_init_trampoline x_cgo_init_trampoline
//go:linkname _cgo_init _cgo_init
var x_cgo_init_trampoline byte
var _cgo_init = &x_cgo_init_trampoline

// Creates a new system thread without updating any Go state.
//
// This method is invoked during shared library loading to create a new OS
// thread to perform the runtime initialization. This method is similar to
// _cgo_sys_thread_start except that it doesn't update any Go state.

//go:linkname x_cgo_thread_start_trampoline x_cgo_thread_start_trampoline
//go:linkname _cgo_thread_start _cgo_thread_start
var x_cgo_thread_start_trampoline byte
var _cgo_thread_start = &x_cgo_thread_start_trampoline

// Notifies that the runtime has been initialized.
//
// We currently block at every CGO entry point (via _cgo_wait_runtime_init_done)
// to ensure that the runtime has been initialized before the CGO call is
// executed. This is necessary for shared libraries where we kickoff runtime
// initialization in a separate thread and return without waiting for this
// thread to complete the init.

//go:linkname x_cgo_notify_runtime_init_done_trampoline x_cgo_notify_runtime_init_done_trampoline
//go:linkname _cgo_notify_runtime_init_done _cgo_notify_runtime_init_done
var x_cgo_notify_runtime_init_done_trampoline byte
var _cgo_notify_runtime_init_done = &x_cgo_notify_runtime_init_done_trampoline

// Indicates whether a dummy thread key has been created or not.
//
// When calling go exported function from C, we register a destructor
// callback, for a dummy thread key, by using pthread_key_create.

//go:linkname _cgo_pthread_key_created _cgo_pthread_key_created
var x_cgo_pthread_key_created uintptr
var _cgo_pthread_key_created = &x_cgo_pthread_key_created

// Set the x_crosscall2_ptr C function pointer variable point to crosscall2.
// It's for the runtime package to call at init time.
func set_crosscall2() {
	// nothing needs to be done here for fakecgo
	// because it's possible to just call cgocallback directly
}

//go:linkname _set_crosscall2 runtime.set_crosscall2
var _set_crosscall2 = set_crosscall2

// Store the g into the thread-specific value.
// So that pthread_key_destructor will dropm when the thread is exiting.

//go:linkname x_cgo_bindm_trampoline x_cgo_bindm_trampoline
//go:linkname _cgo_bindm _cgo_bindm
var x_cgo_bindm_trampoline byte
var _cgo_bindm = &x_cgo_bindm_trampoline

// TODO: decide if we need x_cgo_set_context_function
// TODO: decide if we need _cgo_yield

var (
	// In Go 1.20 the race detector was rewritten to pure Go
	// on darwin. This means that when CGO_ENABLED=0 is set
	// fakecgo is built with race detector code. This is not
	// good since this code is pretending to be C. The go:norace
	// pragma is not enough, since it only applies to the native
	// ABIInternal function. The ABIO wrapper (which is necessary,
	// since all references to text symbols from assembly will use it)
	// does not inherit the go:norace pragma, so it will still be
	// instrumented by the race detector.
	//
	// To circumvent this issue, using closure calls in the
	// assembly, which forces the compiler to use the ABIInternal
	// native implementation (which has go:norace) instead.
	threadentry_call        = threadentry
	x_cgo_init_call         = x_cgo_init
	x_cgo_setenv_call       = x_cgo_setenv
	x_cgo_unsetenv_call     = x_cgo_unsetenv
	x_cgo_thread_start_call = x_cgo_thread_start
)
