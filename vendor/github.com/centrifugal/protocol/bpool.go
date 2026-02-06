package protocol

import (
	"io"
	"math/bits"
	"sync"
)

var (
	// Verify ByteBuffer implements io.Writer.
	_ io.Writer = &ByteBuffer{}
)

// ByteBuffer implements a simple byte buffer.
type ByteBuffer struct {
	// B is the underlying byte slice.
	B []byte
}

// Reset resets bb.
func (bb *ByteBuffer) Reset() {
	bb.B = bb.B[:0]
}

// Write appends p to bb.
func (bb *ByteBuffer) Write(p []byte) (int, error) {
	bb.B = append(bb.B, p...)
	return len(p), nil
}

// pools contain pools for byte slices of various capacities.
var pools [19]sync.Pool

// maxBufferLength is the maximum length of an element that can be added to the Pool.
const maxBufferLength = 262144 // 2^18

// Log of base two, round up (for v > 0).
func nextLogBase2(v uint32) uint32 {
	return uint32(bits.Len32(v - 1))
}

// Log of base two, round down (for v > 0)
func prevLogBase2(num uint32) uint32 {
	next := nextLogBase2(num)
	if num == (1 << next) {
		return next
	}
	return next - 1
}

// getByteBuffer returns byte buffer with the given capacity.
func getByteBuffer(length int) *ByteBuffer {
	if length == 0 {
		return &ByteBuffer{
			B: nil,
		}
	}
	if length > maxBufferLength {
		return &ByteBuffer{
			B: make([]byte, 0, length),
		}
	}
	idx := nextLogBase2(uint32(length))
	if v := pools[idx].Get(); v != nil {
		return v.(*ByteBuffer)
	}
	return &ByteBuffer{
		B: make([]byte, 0, 1<<idx),
	}
}

// putByteBuffer returns bb to the pool.
func putByteBuffer(bb *ByteBuffer) {
	capacity := cap(bb.B)
	if capacity == 0 || capacity > maxBufferLength {
		return // drop.
	}
	idx := prevLogBase2(uint32(capacity))
	bb.Reset()
	pools[idx].Put(bb)
}
