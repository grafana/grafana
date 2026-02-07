// SPDX-License-Identifier: BSD-3-Clause
package common

import "unsafe"

// IsLittleEndian checks if the current platform uses little-endian.
// copied from https://github.com/ntrrg/ntgo/blob/v0.8.0/runtime/infrastructure.go#L16 (MIT License)
func IsLittleEndian() bool {
	var x int16 = 0x0011
	return *(*byte)(unsafe.Pointer(&x)) == 0x11
}
