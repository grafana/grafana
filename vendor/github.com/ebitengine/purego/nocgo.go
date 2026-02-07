// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo && (darwin || freebsd || linux)

package purego

// if CGO_ENABLED=0 import fakecgo to setup the Cgo runtime correctly.
// This is required since some frameworks need TLS setup the C way which Go doesn't do.
// We currently don't support ios in fakecgo mode so force Cgo or fail
//
// The way that the Cgo runtime (runtime/cgo) works is by setting some variables found
// in runtime with non-null GCC compiled functions. The variables that are replaced are
// var (
//		iscgo             bool 							// in runtime/cgo.go
//		_cgo_init         unsafe.Pointer 				// in runtime/cgo.go
//		_cgo_thread_start unsafe.Pointer				// in runtime/cgo.go
//		_cgo_notify_runtime_init_done unsafe.Pointer 	// in runtime/cgo.go
//		_cgo_setenv unsafe.Pointer  					// in runtime/env_posix.go
//		_cgo_unsetenv unsafe.Pointer					// in runtime/env_posix.go
// )
// importing fakecgo will set these (using //go:linkname) with functions written
// entirely in Go (except for some assembly trampolines to change GCC ABI to Go ABI).
// Doing so makes it possible to build applications that call into C without CGO_ENABLED=1.
import _ "github.com/ebitengine/purego/internal/fakecgo"
