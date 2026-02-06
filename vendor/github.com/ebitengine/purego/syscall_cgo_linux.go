// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build cgo && !(amd64 || arm64)

package purego

import (
	"github.com/ebitengine/purego/internal/cgo"
)

var syscall15XABI0 = uintptr(cgo.Syscall15XABI0)

//go:nosplit
func syscall_syscall15X(fn, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15 uintptr) (r1, r2, err uintptr) {
	return cgo.Syscall15X(fn, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15)
}

func NewCallback(_ interface{}) uintptr {
	panic("purego: NewCallback on Linux is only supported on amd64/arm64")
}
