// Copyright 2024 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build linux && (386 || arm)

package libc // import "modernc.org/libc"

import (
	mbits "math/bits"
)

func X__builtin_ctzl(tls *TLS, x ulong) int32 {
	return int32(mbits.TrailingZeros32(x))
}

func X__builtin_clzl(t *TLS, n ulong) int32 {
	return int32(mbits.LeadingZeros32(n))
}

// int __builtin_popcountl (unsigned long x)
func X__builtin_popcountl(t *TLS, x ulong) int32 {
	return int32(mbits.OnesCount32(x))
}
