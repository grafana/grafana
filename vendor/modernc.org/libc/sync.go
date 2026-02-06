// Copyright 2021 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !(linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm))

package libc // import "modernc.org/libc"

import (
	"sync/atomic"
)

var __sync_synchronize_dummy int32

// __sync_synchronize();
func X__sync_synchronize(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	// Attempt to implement a full memory barrier without assembler.
	atomic.StoreInt32(&__sync_synchronize_dummy, atomic.LoadInt32(&__sync_synchronize_dummy)+1)
}
