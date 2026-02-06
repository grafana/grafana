// Copyright 2010 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build freebsd && !cgo

package fakecgo

import _ "unsafe" // for go:linkname

// Supply environ and __progname, because we don't
// link against the standard FreeBSD crt0.o and the
// libc dynamic library needs them.

// Note: when building with cross-compiling or CGO_ENABLED=0, add
// the following argument to `go` so that these symbols are defined by
// making fakecgo the Cgo.
//   -gcflags="github.com/ebitengine/purego/internal/fakecgo=-std"

//go:linkname _environ environ
//go:linkname _progname __progname

//go:cgo_export_dynamic environ
//go:cgo_export_dynamic __progname

var _environ uintptr
var _progname uintptr
