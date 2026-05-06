// +build !noasm

package xxh32

// ChecksumZero returns the 32-bit hash of input.
//
//go:noescape
func ChecksumZero(input []byte) uint32

//go:noescape
func update(v *[4]uint32, buf *[16]byte, input []byte)
