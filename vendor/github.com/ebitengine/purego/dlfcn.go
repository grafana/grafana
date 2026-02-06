// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build (darwin || freebsd || linux) && !android && !faketime

package purego

import (
	"unsafe"
)

// Unix Specification for dlfcn.h: https://pubs.opengroup.org/onlinepubs/7908799/xsh/dlfcn.h.html

var (
	fnDlopen  func(path string, mode int) uintptr
	fnDlsym   func(handle uintptr, name string) uintptr
	fnDlerror func() string
	fnDlclose func(handle uintptr) bool
)

func init() {
	RegisterFunc(&fnDlopen, dlopenABI0)
	RegisterFunc(&fnDlsym, dlsymABI0)
	RegisterFunc(&fnDlerror, dlerrorABI0)
	RegisterFunc(&fnDlclose, dlcloseABI0)
}

// Dlopen examines the dynamic library or bundle file specified by path. If the file is compatible
// with the current process and has not already been loaded into the
// current process, it is loaded and linked. After being linked, if it contains
// any initializer functions, they are called, before Dlopen
// returns. It returns a handle that can be used with Dlsym and Dlclose.
// A second call to Dlopen with the same path will return the same handle, but the internal
// reference count for the handle will be incremented. Therefore, all
// Dlopen calls should be balanced with a Dlclose call.
//
// This function is not available on Windows.
// Use [golang.org/x/sys/windows.LoadLibrary], [golang.org/x/sys/windows.LoadLibraryEx],
// [golang.org/x/sys/windows.NewLazyDLL], or [golang.org/x/sys/windows.NewLazySystemDLL] for Windows instead.
func Dlopen(path string, mode int) (uintptr, error) {
	u := fnDlopen(path, mode)
	if u == 0 {
		return 0, Dlerror{fnDlerror()}
	}
	return u, nil
}

// Dlsym takes a "handle" of a dynamic library returned by Dlopen and the symbol name.
// It returns the address where that symbol is loaded into memory. If the symbol is not found,
// in the specified library or any of the libraries that were automatically loaded by Dlopen
// when that library was loaded, Dlsym returns zero.
//
// This function is not available on Windows.
// Use [golang.org/x/sys/windows.GetProcAddress] for Windows instead.
func Dlsym(handle uintptr, name string) (uintptr, error) {
	u := fnDlsym(handle, name)
	if u == 0 {
		return 0, Dlerror{fnDlerror()}
	}
	return u, nil
}

// Dlclose decrements the reference count on the dynamic library handle.
// If the reference count drops to zero and no other loaded libraries
// use symbols in it, then the dynamic library is unloaded.
//
// This function is not available on Windows.
// Use [golang.org/x/sys/windows.FreeLibrary] for Windows instead.
func Dlclose(handle uintptr) error {
	if fnDlclose(handle) {
		return Dlerror{fnDlerror()}
	}
	return nil
}

func loadSymbol(handle uintptr, name string) (uintptr, error) {
	return Dlsym(handle, name)
}

// these functions exist in dlfcn_stubs.s and are calling C functions linked to in dlfcn_GOOS.go
// the indirection is necessary because a function is actually a pointer to the pointer to the code.
// sadly, I do not know of anyway to remove the assembly stubs entirely because //go:linkname doesn't
// appear to work if you link directly to the C function on darwin arm64.

//go:linkname dlopen dlopen
var dlopen uintptr
var dlopenABI0 = uintptr(unsafe.Pointer(&dlopen))

//go:linkname dlsym dlsym
var dlsym uintptr
var dlsymABI0 = uintptr(unsafe.Pointer(&dlsym))

//go:linkname dlclose dlclose
var dlclose uintptr
var dlcloseABI0 = uintptr(unsafe.Pointer(&dlclose))

//go:linkname dlerror dlerror
var dlerror uintptr
var dlerrorABI0 = uintptr(unsafe.Pointer(&dlerror))
