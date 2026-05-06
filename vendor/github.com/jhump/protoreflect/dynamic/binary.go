package dynamic

// Binary serialization and de-serialization for dynamic messages

import (
	"fmt"
	"io"

	"github.com/golang/protobuf/proto"

	"github.com/jhump/protoreflect/codec"
)

// defaultDeterminism, if true, will mean that calls to Marshal will produce
// deterministic output. This is used to make the output of proto.Marshal(...)
// deterministic (since there is no way to have that convey determinism intent).
// **This is only used from tests.**
var defaultDeterminism = false

// Marshal serializes this message to bytes, returning an error if the operation
// fails. The resulting bytes are in the standard protocol buffer binary format.
func (m *Message) Marshal() ([]byte, error) {
	var b codec.Buffer
	b.SetDeterministic(defaultDeterminism)
	if err := m.marshal(&b); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

// MarshalAppend behaves exactly the same as Marshal, except instead of allocating a
// new byte slice to marshal into, it uses the provided byte slice. The backing array
// for the returned byte slice *may* be the same as the one that was passed in, but
// it's not guaranteed as a new backing array will automatically be allocated if
// more bytes need to be written than the provided buffer has capacity for.
func (m *Message) MarshalAppend(b []byte) ([]byte, error) {
	codedBuf := codec.NewBuffer(b)
	codedBuf.SetDeterministic(defaultDeterminism)
	if err := m.marshal(codedBuf); err != nil {
		return nil, err
	}
	return codedBuf.Bytes(), nil
}

// MarshalDeterministic serializes this message to bytes in a deterministic way,
// returning an error if the operation fails. This differs from Marshal in that
// map keys will be sorted before serializing to bytes. The protobuf spec does
// not define ordering for map entries, so Marshal will use standard Go map
// iteration order (which will be random). But for cases where determinism is
// more important than performance, use this method instead.
func (m *Message) MarshalDeterministic() ([]byte, error) {
	var b codec.Buffer
	b.SetDeterministic(true)
	if err := m.marshal(&b); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

// MarshalAppendDeterministic behaves exactly the same as MarshalDeterministic,
// except instead of allocating a new byte slice to marshal into, it uses the
// provided byte slice. The backing array for the returned byte slice *may* be
// the same as the one that was passed in, but it's not guaranteed as a new
// backing array will automatically be allocated if more bytes need to be written
// than the provided buffer has capacity for.
func (m *Message) MarshalAppendDeterministic(b []byte) ([]byte, error) {
	codedBuf := codec.NewBuffer(b)
	codedBuf.SetDeterministic(true)
	if err := m.marshal(codedBuf); err != nil {
		return nil, err
	}
	return codedBuf.Bytes(), nil
}

func (m *Message) marshal(b *codec.Buffer) error {
	if m.GetMessageDescriptor().GetMessageOptions().GetMessageSetWireFormat() {
		return fmt.Errorf("%s is a message set; marshaling message sets is not implemented", m.GetMessageDescriptor().GetFullyQualifiedName())
	}
	if err := m.marshalKnownFields(b); err != nil {
		return err
	}
	return m.marshalUnknownFields(b)
}

func (m *Message) marshalKnownFields(b *codec.Buffer) error {
	for _, tag := range m.knownFieldTags() {
		itag := int32(tag)
		val := m.values[itag]
		fd := m.FindFieldDescriptor(itag)
		if fd == nil {
			panic(fmt.Sprintf("Couldn't find field for tag %d", itag))
		}
		if err := b.EncodeFieldValue(fd, val); err != nil {
			return err
		}
	}
	return nil
}

func (m *Message) marshalUnknownFields(b *codec.Buffer) error {
	for _, tag := range m.unknownFieldTags() {
		itag := int32(tag)
		sl := m.unknownFields[itag]
		for _, u := range sl {
			if err := b.EncodeTagAndWireType(itag, u.Encoding); err != nil {
				return err
			}
			switch u.Encoding {
			case proto.WireBytes:
				if err := b.EncodeRawBytes(u.Contents); err != nil {
					return err
				}
			case proto.WireStartGroup:
				_, _ = b.Write(u.Contents)
				if err := b.EncodeTagAndWireType(itag, proto.WireEndGroup); err != nil {
					return err
				}
			case proto.WireFixed32:
				if err := b.EncodeFixed32(u.Value); err != nil {
					return err
				}
			case proto.WireFixed64:
				if err := b.EncodeFixed64(u.Value); err != nil {
					return err
				}
			case proto.WireVarint:
				if err := b.EncodeVarint(u.Value); err != nil {
					return err
				}
			default:
				return codec.ErrBadWireType
			}
		}
	}
	return nil
}

// Unmarshal de-serializes the message that is present in the given bytes into
// this message. It first resets the current message. It returns an error if the
// given bytes do not contain a valid encoding of this message type.
func (m *Message) Unmarshal(b []byte) error {
	m.Reset()
	if err := m.UnmarshalMerge(b); err != nil {
		return err
	}
	return m.Validate()
}

// UnmarshalMerge de-serializes the message that is present in the given bytes
// into this message. Unlike Unmarshal, it does not first reset the message,
// instead merging the data in the given bytes into the existing data in this
// message.
func (m *Message) UnmarshalMerge(b []byte) error {
	return m.unmarshal(codec.NewBuffer(b), false)
}

func (m *Message) unmarshal(buf *codec.Buffer, isGroup bool) error {
	if m.GetMessageDescriptor().GetMessageOptions().GetMessageSetWireFormat() {
		return fmt.Errorf("%s is a message set; unmarshaling message sets is not implemented", m.GetMessageDescriptor().GetFullyQualifiedName())
	}
	for !buf.EOF() {
		fd, val, err := buf.DecodeFieldValue(m.FindFieldDescriptor, m.mf)
		if err != nil {
			if err == codec.ErrWireTypeEndGroup {
				if isGroup {
					// finished parsing group
					return nil
				}
				return codec.ErrBadWireType
			}
			return err
		}

		if fd == nil {
			if m.unknownFields == nil {
				m.unknownFields = map[int32][]UnknownField{}
			}
			uv := val.(codec.UnknownField)
			u := UnknownField{
				Encoding: uv.Encoding,
				Value:    uv.Value,
				Contents: uv.Contents,
			}
			m.unknownFields[uv.Tag] = append(m.unknownFields[uv.Tag], u)
		} else if err := mergeField(m, fd, val); err != nil {
			return err
		}
	}
	if isGroup {
		return io.ErrUnexpectedEOF
	}
	return nil
}
