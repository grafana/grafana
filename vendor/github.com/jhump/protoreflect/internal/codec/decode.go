package codec

import (
	"errors"
	"fmt"
	"io"
	"math"

	"github.com/golang/protobuf/proto"
)

// ErrOverflow is returned when an integer is too large to be represented.
var ErrOverflow = errors.New("proto: integer overflow")

// ErrBadWireType is returned when decoding a wire-type from a buffer that
// is not valid.
var ErrBadWireType = errors.New("proto: bad wiretype")

func (cb *Buffer) decodeVarintSlow() (x uint64, err error) {
	i := cb.index
	l := len(cb.buf)

	for shift := uint(0); shift < 64; shift += 7 {
		if i >= l {
			err = io.ErrUnexpectedEOF
			return
		}
		b := cb.buf[i]
		i++
		x |= (uint64(b) & 0x7F) << shift
		if b < 0x80 {
			cb.index = i
			return
		}
	}

	// The number is too large to represent in a 64-bit value.
	err = ErrOverflow
	return
}

// DecodeVarint reads a varint-encoded integer from the Buffer.
// This is the format for the
// int32, int64, uint32, uint64, bool, and enum
// protocol buffer types.
func (cb *Buffer) DecodeVarint() (uint64, error) {
	i := cb.index
	buf := cb.buf

	if i >= len(buf) {
		return 0, io.ErrUnexpectedEOF
	} else if buf[i] < 0x80 {
		cb.index++
		return uint64(buf[i]), nil
	} else if len(buf)-i < 10 {
		return cb.decodeVarintSlow()
	}

	var b uint64
	// we already checked the first byte
	x := uint64(buf[i]) - 0x80
	i++

	b = uint64(buf[i])
	i++
	x += b << 7
	if b&0x80 == 0 {
		goto done
	}
	x -= 0x80 << 7

	b = uint64(buf[i])
	i++
	x += b << 14
	if b&0x80 == 0 {
		goto done
	}
	x -= 0x80 << 14

	b = uint64(buf[i])
	i++
	x += b << 21
	if b&0x80 == 0 {
		goto done
	}
	x -= 0x80 << 21

	b = uint64(buf[i])
	i++
	x += b << 28
	if b&0x80 == 0 {
		goto done
	}
	x -= 0x80 << 28

	b = uint64(buf[i])
	i++
	x += b << 35
	if b&0x80 == 0 {
		goto done
	}
	x -= 0x80 << 35

	b = uint64(buf[i])
	i++
	x += b << 42
	if b&0x80 == 0 {
		goto done
	}
	x -= 0x80 << 42

	b = uint64(buf[i])
	i++
	x += b << 49
	if b&0x80 == 0 {
		goto done
	}
	x -= 0x80 << 49

	b = uint64(buf[i])
	i++
	x += b << 56
	if b&0x80 == 0 {
		goto done
	}
	x -= 0x80 << 56

	b = uint64(buf[i])
	i++
	x += b << 63
	if b&0x80 == 0 {
		goto done
	}
	// x -= 0x80 << 63 // Always zero.

	return 0, ErrOverflow

done:
	cb.index = i
	return x, nil
}

// DecodeTagAndWireType decodes a field tag and wire type from input.
// This reads a varint and then extracts the two fields from the varint
// value read.
func (cb *Buffer) DecodeTagAndWireType() (tag int32, wireType int8, err error) {
	var v uint64
	v, err = cb.DecodeVarint()
	if err != nil {
		return
	}
	// low 7 bits is wire type
	wireType = int8(v & 7)
	// rest is int32 tag number
	v = v >> 3
	if v > math.MaxInt32 {
		err = fmt.Errorf("tag number out of range: %d", v)
		return
	}
	tag = int32(v)
	return
}

// DecodeFixed64 reads a 64-bit integer from the Buffer.
// This is the format for the
// fixed64, sfixed64, and double protocol buffer types.
func (cb *Buffer) DecodeFixed64() (x uint64, err error) {
	// x, err already 0
	i := cb.index + 8
	if i < 0 || i > len(cb.buf) {
		err = io.ErrUnexpectedEOF
		return
	}
	cb.index = i

	x = uint64(cb.buf[i-8])
	x |= uint64(cb.buf[i-7]) << 8
	x |= uint64(cb.buf[i-6]) << 16
	x |= uint64(cb.buf[i-5]) << 24
	x |= uint64(cb.buf[i-4]) << 32
	x |= uint64(cb.buf[i-3]) << 40
	x |= uint64(cb.buf[i-2]) << 48
	x |= uint64(cb.buf[i-1]) << 56
	return
}

// DecodeFixed32 reads a 32-bit integer from the Buffer.
// This is the format for the
// fixed32, sfixed32, and float protocol buffer types.
func (cb *Buffer) DecodeFixed32() (x uint64, err error) {
	// x, err already 0
	i := cb.index + 4
	if i < 0 || i > len(cb.buf) {
		err = io.ErrUnexpectedEOF
		return
	}
	cb.index = i

	x = uint64(cb.buf[i-4])
	x |= uint64(cb.buf[i-3]) << 8
	x |= uint64(cb.buf[i-2]) << 16
	x |= uint64(cb.buf[i-1]) << 24
	return
}

// DecodeRawBytes reads a count-delimited byte buffer from the Buffer.
// This is the format used for the bytes protocol buffer
// type and for embedded messages.
func (cb *Buffer) DecodeRawBytes(alloc bool) (buf []byte, err error) {
	n, err := cb.DecodeVarint()
	if err != nil {
		return nil, err
	}

	nb := int(n)
	if nb < 0 {
		return nil, fmt.Errorf("proto: bad byte length %d", nb)
	}
	end := cb.index + nb
	if end < cb.index || end > len(cb.buf) {
		return nil, io.ErrUnexpectedEOF
	}

	if !alloc {
		buf = cb.buf[cb.index:end]
		cb.index = end
		return
	}

	buf = make([]byte, nb)
	copy(buf, cb.buf[cb.index:])
	cb.index = end
	return
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
	var groupEnd, dataEnd int
	groupEnd, dataEnd, err := cb.findGroupEnd()
	if err != nil {
		return nil, err
	}
	var results []byte
	if !alloc {
		results = cb.buf[cb.index:dataEnd]
	} else {
		results = make([]byte, dataEnd-cb.index)
		copy(results, cb.buf[cb.index:])
	}
	cb.index = groupEnd
	return results, nil
}

// SkipGroup is like ReadGroup, except that it discards the
// data and just advances the buffer to point to the input
// right *after* the "group end" tag.
func (cb *Buffer) SkipGroup() error {
	groupEnd, _, err := cb.findGroupEnd()
	if err != nil {
		return err
	}
	cb.index = groupEnd
	return nil
}

// SkipField attempts to skip the value of a field with the given wire
// type. When consuming a protobuf-encoded stream, it can be called immediately
// after DecodeTagAndWireType to discard the subsequent data for the field.
func (cb *Buffer) SkipField(wireType int8) error {
	switch wireType {
	case proto.WireFixed32:
		if err := cb.Skip(4); err != nil {
			return err
		}
	case proto.WireFixed64:
		if err := cb.Skip(8); err != nil {
			return err
		}
	case proto.WireVarint:
		// skip varint by finding last byte (has high bit unset)
		i := cb.index
		limit := i + 10 // varint cannot be >10 bytes
		for {
			if i >= limit {
				return ErrOverflow
			}
			if i >= len(cb.buf) {
				return io.ErrUnexpectedEOF
			}
			if cb.buf[i]&0x80 == 0 {
				break
			}
			i++
		}
		// TODO: This would only overflow if buffer length was MaxInt and we
		// read the last byte. This is not a real/feasible concern on 64-bit
		// systems. Something to worry about for 32-bit systems? Do we care?
		cb.index = i + 1
	case proto.WireBytes:
		l, err := cb.DecodeVarint()
		if err != nil {
			return err
		}
		if err := cb.Skip(int(l)); err != nil {
			return err
		}
	case proto.WireStartGroup:
		if err := cb.SkipGroup(); err != nil {
			return err
		}
	default:
		return ErrBadWireType
	}
	return nil
}

func (cb *Buffer) findGroupEnd() (groupEnd int, dataEnd int, err error) {
	start := cb.index
	defer func() {
		cb.index = start
	}()
	for {
		fieldStart := cb.index
		// read a field tag
		_, wireType, err := cb.DecodeTagAndWireType()
		if err != nil {
			return 0, 0, err
		}
		if wireType == proto.WireEndGroup {
			return cb.index, fieldStart, nil
		}
		// skip past the field's data
		if err := cb.SkipField(wireType); err != nil {
			return 0, 0, err
		}
	}
}
