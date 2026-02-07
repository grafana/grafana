// +build !arm noasm

package xxh32

// ChecksumZero returns the 32-bit hash of input.
func ChecksumZero(input []byte) uint32 { return checksumZeroGo(input) }

func update(v *[4]uint32, buf *[16]byte, input []byte) {
	updateGo(v, buf, input)
}
