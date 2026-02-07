// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !cgo && (darwin || freebsd || linux)

package fakecgo

import _ "unsafe" // for go:linkname

//go:linkname x_cgo_setenv_trampoline x_cgo_setenv_trampoline
//go:linkname _cgo_setenv runtime._cgo_setenv
var x_cgo_setenv_trampoline byte
var _cgo_setenv = &x_cgo_setenv_trampoline

//go:linkname x_cgo_unsetenv_trampoline x_cgo_unsetenv_trampoline
//go:linkname _cgo_unsetenv runtime._cgo_unsetenv
var x_cgo_unsetenv_trampoline byte
var _cgo_unsetenv = &x_cgo_unsetenv_trampoline
