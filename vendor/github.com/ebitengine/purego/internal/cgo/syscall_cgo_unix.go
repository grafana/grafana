// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build freebsd || (linux && !(arm64 || amd64))

package cgo

// this file is placed inside internal/cgo and not package purego
// because Cgo and assembly files can't be in the same package.

/*
 #cgo LDFLAGS: -ldl

#include <stdint.h>
#include <dlfcn.h>
#include <errno.h>
#include <assert.h>

typedef struct syscall15Args {
	uintptr_t fn;
	uintptr_t a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15;
	uintptr_t f1, f2, f3, f4, f5, f6, f7, f8;
	uintptr_t err;
} syscall15Args;

void syscall15(struct syscall15Args *args) {
	assert((args->f1|args->f2|args->f3|args->f4|args->f5|args->f6|args->f7|args->f8) == 0);
	uintptr_t (*func_name)(uintptr_t a1, uintptr_t a2, uintptr_t a3, uintptr_t a4, uintptr_t a5, uintptr_t a6,
		uintptr_t a7, uintptr_t a8, uintptr_t a9, uintptr_t a10, uintptr_t a11, uintptr_t a12,
		uintptr_t a13, uintptr_t a14, uintptr_t a15);
	*(void**)(&func_name) = (void*)(args->fn);
	uintptr_t r1 =  func_name(args->a1,args->a2,args->a3,args->a4,args->a5,args->a6,args->a7,args->a8,args->a9,
		args->a10,args->a11,args->a12,args->a13,args->a14,args->a15);
	args->a1 = r1;
	args->err = errno;
}

*/
import "C"
import "unsafe"

// assign purego.syscall15XABI0 to the C version of this function.
var Syscall15XABI0 = unsafe.Pointer(C.syscall15)

//go:nosplit
func Syscall15X(fn, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15 uintptr) (r1, r2, err uintptr) {
	args := C.syscall15Args{
		C.uintptr_t(fn), C.uintptr_t(a1), C.uintptr_t(a2), C.uintptr_t(a3),
		C.uintptr_t(a4), C.uintptr_t(a5), C.uintptr_t(a6),
		C.uintptr_t(a7), C.uintptr_t(a8), C.uintptr_t(a9), C.uintptr_t(a10), C.uintptr_t(a11), C.uintptr_t(a12),
		C.uintptr_t(a13), C.uintptr_t(a14), C.uintptr_t(a15), 0, 0, 0, 0, 0, 0, 0, 0, 0,
	}
	C.syscall15(&args)
	return uintptr(args.a1), 0, uintptr(args.err)
}
