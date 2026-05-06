package codec

import (
	"io"

	"github.com/golang/protobuf/proto"

	"github.com/jhump/protoreflect/internal/codec"
)

// ErrOverflow is returned when an integer is too large to be represented.
var ErrOverflow = codec.ErrOverflow

// ErrBadWireType is returned when decoding a wire-type from a buffer that
// is not valid.
var ErrBadWireType = codec.ErrBadWireType

// NB: much of the implementation is in an internal package, to avoid an import
// cycle between this codec package and the desc package. We export it from
// this package, but we can't use a type alias because we also need to add
// methods to it, to broaden the exposed API.

// Buffer is a reader and a writer that wraps a slice of bytes and also
// provides API for decoding and encoding the protobuf binary format.
//
// Its operation is similar to that of a bytes.Buffer: writing pushes
// data to the end of the buffer while reading pops data from the head
// of the buffer. So the same buffer can be used to both read and write.
type Buffer codec.Buffer

// NewBuffer creates a new buffer with the given slice of bytes as the
// buffer's initial contents.
func NewBuffer(buf []byte) *Buffer {
	return (*Buffer)(codec.NewBuffer(buf))
}

// SetDeterministic sets this buffer to encode messages deterministically. This
// is useful for tests. But the overhead is non-zero, so it should not likely be
// used outside of tests. When true, map fields in a message must have their
// keys sorted before serialization to ensure deterministic output. Otherwise,
// values in a map field will be serialized in map iteration order.
func (cb *Buffer) SetDeterministic(deterministic bool) {
	(*codec.Buffer)(cb).SetDeterministic(deterministic)
}

// IsDeterministic returns whether or not this buffer is configured to encode
// messages deterministically.
func (cb *Buffer) IsDeterministic() bool {
	return (*codec.Buffer)(cb).IsDeterministic()
}

// Reset resets this buffer back to empty. Any subsequent writes/encodes
// to the buffer will allocate a new backing slice of bytes.
func (cb *Buffer) Reset() {
	(*codec.Buffer)(cb).Reset()
}

// Bytes returns the slice of bytes remaining in the buffer. Note that
// this does not perform a copy: if the contents of the returned slice
// are modified, the modifications will be visible to subsequent reads
// via the buffer.
func (cb *Buffer) Bytes() []byte {
	return (*codec.Buffer)(cb).Bytes()
}

// String returns the remaining bytes in the buffer as a string.
func (cb *Buffer) String() string {
	return (*codec.Buffer)(cb).String()
}

// EOF returns true if there are no more bytes remaining to read.
func (cb *Buffer) EOF() bool {
	return (*codec.Buffer)(cb).EOF()
}

// Skip attempts to skip the given number of bytes in the input. If
// the input has fewer bytes than the given count, io.ErrUnexpectedEOF
// is returned and the buffer is unchanged. Otherwise, the given number
// of bytes are skipped and nil is returned.
func (cb *Buffer) Skip(count int) error {
	return (*codec.Buffer)(cb).Skip(count)

}

// Len returns the remaining number of bytes in the buffer.
func (cb *Buffer) Len() int {
	return (*codec.Buffer)(cb).Len()
}

// Read implements the io.Reader interface. If there are no bytes
// remaining in the buffer, it will return 0, io.EOF. Otherwise,
// it reads max(len(dest), cb.Len()) bytes from input and copies
// them into dest. It returns the number of bytes copied and a nil
// error in this case.
func (cb *Buffer) Read(dest []byte) (int, error) {
	return (*codec.Buffer)(cb).Read(dest)
}

var _ io.Reader = (*Buffer)(nil)

// Write implements the io.Writer interface. It always returns
// len(data), nil.
func (cb *Buffer) Write(data []byte) (int, error) {
	return (*codec.Buffer)(cb).Write(data)
}

var _ io.Writer = (*Buffer)(nil)

// DecodeVarint reads a varint-encoded integer from the Buffer.
// This is the format for the
// int32, int64, uint32, uint64, bool, and enum
// protocol buffer types.
func (cb *Buffer) DecodeVarint() (uint64, error) {
	return (*codec.Buffer)(cb).DecodeVarint()
}

// DecodeTagAndWireType decodes a field tag and wire type from input.
// This reads a varint and then extracts the two fields from the varint
// value read.
func (cb *Buffer) DecodeTagAndWireType() (tag int32, wireType int8, err error) {
	return (*codec.Buffer)(cb).DecodeTagAndWireType()
}

// DecodeFixed64 reads a 64-bit integer from the Buffer.
// This is the format for the
// fixed64, sfixed64, and double protocol buffer types.
func (cb *Buffer) DecodeFixed64() (x uint64, err error) {
	return (*codec.Buffer)(cb).DecodeFixed64()
}

// DecodeFixed32 reads a 32-bit integer from the Buffer.
// This is the format for the
// fixed32, sfixed32, and float protocol buffer types.
func (cb *Buffer) DecodeFixed32() (x uint64, err error) {
	return (*codec.Buffer)(cb).DecodeFixed32()
}

// DecodeRawBytes reads a count-delimited byte buffer from the Buffer.
// This is the format used for the bytes protocol buffer
// type and for embedded messages.
func (cb *Buffer) DecodeRawBytes(alloc bool) (buf []byte, err error) {
	return (*codec.Buffer)(cb).DecodeRawBytes(alloc)
}

// ReadGroup reads the input until a "group end" tag is found
// and returns the data up to that point. Subsequent reads from
// the buffer will read data after the group end tag. If alloc
// is true, the data is copied to a new slice before being returned.
// Otherwise, the returned slice is a view into the buffer's
// underlying byte slice.
//
// This function correctly handles nested groups: if a "group start"
// tag is found, then that group's end tag will be included in the
// returned data.
func (cb *Buffer) ReadGroup(alloc bool) ([]byte, error) {
	return (*codec.Buffer)(cb).ReadGroup(alloc)
}

// SkipGroup is like ReadGroup, except that it discards the
// data and just advances the buffer to point to the input
// right *after* the "group end" tag.
func (cb *Buffer) SkipGroup() error {
	return (*codec.Buffer)(cb).SkipGroup()
}

// SkipField attempts to skip the value of a field with the given wire
// type. When consuming a protobuf-encoded stream, it can be called immediately
// after DecodeTagAndWireType to discard the subsequent data for the field.
func (cb *Buffer) SkipField(wireType int8) error {
	return (*codec.Buffer)(cb).SkipField(wireType)
}

// EncodeVarint writes a varint-encoded integer to the Buffer.
// This is the format for the
// int32, int64, uint32, uint64, bool, and enum
// protocol buffer types.
func (cb *Buffer) EncodeVarint(x uint64) error {
	return (*codec.Buffer)(cb).EncodeVarint(x)
}

// EncodeTagAndWireType encodes the given field tag and wire type to the
// buffer. This combines the two values and then writes them as a varint.
func (cb *Buffer) EncodeTagAndWireType(tag int32, wireType int8) error {
	return (*codec.Buffer)(cb).EncodeTagAndWireType(tag, wireType)
}

// EncodeFixed64 writes a 64-bit integer to the Buffer.
// This is the format for the
// fixed64, sfixed64, and double protocol buffer types.
func (cb *Buffer) EncodeFixed64(x uint64) error {
	return (*codec.Buffer)(cb).EncodeFixed64(x)

}

// EncodeFixed32 writes a 32-bit integer to the Buffer.
// This is the format for the
// fixed32, sfixed32, and float protocol buffer types.
func (cb *Buffer) EncodeFixed32(x uint64) error {
	return (*codec.Buffer)(cb).EncodeFixed32(x)
}

// EncodeRawBytes writes a count-delimited byte buffer to the Buffer.
// This is the format used for the bytes protocol buffer
// type and for embedded messages.
func (cb *Buffer) EncodeRawBytes(b []byte) error {
	return (*codec.Buffer)(cb).EncodeRawBytes(b)
}

// EncodeMessage writes the given message to the buffer.
func (cb *Buffer) EncodeMessage(pm proto.Message) error {
	return (*codec.Buffer)(cb).EncodeMessage(pm)
}

// EncodeDelimitedMessage writes the given message to the buffer with a
// varint-encoded length prefix (the delimiter).
func (cb *Buffer) EncodeDelimitedMessage(pm proto.Message) error {
	return (*codec.Buffer)(cb).EncodeDelimitedMessage(pm)
}
