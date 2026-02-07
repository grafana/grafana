//go:build !amd64
// +build !amd64

/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package simd

// Search uses the Clever search to find the correct key.
func Search(xs []uint64, k uint64) int16 {
	if len(xs) < 8 || (len(xs)%8 != 0) {
		return Naive(xs, k)
	}
	var twos, pk [4]uint64
	pk[0] = k
	pk[1] = k
	pk[2] = k
	pk[3] = k
	for i := 0; i < len(xs); i += 8 {
		twos[0] = xs[i]
		twos[1] = xs[i+2]
		twos[2] = xs[i+4]
		twos[3] = xs[i+6]
		if twos[0] >= pk[0] {
			return int16(i / 2)
		}
		if twos[1] >= pk[1] {
			return int16((i + 2) / 2)
		}
		if twos[2] >= pk[2] {
			return int16((i + 4) / 2)
		}
		if twos[3] >= pk[3] {
			return int16((i + 6) / 2)
		}

	}
	return int16(len(xs) / 2)
}
