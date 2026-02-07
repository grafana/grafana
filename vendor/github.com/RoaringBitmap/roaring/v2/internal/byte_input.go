package internal

import (
	"encoding/binary"
	"io"
)

// ByteInput typed interface around io.Reader or raw bytes
type ByteInput interface {
	// Next returns a slice containing the next n bytes from the buffer,
	// advancing the buffer as if the bytes had been returned by Read.
	Next(n int) ([]byte, error)
	// NextReturnsSafeSlice returns true if Next() returns a safe slice as opposed
	// to a slice that points to an underlying buffer possibly owned by another system.
	// When NextReturnsSafeSlice returns false, the result from Next() should be copied
	// before it is modified (i.e., it is immutable).
	NextReturnsSafeSlice() bool
	// ReadUInt32 reads uint32 with LittleEndian order
	ReadUInt32() (uint32, error)
	// ReadUInt16 reads uint16 with LittleEndian order
	ReadUInt16() (uint16, error)
	// GetReadBytes returns read bytes
	GetReadBytes() int64
	// SkipBytes skips exactly n bytes
	SkipBytes(n int) error
}

// NewByteInputFromReader creates reader wrapper
func NewByteInputFromReader(reader io.Reader) ByteInput {
	return &ByteInputAdapter{
		r:         reader,
		readBytes: 0,
	}
}

// NewByteInput creates raw bytes wrapper
func NewByteInput(buf []byte) ByteInput {
	return &ByteBuffer{
		buf: buf,
		off: 0,
	}
}

// ByteBuffer raw bytes wrapper
type ByteBuffer struct {
	buf []byte
	off int
}

// NewByteBuffer creates a new ByteBuffer.
func NewByteBuffer(buf []byte) *ByteBuffer {
	return &ByteBuffer{
		buf: buf,
	}
}

var _ io.Reader = (*ByteBuffer)(nil)

// Read implements io.Reader.
func (b *ByteBuffer) Read(p []byte) (int, error) {
	data, err := b.Next(len(p))
	if err != nil {
		return 0, err
	}
	copy(p, data)
	return len(data), nil
}

// Next returns a slice containing the next n bytes from the reader
// If there are fewer bytes than the given n, io.ErrUnexpectedEOF will be returned
func (b *ByteBuffer) Next(n int) ([]byte, error) {
	m := len(b.buf) - b.off

	if n > m {
		return nil, io.ErrUnexpectedEOF
	}

	data := b.buf[b.off : b.off+n]
	b.off += n

	return data, nil
}

// NextReturnsSafeSlice returns false since ByteBuffer might hold
// an array owned by some other systems.
func (b *ByteBuffer) NextReturnsSafeSlice() bool {
	return false
}

// ReadUInt32 reads uint32 with LittleEndian order
func (b *ByteBuffer) ReadUInt32() (uint32, error) {
	if len(b.buf)-b.off < 4 {
		return 0, io.ErrUnexpectedEOF
	}

	v := binary.LittleEndian.Uint32(b.buf[b.off:])
	b.off += 4

	return v, nil
}

// ReadUInt16 reads uint16 with LittleEndian order
func (b *ByteBuffer) ReadUInt16() (uint16, error) {
	if len(b.buf)-b.off < 2 {
		return 0, io.ErrUnexpectedEOF
	}

	v := binary.LittleEndian.Uint16(b.buf[b.off:])
	b.off += 2

	return v, nil
}

// GetReadBytes returns read bytes
func (b *ByteBuffer) GetReadBytes() int64 {
	return int64(b.off)
}

// SkipBytes skips exactly n bytes
func (b *ByteBuffer) SkipBytes(n int) error {
	m := len(b.buf) - b.off

	if n > m {
		return io.ErrUnexpectedEOF
	}

	b.off += n

	return nil
}

// Reset resets the given buffer with a new byte slice
func (b *ByteBuffer) Reset(buf []byte) {
	b.buf = buf
	b.off = 0
}

// ByteInputAdapter reader wrapper
type ByteInputAdapter struct {
	r         io.Reader
	readBytes int
	buf       [4]byte
}

var _ io.Reader = (*ByteInputAdapter)(nil)

// Read implements io.Reader.
func (b *ByteInputAdapter) Read(buf []byte) (int, error) {
	m, err := io.ReadAtLeast(b.r, buf, len(buf))
	b.readBytes += m

	if err != nil {
		return 0, err
	}

	return m, nil
}

// Next returns a slice containing the next n bytes from the buffer,
// advancing the buffer as if the bytes had been returned by Read.
func (b *ByteInputAdapter) Next(n int) ([]byte, error) {
	buf := make([]byte, n)
	_, err := b.Read(buf)

	if err != nil {
		return nil, err
	}
	return buf, nil
}

// NextReturnsSafeSlice returns true since ByteInputAdapter always returns a slice
// allocated with make([]byte, ...)
func (b *ByteInputAdapter) NextReturnsSafeSlice() bool {
	return true
}

// ReadUInt32 reads uint32 with LittleEndian order
func (b *ByteInputAdapter) ReadUInt32() (uint32, error) {
	buf := b.buf[:4]
	_, err := b.Read(buf)
	if err != nil {
		return 0, err
	}

	return binary.LittleEndian.Uint32(buf), nil
}

// ReadUInt16 reads uint16 with LittleEndian order
func (b *ByteInputAdapter) ReadUInt16() (uint16, error) {
	buf := b.buf[:2]
	_, err := b.Read(buf)
	if err != nil {
		return 0, err
	}

	return binary.LittleEndian.Uint16(buf), nil
}

// GetReadBytes returns read bytes
func (b *ByteInputAdapter) GetReadBytes() int64 {
	return int64(b.readBytes)
}

// SkipBytes skips exactly n bytes
func (b *ByteInputAdapter) SkipBytes(n int) error {
	_, err := b.Next(n)

	return err
}

// Reset resets the given buffer with a new stream
func (b *ByteInputAdapter) Reset(stream io.Reader) {
	b.r = stream
	b.readBytes = 0
}
