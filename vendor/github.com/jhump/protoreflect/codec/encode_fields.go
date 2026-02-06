package codec

import (
	"fmt"
	"math"
	"reflect"
	"sort"

	"github.com/golang/protobuf/proto"
	"google.golang.org/protobuf/types/descriptorpb"

	"github.com/jhump/protoreflect/desc"
)

// EncodeZigZag64 does zig-zag encoding to convert the given
// signed 64-bit integer into a form that can be expressed
// efficiently as a varint, even for negative values.
func EncodeZigZag64(v int64) uint64 {
	return (uint64(v) << 1) ^ uint64(v>>63)
}

// EncodeZigZag32 does zig-zag encoding to convert the given
// signed 32-bit integer into a form that can be expressed
// efficiently as a varint, even for negative values.
func EncodeZigZag32(v int32) uint64 {
	return uint64((uint32(v) << 1) ^ uint32((v >> 31)))
}

func (cb *Buffer) EncodeFieldValue(fd *desc.FieldDescriptor, val interface{}) error {
	if fd.IsMap() {
		mp := val.(map[interface{}]interface{})
		entryType := fd.GetMessageType()
		keyType := entryType.FindFieldByNumber(1)
		valType := entryType.FindFieldByNumber(2)
		var entryBuffer Buffer
		if cb.IsDeterministic() {
			entryBuffer.SetDeterministic(true)
			keys := make([]interface{}, 0, len(mp))
			for k := range mp {
				keys = append(keys, k)
			}
			sort.Sort(sortable(keys))
			for _, k := range keys {
				v := mp[k]
				entryBuffer.Reset()
				if err := entryBuffer.encodeFieldElement(keyType, k); err != nil {
					return err
				}
				rv := reflect.ValueOf(v)
				if rv.Kind() != reflect.Ptr || !rv.IsNil() {
					if err := entryBuffer.encodeFieldElement(valType, v); err != nil {
						return err
					}
				}
				if err := cb.EncodeTagAndWireType(fd.GetNumber(), proto.WireBytes); err != nil {
					return err
				}
				if err := cb.EncodeRawBytes(entryBuffer.Bytes()); err != nil {
					return err
				}
			}
		} else {
			for k, v := range mp {
				entryBuffer.Reset()
				if err := entryBuffer.encodeFieldElement(keyType, k); err != nil {
					return err
				}
				rv := reflect.ValueOf(v)
				if rv.Kind() != reflect.Ptr || !rv.IsNil() {
					if err := entryBuffer.encodeFieldElement(valType, v); err != nil {
						return err
					}
				}
				if err := cb.EncodeTagAndWireType(fd.GetNumber(), proto.WireBytes); err != nil {
					return err
				}
				if err := cb.EncodeRawBytes(entryBuffer.Bytes()); err != nil {
					return err
				}
			}
		}
		return nil
	} else if fd.IsRepeated() {
		sl := val.([]interface{})
		wt, err := getWireType(fd.GetType())
		if err != nil {
			return err
		}
		if isPacked(fd) && len(sl) > 0 &&
			(wt == proto.WireVarint || wt == proto.WireFixed32 || wt == proto.WireFixed64) {
			// packed repeated field
			var packedBuffer Buffer
			for _, v := range sl {
				if err := packedBuffer.encodeFieldValue(fd, v); err != nil {
					return err
				}
			}
			if err := cb.EncodeTagAndWireType(fd.GetNumber(), proto.WireBytes); err != nil {
				return err
			}
			return cb.EncodeRawBytes(packedBuffer.Bytes())
		} else {
			// non-packed repeated field
			for _, v := range sl {
				if err := cb.encodeFieldElement(fd, v); err != nil {
					return err
				}
			}
			return nil
		}
	} else {
		return cb.encodeFieldElement(fd, val)
	}
}

func isPacked(fd *desc.FieldDescriptor) bool {
	opts := fd.AsFieldDescriptorProto().GetOptions()
	// if set, use that value
	if opts != nil && opts.Packed != nil {
		return opts.GetPacked()
	}
	// if unset: proto2 defaults to false, proto3 to true
	return fd.GetFile().IsProto3()
}

// sortable is used to sort map keys. Values will be integers (int32, int64, uint32, and uint64),
// bools, or strings.
type sortable []interface{}

func (s sortable) Len() int {
	return len(s)
}

func (s sortable) Less(i, j int) bool {
	vi := s[i]
	vj := s[j]
	switch reflect.TypeOf(vi).Kind() {
	case reflect.Int32:
		return vi.(int32) < vj.(int32)
	case reflect.Int64:
		return vi.(int64) < vj.(int64)
	case reflect.Uint32:
		return vi.(uint32) < vj.(uint32)
	case reflect.Uint64:
		return vi.(uint64) < vj.(uint64)
	case reflect.String:
		return vi.(string) < vj.(string)
	case reflect.Bool:
		return !vi.(bool) && vj.(bool)
	default:
		panic(fmt.Sprintf("cannot compare keys of type %v", reflect.TypeOf(vi)))
	}
}

func (s sortable) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (b *Buffer) encodeFieldElement(fd *desc.FieldDescriptor, val interface{}) error {
	wt, err := getWireType(fd.GetType())
	if err != nil {
		return err
	}
	if err := b.EncodeTagAndWireType(fd.GetNumber(), wt); err != nil {
		return err
	}
	if err := b.encodeFieldValue(fd, val); err != nil {
		return err
	}
	if wt == proto.WireStartGroup {
		return b.EncodeTagAndWireType(fd.GetNumber(), proto.WireEndGroup)
	}
	return nil
}

func (b *Buffer) encodeFieldValue(fd *desc.FieldDescriptor, val interface{}) error {
	switch fd.GetType() {
	case descriptorpb.FieldDescriptorProto_TYPE_BOOL:
		v := val.(bool)
		if v {
			return b.EncodeVarint(1)
		}
		return b.EncodeVarint(0)

	case descriptorpb.FieldDescriptorProto_TYPE_ENUM,
		descriptorpb.FieldDescriptorProto_TYPE_INT32:
		v := val.(int32)
		return b.EncodeVarint(uint64(v))

	case descriptorpb.FieldDescriptorProto_TYPE_SFIXED32:
		v := val.(int32)
		return b.EncodeFixed32(uint64(v))

	case descriptorpb.FieldDescriptorProto_TYPE_SINT32:
		v := val.(int32)
		return b.EncodeVarint(EncodeZigZag32(v))

	case descriptorpb.FieldDescriptorProto_TYPE_UINT32:
		v := val.(uint32)
		return b.EncodeVarint(uint64(v))

	case descriptorpb.FieldDescriptorProto_TYPE_FIXED32:
		v := val.(uint32)
		return b.EncodeFixed32(uint64(v))

	case descriptorpb.FieldDescriptorProto_TYPE_INT64:
		v := val.(int64)
		return b.EncodeVarint(uint64(v))

	case descriptorpb.FieldDescriptorProto_TYPE_SFIXED64:
		v := val.(int64)
		return b.EncodeFixed64(uint64(v))

	case descriptorpb.FieldDescriptorProto_TYPE_SINT64:
		v := val.(int64)
		return b.EncodeVarint(EncodeZigZag64(v))

	case descriptorpb.FieldDescriptorProto_TYPE_UINT64:
		v := val.(uint64)
		return b.EncodeVarint(v)

	case descriptorpb.FieldDescriptorProto_TYPE_FIXED64:
		v := val.(uint64)
		return b.EncodeFixed64(v)

	case descriptorpb.FieldDescriptorProto_TYPE_DOUBLE:
		v := val.(float64)
		return b.EncodeFixed64(math.Float64bits(v))

	case descriptorpb.FieldDescriptorProto_TYPE_FLOAT:
		v := val.(float32)
		return b.EncodeFixed32(uint64(math.Float32bits(v)))

	case descriptorpb.FieldDescriptorProto_TYPE_BYTES:
		v := val.([]byte)
		return b.EncodeRawBytes(v)

	case descriptorpb.FieldDescriptorProto_TYPE_STRING:
		v := val.(string)
		return b.EncodeRawBytes(([]byte)(v))

	case descriptorpb.FieldDescriptorProto_TYPE_MESSAGE:
		return b.EncodeDelimitedMessage(val.(proto.Message))

	case descriptorpb.FieldDescriptorProto_TYPE_GROUP:
		// just append the nested message to this buffer
		return b.EncodeMessage(val.(proto.Message))
		// whosoever writeth start-group tag (e.g. caller) is responsible for writing end-group tag

	default:
		return fmt.Errorf("unrecognized field type: %v", fd.GetType())
	}
}

func getWireType(t descriptorpb.FieldDescriptorProto_Type) (int8, error) {
	switch t {
	case descriptorpb.FieldDescriptorProto_TYPE_ENUM,
		descriptorpb.FieldDescriptorProto_TYPE_BOOL,
		descriptorpb.FieldDescriptorProto_TYPE_INT32,
		descriptorpb.FieldDescriptorProto_TYPE_SINT32,
		descriptorpb.FieldDescriptorProto_TYPE_UINT32,
		descriptorpb.FieldDescriptorProto_TYPE_INT64,
		descriptorpb.FieldDescriptorProto_TYPE_SINT64,
		descriptorpb.FieldDescriptorProto_TYPE_UINT64:
		return proto.WireVarint, nil

	case descriptorpb.FieldDescriptorProto_TYPE_FIXED32,
		descriptorpb.FieldDescriptorProto_TYPE_SFIXED32,
		descriptorpb.FieldDescriptorProto_TYPE_FLOAT:
		return proto.WireFixed32, nil

	case descriptorpb.FieldDescriptorProto_TYPE_FIXED64,
		descriptorpb.FieldDescriptorProto_TYPE_SFIXED64,
		descriptorpb.FieldDescriptorProto_TYPE_DOUBLE:
		return proto.WireFixed64, nil

	case descriptorpb.FieldDescriptorProto_TYPE_BYTES,
		descriptorpb.FieldDescriptorProto_TYPE_STRING,
		descriptorpb.FieldDescriptorProto_TYPE_MESSAGE:
		return proto.WireBytes, nil

	case descriptorpb.FieldDescriptorProto_TYPE_GROUP:
		return proto.WireStartGroup, nil

	default:
		return 0, ErrBadWireType
	}
}
