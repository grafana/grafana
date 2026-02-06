// Copyright 2024 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64)

package libc // import "modernc.org/libc"

import (
	mbits "math/bits"
)

// static inline int a_ctz_l(unsigned long x)
func _a_ctz_l(tls *TLS, x ulong) int32 {
	return int32(mbits.TrailingZeros64(x))
}
