package codec

import (
	"errors"
	"fmt"
	"io"
	"math"

	"github.com/golang/protobuf/proto"
	"google.golang.org/protobuf/types/descriptorpb"

	"github.com/jhump/protoreflect/desc"
)

var varintTypes = map[descriptorpb.FieldDescriptorProto_Type]bool{}
var fixed32Types = map[descriptorpb.FieldDescriptorProto_Type]bool{}
var fixed64Types = map[descriptorpb.FieldDescriptorProto_Type]bool{}

func init() {
	varintTypes[descriptorpb.FieldDescriptorProto_TYPE_BOOL] = true
	varintTypes[descriptorpb.FieldDescriptorProto_TYPE_INT32] = true
	varintTypes[descriptorpb.FieldDescriptorProto_TYPE_INT64] = true
	varintTypes[descriptorpb.FieldDescriptorProto_TYPE_UINT32] = true
	varintTypes[descriptorpb.FieldDescriptorProto_TYPE_UINT64] = true
	varintTypes[descriptorpb.FieldDescriptorProto_TYPE_SINT32] = true
	varintTypes[descriptorpb.FieldDescriptorProto_TYPE_SINT64] = true
	varintTypes[descriptorpb.FieldDescriptorProto_TYPE_ENUM] = true

	fixed32Types[descriptorpb.FieldDescriptorProto_TYPE_FIXED32] = true
	fixed32Types[descriptorpb.FieldDescriptorProto_TYPE_SFIXED32] = true
	fixed32Types[descriptorpb.FieldDescriptorProto_TYPE_FLOAT] = true

	fixed64Types[descriptorpb.FieldDescriptorProto_TYPE_FIXED64] = true
	fixed64Types[descriptorpb.FieldDescriptorProto_TYPE_SFIXED64] = true
	fixed64Types[descriptorpb.FieldDescriptorProto_TYPE_DOUBLE] = true
}

// ErrWireTypeEndGroup is returned from DecodeFieldValue if the tag and wire-type
// it reads indicates an end-group marker.
var ErrWireTypeEndGroup = errors.New("unexpected wire type: end group")

// MessageFactory is used to instantiate messages when DecodeFieldValue needs to
// decode a message value.
//
// Also see MessageFactory in "github.com/jhump/protoreflect/dynamic", which
// implements this interface.
type MessageFactory interface {
	NewMessage(md *desc.MessageDescriptor) proto.Message
}

// UnknownField represents a field that was parsed from the binary wire
// format for a message, but was not a recognized field number. Enough
// information is preserved so that re-serializing the message won't lose
// any of the unrecognized data.
type UnknownField struct {
	// The tag number for the unrecognized field.
	Tag int32

	// Encoding indicates how the unknown field was encoded on the wire. If it
	// is proto.WireBytes or proto.WireGroupStart then Contents will be set to
	// the raw bytes. If it is proto.WireTypeFixed32 then the data is in the least
	// significant 32 bits of Value. Otherwise, the data is in all 64 bits of
	// Value.
	Encoding int8
	Contents []byte
	Value    uint64
}

// DecodeZigZag32 decodes a signed 32-bit integer from the given
// zig-zag encoded value.
func DecodeZigZag32(v uint64) int32 {
	return int32((uint32(v) >> 1) ^ uint32((int32(v&1)<<31)>>31))
}

// DecodeZigZag64 decodes a signed 64-bit integer from the given
// zig-zag encoded value.
func DecodeZigZag64(v uint64) int64 {
	return int64((v >> 1) ^ uint64((int64(v&1)<<63)>>63))
}

// DecodeFieldValue will read a field value from the buffer and return its
// value and the corresponding field descriptor. The given function is used
// to lookup a field descriptor by tag number. The given factory is used to
// instantiate a message if the field value is (or contains) a message value.
//
// On error, the field descriptor and value are typically nil. However, if the
// error returned is ErrWireTypeEndGroup, the returned value will indicate any
// tag number encoded in the end-group marker.
//
// If the field descriptor returned is nil, that means that the given function
// returned nil. This is expected to happen for unrecognized tag numbers. In
// that case, no error is returned, and the value will be an UnknownField.
func (cb *Buffer) DecodeFieldValue(fieldFinder func(int32) *desc.FieldDescriptor, fact MessageFactory) (*desc.FieldDescriptor, interface{}, error) {
	if cb.EOF() {
		return nil, nil, io.EOF
	}
	tagNumber, wireType, err := cb.DecodeTagAndWireType()
	if err != nil {
		return nil, nil, err
	}
	if wireType == proto.WireEndGroup {
		return nil, tagNumber, ErrWireTypeEndGroup
	}
	fd := fieldFinder(tagNumber)
	if fd == nil {
		val, err := cb.decodeUnknownField(tagNumber, wireType)
		return nil, val, err
	}
	val, err := cb.decodeKnownField(fd, wireType, fact)
	return fd, val, err
}

// DecodeScalarField extracts a properly-typed value from v. The returned value's
// type depends on the given field descriptor type. It will be the same type as
// generated structs use for the field descriptor's type. Enum types will return
// an int32. If the given field type uses length-delimited encoding (nested
// messages, bytes, and strings), an error is returned.
func DecodeScalarField(fd *desc.FieldDescriptor, v uint64) (interface{}, error) {
	switch fd.GetType() {
	case descriptorpb.FieldDescriptorProto_TYPE_BOOL:
		return v != 0, nil
	case descriptorpb.FieldDescriptorProto_TYPE_UINT32,
		descriptorpb.FieldDescriptorProto_TYPE_FIXED32:
		if v > math.MaxUint32 {
			return nil, ErrOverflow
		}
		return uint32(v), nil

	case descriptorpb.FieldDescriptorProto_TYPE_INT32,
		descriptorpb.FieldDescriptorProto_TYPE_ENUM:
		s := int64(v)
		if s > math.MaxInt32 || s < math.MinInt32 {
			return nil, ErrOverflow
		}
		return int32(s), nil

	case descriptorpb.FieldDescriptorProto_TYPE_SFIXED32:
		if v > math.MaxUint32 {
			return nil, ErrOverflow
		}
		return int32(v), nil

	case descriptorpb.FieldDescriptorProto_TYPE_SINT32:
		if v > math.MaxUint32 {
			return nil, ErrOverflow
		}
		return DecodeZigZag32(v), nil

	case descriptorpb.FieldDescriptorProto_TYPE_UINT64,
		descriptorpb.FieldDescriptorProto_TYPE_FIXED64:
		return v, nil

	case descriptorpb.FieldDescriptorProto_TYPE_INT64,
		descriptorpb.FieldDescriptorProto_TYPE_SFIXED64:
		return int64(v), nil

	case descriptorpb.FieldDescriptorProto_TYPE_SINT64:
		return DecodeZigZag64(v), nil

	case descriptorpb.FieldDescriptorProto_TYPE_FLOAT:
		if v > math.MaxUint32 {
			return nil, ErrOverflow
		}
		return math.Float32frombits(uint32(v)), nil

	case descriptorpb.FieldDescriptorProto_TYPE_DOUBLE:
		return math.Float64frombits(v), nil

	default:
		// bytes, string, message, and group cannot be represented as a simple numeric value
		return nil, fmt.Errorf("bad input; field %s requires length-delimited wire type", fd.GetFullyQualifiedName())
	}
}

// DecodeLengthDelimitedField extracts a properly-typed value from bytes. The
// returned value's type will usually be []byte, string, or, for nested messages,
// the type returned from the given message factory. However, since repeated
// scalar fields can be length-delimited, when they used packed encoding, it can
// also return an []interface{}, where each element is a scalar value. Furthermore,
// it could return a scalar type, not in a slice, if the given field descriptor is
// not repeated. This is to support cases where a field is changed from optional
// to repeated. New code may emit a packed repeated representation, but old code
// still expects a single scalar value. In this case, if the actual data in bytes
// contains multiple values, only the last value is returned.
func DecodeLengthDelimitedField(fd *desc.FieldDescriptor, bytes []byte, mf MessageFactory) (interface{}, error) {
	switch {
	case fd.GetType() == descriptorpb.FieldDescriptorProto_TYPE_BYTES:
		return bytes, nil

	case fd.GetType() == descriptorpb.FieldDescriptorProto_TYPE_STRING:
		return string(bytes), nil

	case fd.GetType() == descriptorpb.FieldDescriptorProto_TYPE_MESSAGE ||
		fd.GetType() == descriptorpb.FieldDescriptorProto_TYPE_GROUP:
		msg := mf.NewMessage(fd.GetMessageType())
		err := proto.Unmarshal(bytes, msg)
		if err != nil {
			return nil, err
		} else {
			return msg, nil
		}

	default:
		// even if the field is not repeated or not packed, we still parse it as such for
		// backwards compatibility (e.g. message we are de-serializing could have been both
		// repeated and packed at the time of serialization)
		packedBuf := NewBuffer(bytes)
		var slice []interface{}
		var val interface{}
		for !packedBuf.EOF() {
			var v uint64
			var err error
			if varintTypes[fd.GetType()] {
				v, err = packedBuf.DecodeVarint()
			} else if fixed32Types[fd.GetType()] {
				v, err = packedBuf.DecodeFixed32()
			} else if fixed64Types[fd.GetType()] {
				v, err = packedBuf.DecodeFixed64()
			} else {
				return nil, fmt.Errorf("bad input; cannot parse length-delimited wire type for field %s", fd.GetFullyQualifiedName())
			}
			if err != nil {
				return nil, err
			}
			val, err = DecodeScalarField(fd, v)
			if err != nil {
				return nil, err
			}
			if fd.IsRepeated() {
				slice = append(slice, val)
			}
		}
		if fd.IsRepeated() {
			return slice, nil
		} else {
			// if not a repeated field, last value wins
			return val, nil
		}
	}
}

func (b *Buffer) decodeKnownField(fd *desc.FieldDescriptor, encoding int8, fact MessageFactory) (interface{}, error) {
	var val interface{}
	var err error
	switch encoding {
	case proto.WireFixed32:
		var num uint64
		num, err = b.DecodeFixed32()
		if err == nil {
			val, err = DecodeScalarField(fd, num)
		}
	case proto.WireFixed64:
		var num uint64
		num, err = b.DecodeFixed64()
		if err == nil {
			val, err = DecodeScalarField(fd, num)
		}
	case proto.WireVarint:
		var num uint64
		num, err = b.DecodeVarint()
		if err == nil {
			val, err = DecodeScalarField(fd, num)
		}

	case proto.WireBytes:
		alloc := fd.GetType() == descriptorpb.FieldDescriptorProto_TYPE_BYTES
		var raw []byte
		raw, err = b.DecodeRawBytes(alloc)
		if err == nil {
			val, err = DecodeLengthDelimitedField(fd, raw, fact)
		}

	case proto.WireStartGroup:
		if fd.GetMessageType() == nil {
			return nil, fmt.Errorf("cannot parse field %s from group-encoded wire type", fd.GetFullyQualifiedName())
		}
		msg := fact.NewMessage(fd.GetMessageType())
		var data []byte
		data, err = b.ReadGroup(false)
		if err == nil {
			err = proto.Unmarshal(data, msg)
			if err == nil {
				val = msg
			}
		}

	default:
		return nil, ErrBadWireType
	}
	if err != nil {
		return nil, err
	}

	return val, nil
}

func (b *Buffer) decodeUnknownField(tagNumber int32, encoding int8) (interface{}, error) {
	u := UnknownField{Tag: tagNumber, Encoding: encoding}
	var err error
	switch encoding {
	case proto.WireFixed32:
		u.Value, err = b.DecodeFixed32()
	case proto.WireFixed64:
		u.Value, err = b.DecodeFixed64()
	case proto.WireVarint:
		u.Value, err = b.DecodeVarint()
	case proto.WireBytes:
		u.Contents, err = b.DecodeRawBytes(true)
	case proto.WireStartGroup:
		u.Contents, err = b.ReadGroup(true)
	default:
		err = ErrBadWireType
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}
