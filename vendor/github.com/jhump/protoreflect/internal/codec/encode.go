package codec

import (
	"github.com/golang/protobuf/proto"
)

// EncodeVarint writes a varint-encoded integer to the Buffer.
// This is the format for the
// int32, int64, uint32, uint64, bool, and enum
// protocol buffer types.
func (cb *Buffer) EncodeVarint(x uint64) error {
	for x >= 1<<7 {
		cb.buf = append(cb.buf, uint8(x&0x7f|0x80))
		x >>= 7
	}
	cb.buf = append(cb.buf, uint8(x))
	return nil
}

// EncodeTagAndWireType encodes the given field tag and wire type to the
// buffer. This combines the two values and then writes them as a varint.
func (cb *Buffer) EncodeTagAndWireType(tag int32, wireType int8) error {
	v := uint64((int64(tag) << 3) | int64(wireType))
	return cb.EncodeVarint(v)
}

// EncodeFixed64 writes a 64-bit integer to the Buffer.
// This is the format for the
// fixed64, sfixed64, and double protocol buffer types.
func (cb *Buffer) EncodeFixed64(x uint64) error {
	cb.buf = append(cb.buf,
		uint8(x),
		uint8(x>>8),
		uint8(x>>16),
		uint8(x>>24),
		uint8(x>>32),
		uint8(x>>40),
		uint8(x>>48),
		uint8(x>>56))
	return nil
}

// EncodeFixed32 writes a 32-bit integer to the Buffer.
// This is the format for the
// fixed32, sfixed32, and float protocol buffer types.
func (cb *Buffer) EncodeFixed32(x uint64) error {
	cb.buf = append(cb.buf,
		uint8(x),
		uint8(x>>8),
		uint8(x>>16),
		uint8(x>>24))
	return nil
}

// EncodeRawBytes writes a count-delimited byte buffer to the Buffer.
// This is the format used for the bytes protocol buffer
// type and for embedded messages.
func (cb *Buffer) EncodeRawBytes(b []byte) error {
	if err := cb.EncodeVarint(uint64(len(b))); err != nil {
		return err
	}
	cb.buf = append(cb.buf, b...)
	return nil
}

// EncodeMessage writes the given message to the buffer.
func (cb *Buffer) EncodeMessage(pm proto.Message) error {
	bytes, err := marshalMessage(cb.buf, pm, cb.deterministic)
	if err != nil {
		return err
	}
	cb.buf = bytes
	return nil
}

// EncodeDelimitedMessage writes the given message to the buffer with a
// varint-encoded length prefix (the delimiter).
func (cb *Buffer) EncodeDelimitedMessage(pm proto.Message) error {
	bytes, err := marshalMessage(cb.tmp, pm, cb.deterministic)
	if err != nil {
		return err
	}
	// save truncated buffer if it was grown (so we can re-use it and
	// curtail future allocations)
	if cap(bytes) > cap(cb.tmp) {
		cb.tmp = bytes[:0]
	}
	return cb.EncodeRawBytes(bytes)
}

func marshalMessage(b []byte, pm proto.Message, deterministic bool) ([]byte, error) {
	// We try to use the most efficient way to marshal to existing slice.

	if deterministic {
		// see if the message has custom deterministic methods, preferring an
		// "append" method over one that must always re-allocate
		madm, ok := pm.(interface {
			MarshalAppendDeterministic(b []byte) ([]byte, error)
		})
		if ok {
			return madm.MarshalAppendDeterministic(b)
		}

		mdm, ok := pm.(interface {
			MarshalDeterministic() ([]byte, error)
		})
		if ok {
			bytes, err := mdm.MarshalDeterministic()
			if err != nil {
				return nil, err
			}
			if len(b) == 0 {
				return bytes, nil
			}
			return append(b, bytes...), nil
		}

		var buf proto.Buffer
		buf.SetDeterministic(true)
		if err := buf.Marshal(pm); err != nil {
			return nil, err
		}
		bytes := buf.Bytes()
		if len(b) == 0 {
			return bytes, nil
		}
		return append(b, bytes...), nil
	}

	mam, ok := pm.(interface {
		// see if we can append the message, vs. having to re-allocate
		MarshalAppend(b []byte) ([]byte, error)
	})
	if ok {
		return mam.MarshalAppend(b)
	}

	// lowest common denominator
	bytes, err := proto.Marshal(pm)
	if err != nil {
		return nil, err
	}
	if len(b) == 0 {
		return bytes, nil
	}
	return append(b, bytes...), nil
}
