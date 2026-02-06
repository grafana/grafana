//go:build go1.18
// +build go1.18

package xsync

import (
	"hash/maphash"
	"unsafe"
)

// hashUint64 calculates a hash of v with the given seed.
//
//lint:ignore U1000 used in MapOf
func hashUint64[K IntegerConstraint](seed maphash.Seed, k K) uint64 {
	n := uint64(k)
	// Java's Long standard hash function.
	n = n ^ (n >> 32)
	nseed := *(*uint64)(unsafe.Pointer(&seed))
	// 64-bit variation of boost's hash_combine.
	nseed ^= n + 0x9e3779b97f4a7c15 + (nseed << 12) + (nseed >> 4)
	return nseed
}
