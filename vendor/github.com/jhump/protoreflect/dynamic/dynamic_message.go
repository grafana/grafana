package dynamic

import (
	"bytes"
	"compress/gzip"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/golang/protobuf/proto"
	protov2 "google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"

	"github.com/jhump/protoreflect/codec"
	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/internal"
)

// ErrUnknownTagNumber is an error that is returned when an operation refers
// to an unknown tag number.
var ErrUnknownTagNumber = errors.New("unknown tag number")

// UnknownTagNumberError is the same as ErrUnknownTagNumber.
// Deprecated: use ErrUnknownTagNumber
var UnknownTagNumberError = ErrUnknownTagNumber

// ErrUnknownFieldName is an error that is returned when an operation refers
// to an unknown field name.
var ErrUnknownFieldName = errors.New("unknown field name")

// UnknownFieldNameError is the same as ErrUnknownFieldName.
// Deprecated: use ErrUnknownFieldName
var UnknownFieldNameError = ErrUnknownFieldName

// ErrFieldIsNotMap is an error that is returned when map-related operations
// are attempted with fields that are not maps.
var ErrFieldIsNotMap = errors.New("field is not a map type")

// FieldIsNotMapError is the same as ErrFieldIsNotMap.
// Deprecated: use ErrFieldIsNotMap
var FieldIsNotMapError = ErrFieldIsNotMap

// ErrFieldIsNotRepeated is an error that is returned when repeated field
// operations are attempted with fields that are not repeated.
var ErrFieldIsNotRepeated = errors.New("field is not repeated")

// FieldIsNotRepeatedError is the same as ErrFieldIsNotRepeated.
// Deprecated: use ErrFieldIsNotRepeated
var FieldIsNotRepeatedError = ErrFieldIsNotRepeated

// ErrIndexOutOfRange is an error that is returned when an invalid index is
// provided when access a single element of a repeated field.
var ErrIndexOutOfRange = errors.New("index is out of range")

// IndexOutOfRangeError is the same as ErrIndexOutOfRange.
// Deprecated: use ErrIndexOutOfRange
var IndexOutOfRangeError = ErrIndexOutOfRange

// ErrNumericOverflow is an error returned by operations that encounter a
// numeric value that is too large, for example de-serializing a value into an
// int32 field when the value is larger that can fit into a 32-bit value.
var ErrNumericOverflow = errors.New("numeric value is out of range")

// NumericOverflowError is the same as ErrNumericOverflow.
// Deprecated: use ErrNumericOverflow
var NumericOverflowError = ErrNumericOverflow

var typeOfProtoMessage = reflect.TypeOf((*proto.Message)(nil)).Elem()
var typeOfDynamicMessage = reflect.TypeOf((*Message)(nil))
var typeOfBytes = reflect.TypeOf(([]byte)(nil))

// Message is a dynamic protobuf message. Instead of a generated struct,
// like most protobuf messages, this is a map of field number to values and
// a message descriptor, which is used to validate the field values and
// also to de-serialize messages (from the standard binary format, as well
// as from the text format and from JSON).
type Message struct {
	md            *desc.MessageDescriptor
	er            *ExtensionRegistry
	mf            *MessageFactory
	extraFields   map[int32]*desc.FieldDescriptor
	values        map[int32]interface{}
	unknownFields map[int32][]UnknownField
}

// UnknownField represents a field that was parsed from the binary wire
// format for a message, but was not a recognized field number. Enough
// information is preserved so that re-serializing the message won't lose
// any of the unrecognized data.
type UnknownField struct {
	// Encoding indicates how the unknown field was encoded on the wire. If it
	// is proto.WireBytes or proto.WireGroupStart then Contents will be set to
	// the raw bytes. If it is proto.WireTypeFixed32 then the data is in the least
	// significant 32 bits of Value. Otherwise, the data is in all 64 bits of
	// Value.
	Encoding int8
	Contents []byte
	Value    uint64
}

// NewMessage creates a new dynamic message for the type represented by the given
// message descriptor. During de-serialization, a default MessageFactory is used to
// instantiate any nested message fields and no extension fields will be parsed. To
// use a custom MessageFactory or ExtensionRegistry, use MessageFactory.NewMessage.
func NewMessage(md *desc.MessageDescriptor) *Message {
	return NewMessageWithMessageFactory(md, nil)
}

// NewMessageWithExtensionRegistry creates a new dynamic message for the type
// represented by the given message descriptor. During de-serialization, the given
// ExtensionRegistry is used to parse extension fields and nested messages will be
// instantiated using dynamic.NewMessageFactoryWithExtensionRegistry(er).
func NewMessageWithExtensionRegistry(md *desc.MessageDescriptor, er *ExtensionRegistry) *Message {
	mf := NewMessageFactoryWithExtensionRegistry(er)
	return NewMessageWithMessageFactory(md, mf)
}

// NewMessageWithMessageFactory creates a new dynamic message for the type
// represented by the given message descriptor. During de-serialization, the given
// MessageFactory is used to instantiate nested messages.
func NewMessageWithMessageFactory(md *desc.MessageDescriptor, mf *MessageFactory) *Message {
	var er *ExtensionRegistry
	if mf != nil {
		er = mf.er
	}
	return &Message{
		md: md,
		mf: mf,
		er: er,
	}
}

// AsDynamicMessage converts the given message to a dynamic message. If the
// given message is dynamic, it is returned. Otherwise, a dynamic message is
// created using NewMessage.
func AsDynamicMessage(msg proto.Message) (*Message, error) {
	return AsDynamicMessageWithMessageFactory(msg, nil)
}

// AsDynamicMessageWithExtensionRegistry converts the given message to a dynamic
// message. If the given message is dynamic, it is returned. Otherwise, a
// dynamic message is created using NewMessageWithExtensionRegistry.
func AsDynamicMessageWithExtensionRegistry(msg proto.Message, er *ExtensionRegistry) (*Message, error) {
	mf := NewMessageFactoryWithExtensionRegistry(er)
	return AsDynamicMessageWithMessageFactory(msg, mf)
}

// AsDynamicMessageWithMessageFactory converts the given message to a dynamic
// message. If the given message is dynamic, it is returned. Otherwise, a
// dynamic message is created using NewMessageWithMessageFactory.
func AsDynamicMessageWithMessageFactory(msg proto.Message, mf *MessageFactory) (*Message, error) {
	if dm, ok := msg.(*Message); ok {
		return dm, nil
	}
	md, err := desc.LoadMessageDescriptorForMessage(msg)
	if err != nil {
		return nil, err
	}
	dm := NewMessageWithMessageFactory(md, mf)
	err = dm.mergeFrom(msg)
	if err != nil {
		return nil, err
	}
	return dm, nil
}

// GetMessageDescriptor returns a descriptor for this message's type.
func (m *Message) GetMessageDescriptor() *desc.MessageDescriptor {
	return m.md
}

// GetKnownFields returns a slice of descriptors for all known fields. The
// fields will not be in any defined order.
func (m *Message) GetKnownFields() []*desc.FieldDescriptor {
	if len(m.extraFields) == 0 {
		return m.md.GetFields()
	}
	flds := make([]*desc.FieldDescriptor, len(m.md.GetFields()), len(m.md.GetFields())+len(m.extraFields))
	copy(flds, m.md.GetFields())
	for _, fld := range m.extraFields {
		if !fld.IsExtension() {
			flds = append(flds, fld)
		}
	}
	return flds
}

// GetKnownExtensions returns a slice of descriptors for all extensions known by
// the message's extension registry. The fields will not be in any defined order.
func (m *Message) GetKnownExtensions() []*desc.FieldDescriptor {
	if !m.md.IsExtendable() {
		return nil
	}
	exts := m.er.AllExtensionsForType(m.md.GetFullyQualifiedName())
	for _, fld := range m.extraFields {
		if fld.IsExtension() {
			exts = append(exts, fld)
		}
	}
	return exts
}

// GetUnknownFields returns a slice of tag numbers for all unknown fields that
// this message contains. The tags will not be in any defined order.
func (m *Message) GetUnknownFields() []int32 {
	flds := make([]int32, 0, len(m.unknownFields))
	for tag := range m.unknownFields {
		flds = append(flds, tag)
	}
	return flds
}

// Descriptor returns the serialized form of the file descriptor in which the
// message was defined and a path to the message type therein. This mimics the
// method of the same name on message types generated by protoc.
func (m *Message) Descriptor() ([]byte, []int) {
	// get encoded file descriptor
	b, err := proto.Marshal(m.md.GetFile().AsProto())
	if err != nil {
		panic(fmt.Sprintf("failed to get encoded descriptor for %s: %v", m.md.GetFile().GetName(), err))
	}
	var zippedBytes bytes.Buffer
	w := gzip.NewWriter(&zippedBytes)
	if _, err := w.Write(b); err != nil {
		panic(fmt.Sprintf("failed to get encoded descriptor for %s: %v", m.md.GetFile().GetName(), err))
	}
	if err := w.Close(); err != nil {
		panic(fmt.Sprintf("failed to get an encoded descriptor for %s: %v", m.md.GetFile().GetName(), err))
	}

	// and path to message
	path := []int{}
	var d desc.Descriptor
	name := m.md.GetFullyQualifiedName()
	for d = m.md.GetParent(); d != nil; name, d = d.GetFullyQualifiedName(), d.GetParent() {
		found := false
		switch d := d.(type) {
		case (*desc.FileDescriptor):
			for i, md := range d.GetMessageTypes() {
				if md.GetFullyQualifiedName() == name {
					found = true
					path = append(path, i)
				}
			}
		case (*desc.MessageDescriptor):
			for i, md := range d.GetNestedMessageTypes() {
				if md.GetFullyQualifiedName() == name {
					found = true
					path = append(path, i)
				}
			}
		}
		if !found {
			panic(fmt.Sprintf("failed to compute descriptor path for %s", m.md.GetFullyQualifiedName()))
		}
	}
	// reverse the path
	i := 0
	j := len(path) - 1
	for i < j {
		path[i], path[j] = path[j], path[i]
		i++
		j--
	}

	return zippedBytes.Bytes(), path
}

// XXX_MessageName returns the fully qualified name of this message's type. This
// allows dynamic messages to be used with proto.MessageName.
func (m *Message) XXX_MessageName() string {
	return m.md.GetFullyQualifiedName()
}

// FindFieldDescriptor returns a field descriptor for the given tag number. This
// searches known fields in the descriptor, known fields discovered during calls
// to GetField or SetField, and extension fields known by the message's extension
// registry. It returns nil if the tag is unknown.
func (m *Message) FindFieldDescriptor(tagNumber int32) *desc.FieldDescriptor {
	fd := m.md.FindFieldByNumber(tagNumber)
	if fd != nil {
		return fd
	}
	fd = m.er.FindExtension(m.md.GetFullyQualifiedName(), tagNumber)
	if fd != nil {
		return fd
	}
	return m.extraFields[tagNumber]
}

// FindFieldDescriptorByName returns a field descriptor for the given field
// name. This searches known fields in the descriptor, known fields discovered
// during calls to GetField or SetField, and extension fields known by the
// message's extension registry. It returns nil if the name is unknown. If the
// given name refers to an extension, it should be fully qualified and may be
// optionally enclosed in parentheses or brackets.
func (m *Message) FindFieldDescriptorByName(name string) *desc.FieldDescriptor {
	if name == "" {
		return nil
	}
	fd := m.md.FindFieldByName(name)
	if fd != nil {
		return fd
	}
	mustBeExt := false
	if name[0] == '(' {
		if name[len(name)-1] != ')' {
			// malformed name
			return nil
		}
		mustBeExt = true
		name = name[1 : len(name)-1]
	} else if name[0] == '[' {
		if name[len(name)-1] != ']' {
			// malformed name
			return nil
		}
		mustBeExt = true
		name = name[1 : len(name)-1]
	}
	fd = m.er.FindExtensionByName(m.md.GetFullyQualifiedName(), name)
	if fd != nil {
		return fd
	}
	for _, fd := range m.extraFields {
		if fd.IsExtension() && name == fd.GetFullyQualifiedName() {
			return fd
		} else if !mustBeExt && !fd.IsExtension() && name == fd.GetName() {
			return fd
		}
	}

	return nil
}

// FindFieldDescriptorByJSONName returns a field descriptor for the given JSON
// name. This searches known fields in the descriptor, known fields discovered
// during calls to GetField or SetField, and extension fields known by the
// message's extension registry. If no field matches the given JSON name, it
// will fall back to searching field names (e.g. FindFieldDescriptorByName). If
// this also yields no match, nil is returned.
func (m *Message) FindFieldDescriptorByJSONName(name string) *desc.FieldDescriptor {
	if name == "" {
		return nil
	}
	fd := m.md.FindFieldByJSONName(name)
	if fd != nil {
		return fd
	}
	mustBeExt := false
	if name[0] == '(' {
		if name[len(name)-1] != ')' {
			// malformed name
			return nil
		}
		mustBeExt = true
		name = name[1 : len(name)-1]
	} else if name[0] == '[' {
		if name[len(name)-1] != ']' {
			// malformed name
			return nil
		}
		mustBeExt = true
		name = name[1 : len(name)-1]
	}
	fd = m.er.FindExtensionByJSONName(m.md.GetFullyQualifiedName(), name)
	if fd != nil {
		return fd
	}
	for _, fd := range m.extraFields {
		if fd.IsExtension() && name == fd.GetFullyQualifiedJSONName() {
			return fd
		} else if !mustBeExt && !fd.IsExtension() && name == fd.GetJSONName() {
			return fd
		}
	}

	// try non-JSON names
	return m.FindFieldDescriptorByName(name)
}

func (m *Message) checkField(fd *desc.FieldDescriptor) error {
	return checkField(fd, m.md)
}

func checkField(fd *desc.FieldDescriptor, md *desc.MessageDescriptor) error {
	if fd.GetOwner().GetFullyQualifiedName() != md.GetFullyQualifiedName() {
		return fmt.Errorf("given field, %s, is for wrong message type: %s; expecting %s", fd.GetName(), fd.GetOwner().GetFullyQualifiedName(), md.GetFullyQualifiedName())
	}
	if fd.IsExtension() && !md.IsExtension(fd.GetNumber()) {
		return fmt.Errorf("given field, %s, is an extension but is not in message extension range: %v", fd.GetFullyQualifiedName(), md.GetExtensionRanges())
	}
	return nil
}

// GetField returns the value for the given field descriptor. It panics if an
// error is encountered. See TryGetField.
func (m *Message) GetField(fd *desc.FieldDescriptor) interface{} {
	if v, err := m.TryGetField(fd); err != nil {
		panic(err.Error())
	} else {
		return v
	}
}

// TryGetField returns the value for the given field descriptor. An error is
// returned if the given field descriptor does not belong to the right message
// type.
//
// The Go type of the returned value, for scalar fields, is the same as protoc
// would generate for the field (in a non-dynamic message). The table below
// lists the scalar types and the corresponding Go types.
//
//	+-------------------------+-----------+
//	|       Declared Type     |  Go Type  |
//	+-------------------------+-----------+
//	| int32, sint32, sfixed32 | int32     |
//	| int64, sint64, sfixed64 | int64     |
//	| uint32, fixed32         | uint32    |
//	| uint64, fixed64         | uint64    |
//	| float                   | float32   |
//	| double                  | double32  |
//	| bool                    | bool      |
//	| string                  | string    |
//	| bytes                   | []byte    |
//	+-------------------------+-----------+
//
// Values for enum fields will always be int32 values. You can use the enum
// descriptor associated with the field to lookup value names with those values.
// Values for message type fields may be an instance of the generated type *or*
// may be another *dynamic.Message that represents the type.
//
// If the given field is a map field, the returned type will be
// map[interface{}]interface{}. The actual concrete types of keys and values is
// as described above. If the given field is a (non-map) repeated field, the
// returned type is always []interface{}; the type of the actual elements is as
// described above.
//
// If this message has no value for the given field, its default value is
// returned. If the message is defined in a file with "proto3" syntax, the
// default is always the zero value for the field. The default value for map and
// repeated fields is a nil map or slice (respectively). For field's whose types
// is a message, the default value is an empty message for "proto2" syntax or a
// nil message for "proto3" syntax. Note that the in the latter case, a non-nil
// interface with a nil pointer is returned, not a nil interface. Also note that
// whether the returned value is an empty message or nil depends on if *this*
// message was defined as "proto3" syntax, not the message type referred to by
// the field's type.
//
// If the given field descriptor is not known (e.g. not present in the message
// descriptor) but corresponds to an unknown field, the unknown value will be
// parsed and become known. The parsed value will be returned, or an error will
// be returned if the unknown value cannot be parsed according to the field
// descriptor's type information.
func (m *Message) TryGetField(fd *desc.FieldDescriptor) (interface{}, error) {
	if err := m.checkField(fd); err != nil {
		return nil, err
	}
	return m.getField(fd)
}

// GetFieldByName returns the value for the field with the given name. It panics
// if an error is encountered. See TryGetFieldByName.
func (m *Message) GetFieldByName(name string) interface{} {
	if v, err := m.TryGetFieldByName(name); err != nil {
		panic(err.Error())
	} else {
		return v
	}
}

// TryGetFieldByName returns the value for the field with the given name. An
// error is returned if the given name is unknown. If the given name refers to
// an extension field, it should be fully qualified and optionally enclosed in
// parenthesis or brackets.
//
// If this message has no value for the given field, its default value is
// returned. (See TryGetField for more info on types and default field values.)
func (m *Message) TryGetFieldByName(name string) (interface{}, error) {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return nil, UnknownFieldNameError
	}
	return m.getField(fd)
}

// GetFieldByNumber returns the value for the field with the given tag number.
// It panics if an error is encountered. See TryGetFieldByNumber.
func (m *Message) GetFieldByNumber(tagNumber int) interface{} {
	if v, err := m.TryGetFieldByNumber(tagNumber); err != nil {
		panic(err.Error())
	} else {
		return v
	}
}

// TryGetFieldByNumber returns the value for the field with the given tag
// number. An error is returned if the given tag is unknown.
//
// If this message has no value for the given field, its default value is
// returned. (See TryGetField for more info on types and default field values.)
func (m *Message) TryGetFieldByNumber(tagNumber int) (interface{}, error) {
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return nil, UnknownTagNumberError
	}
	return m.getField(fd)
}

func (m *Message) getField(fd *desc.FieldDescriptor) (interface{}, error) {
	return m.doGetField(fd, false)
}

func (m *Message) doGetField(fd *desc.FieldDescriptor, nilIfAbsent bool) (interface{}, error) {
	res := m.values[fd.GetNumber()]
	if res == nil {
		var err error
		if res, err = m.parseUnknownField(fd); err != nil {
			return nil, err
		}
		if res == nil {
			if nilIfAbsent {
				return nil, nil
			} else {
				def := fd.GetDefaultValue()
				if def != nil {
					return def, nil
				}
				// GetDefaultValue only returns nil for message types
				md := fd.GetMessageType()
				if m.md.IsProto3() {
					return nilMessage(md), nil
				} else {
					// for proto2, return default instance of message
					return m.mf.NewMessage(md), nil
				}
			}
		}
	}
	rt := reflect.TypeOf(res)
	if rt.Kind() == reflect.Map {
		// make defensive copies to prevent caller from storing illegal keys and values
		m := res.(map[interface{}]interface{})
		res := map[interface{}]interface{}{}
		for k, v := range m {
			res[k] = v
		}
		return res, nil
	} else if rt.Kind() == reflect.Slice && rt != typeOfBytes {
		// make defensive copies to prevent caller from storing illegal elements
		sl := res.([]interface{})
		res := make([]interface{}, len(sl))
		copy(res, sl)
		return res, nil
	}
	return res, nil
}

func nilMessage(md *desc.MessageDescriptor) interface{} {
	// try to return a proper nil pointer
	msgType := proto.MessageType(md.GetFullyQualifiedName())
	if msgType != nil && msgType.Implements(typeOfProtoMessage) {
		return reflect.Zero(msgType).Interface().(proto.Message)
	}
	// fallback to nil dynamic message pointer
	return (*Message)(nil)
}

// HasField returns true if this message has a value for the given field. If the
// given field is not valid (e.g. belongs to a different message type), false is
// returned. If this message is defined in a file with "proto3" syntax, this
// will return false even if a field was explicitly assigned its zero value (the
// zero values for a field are intentionally indistinguishable from absent).
func (m *Message) HasField(fd *desc.FieldDescriptor) bool {
	if err := m.checkField(fd); err != nil {
		return false
	}
	return m.HasFieldNumber(int(fd.GetNumber()))
}

// HasFieldName returns true if this message has a value for a field with the
// given name. If the given name is unknown, this returns false.
func (m *Message) HasFieldName(name string) bool {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return false
	}
	return m.HasFieldNumber(int(fd.GetNumber()))
}

// HasFieldNumber returns true if this message has a value for a field with the
// given tag number. If the given tag is unknown, this returns false.
func (m *Message) HasFieldNumber(tagNumber int) bool {
	if _, ok := m.values[int32(tagNumber)]; ok {
		return true
	}
	_, ok := m.unknownFields[int32(tagNumber)]
	return ok
}

// SetField sets the value for the given field descriptor to the given value. It
// panics if an error is encountered. See TrySetField.
func (m *Message) SetField(fd *desc.FieldDescriptor, val interface{}) {
	if err := m.TrySetField(fd, val); err != nil {
		panic(err.Error())
	}
}

// TrySetField sets the value for the given field descriptor to the given value.
// An error is returned if the given field descriptor does not belong to the
// right message type or if the given value is not a correct/compatible type for
// the given field.
//
// The Go type expected for a field  is the same as TryGetField would return for
// the field. So message values can be supplied as either the correct generated
// message type or as a *dynamic.Message.
//
// Since it is cumbersome to work with dynamic messages, some concessions are
// made to simplify usage regarding types:
//
//  1. If a numeric type is provided that can be converted *without loss or
//     overflow*, it is accepted. This allows for setting int64 fields using int
//     or int32 values. Similarly for uint64 with uint and uint32 values and for
//     float64 fields with float32 values.
//  2. The value can be a named type, as long as its underlying type is correct.
//  3. Map and repeated fields can be set using any kind of concrete map or
//     slice type, as long as the values within are all of the correct type. So
//     a field defined as a 'map<string, int32>` can be set using a
//     map[string]int32, a map[string]interface{}, or even a
//     map[interface{}]interface{}.
//  4. Finally, dynamic code that chooses to not treat maps as a special-case
//     find that they can set map fields using a slice where each element is a
//     message that matches the implicit map-entry field message type.
//
// If the given field descriptor is not known (e.g. not present in the message
// descriptor) it will become known. Subsequent operations using tag numbers or
// names will be able to resolve the newly-known type. If the message has a
// value for the unknown value, it is cleared, replaced by the given known
// value.
func (m *Message) TrySetField(fd *desc.FieldDescriptor, val interface{}) error {
	if err := m.checkField(fd); err != nil {
		return err
	}
	return m.setField(fd, val)
}

// SetFieldByName sets the value for the field with the given name to the given
// value. It panics if an error is encountered. See TrySetFieldByName.
func (m *Message) SetFieldByName(name string, val interface{}) {
	if err := m.TrySetFieldByName(name, val); err != nil {
		panic(err.Error())
	}
}

// TrySetFieldByName sets the value for the field with the given name to the
// given value. An error is returned if the given name is unknown or if the
// given value has an incorrect type. If the given name refers to an extension
// field, it should be fully qualified and optionally enclosed in parenthesis or
// brackets.
//
// (See TrySetField for more info on types.)
func (m *Message) TrySetFieldByName(name string, val interface{}) error {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return UnknownFieldNameError
	}
	return m.setField(fd, val)
}

// SetFieldByNumber sets the value for the field with the given tag number to
// the given value. It panics if an error is encountered. See
// TrySetFieldByNumber.
func (m *Message) SetFieldByNumber(tagNumber int, val interface{}) {
	if err := m.TrySetFieldByNumber(tagNumber, val); err != nil {
		panic(err.Error())
	}
}

// TrySetFieldByNumber sets the value for the field with the given tag number to
// the given value. An error is returned if the given tag is unknown or if the
// given value has an incorrect type.
//
// (See TrySetField for more info on types.)
func (m *Message) TrySetFieldByNumber(tagNumber int, val interface{}) error {
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return UnknownTagNumberError
	}
	return m.setField(fd, val)
}

func (m *Message) setField(fd *desc.FieldDescriptor, val interface{}) error {
	var err error
	if val, err = validFieldValue(fd, val); err != nil {
		return err
	}
	m.internalSetField(fd, val)
	return nil
}

func (m *Message) internalSetField(fd *desc.FieldDescriptor, val interface{}) {
	if fd.IsRepeated() {
		// Unset fields and zero-length fields are indistinguishable, in both
		// proto2 and proto3 syntax
		if reflect.ValueOf(val).Len() == 0 {
			if m.values != nil {
				delete(m.values, fd.GetNumber())
			}
			return
		}
	} else if m.md.IsProto3() && fd.GetOneOf() == nil {
		// proto3 considers fields that are set to their zero value as unset
		// (we already handled repeated fields above)
		var equal bool
		if b, ok := val.([]byte); ok {
			// can't compare slices, so we have to special-case []byte values
			equal = ok && bytes.Equal(b, fd.GetDefaultValue().([]byte))
		} else {
			defVal := fd.GetDefaultValue()
			equal = defVal == val
			if !equal && defVal == nil {
				// above just checks if value is the nil interface,
				// but we should also test if the given value is a
				// nil pointer
				rv := reflect.ValueOf(val)
				if rv.Kind() == reflect.Ptr && rv.IsNil() {
					equal = true
				}
			}
		}
		if equal {
			if m.values != nil {
				delete(m.values, fd.GetNumber())
			}
			return
		}
	}
	if m.values == nil {
		m.values = map[int32]interface{}{}
	}
	m.values[fd.GetNumber()] = val
	// if this field is part of a one-of, make sure all other one-of choices are cleared
	od := fd.GetOneOf()
	if od != nil {
		for _, other := range od.GetChoices() {
			if other.GetNumber() != fd.GetNumber() {
				delete(m.values, other.GetNumber())
			}
		}
	}
	// also clear any unknown fields
	if m.unknownFields != nil {
		delete(m.unknownFields, fd.GetNumber())
	}
	// and add this field if it was previously unknown
	if existing := m.FindFieldDescriptor(fd.GetNumber()); existing == nil {
		m.addField(fd)
	}
}

func (m *Message) addField(fd *desc.FieldDescriptor) {
	if m.extraFields == nil {
		m.extraFields = map[int32]*desc.FieldDescriptor{}
	}
	m.extraFields[fd.GetNumber()] = fd
}

// ClearField removes any value for the given field. It panics if an error is
// encountered. See TryClearField.
func (m *Message) ClearField(fd *desc.FieldDescriptor) {
	if err := m.TryClearField(fd); err != nil {
		panic(err.Error())
	}
}

// TryClearField removes any value for the given field. An error is returned if
// the given field descriptor does not belong to the right message type.
func (m *Message) TryClearField(fd *desc.FieldDescriptor) error {
	if err := m.checkField(fd); err != nil {
		return err
	}
	m.clearField(fd)
	return nil
}

// ClearFieldByName removes any value for the field with the given name. It
// panics if an error is encountered. See TryClearFieldByName.
func (m *Message) ClearFieldByName(name string) {
	if err := m.TryClearFieldByName(name); err != nil {
		panic(err.Error())
	}
}

// TryClearFieldByName removes any value for the field with the given name. An
// error is returned if the given name is unknown. If the given name refers to
// an extension field, it should be fully qualified and optionally enclosed in
// parenthesis or brackets.
func (m *Message) TryClearFieldByName(name string) error {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return UnknownFieldNameError
	}
	m.clearField(fd)
	return nil
}

// ClearFieldByNumber removes any value for the field with the given tag number.
// It panics if an error is encountered. See TryClearFieldByNumber.
func (m *Message) ClearFieldByNumber(tagNumber int) {
	if err := m.TryClearFieldByNumber(tagNumber); err != nil {
		panic(err.Error())
	}
}

// TryClearFieldByNumber removes any value for the field with the given tag
// number. An error is returned if the given tag is unknown.
func (m *Message) TryClearFieldByNumber(tagNumber int) error {
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return UnknownTagNumberError
	}
	m.clearField(fd)
	return nil
}

func (m *Message) clearField(fd *desc.FieldDescriptor) {
	// clear value
	if m.values != nil {
		delete(m.values, fd.GetNumber())
	}
	// also clear any unknown fields
	if m.unknownFields != nil {
		delete(m.unknownFields, fd.GetNumber())
	}
	// and add this field if it was previously unknown
	if existing := m.FindFieldDescriptor(fd.GetNumber()); existing == nil {
		m.addField(fd)
	}
}

// GetOneOfField returns which of the given one-of's fields is set and the
// corresponding value. It panics if an error is encountered. See
// TryGetOneOfField.
func (m *Message) GetOneOfField(od *desc.OneOfDescriptor) (*desc.FieldDescriptor, interface{}) {
	if fd, val, err := m.TryGetOneOfField(od); err != nil {
		panic(err.Error())
	} else {
		return fd, val
	}
}

// TryGetOneOfField returns which of the given one-of's fields is set and the
// corresponding value. An error is returned if the given one-of belongs to the
// wrong message type. If the given one-of has no field set, this method will
// return nil, nil.
//
// The type of the value, if one is set, is the same as would be returned by
// TryGetField using the returned field descriptor.
//
// Like with TryGetField, if the given one-of contains any fields that are not
// known (e.g. not present in this message's descriptor), they will become known
// and any unknown value will be parsed (and become a known value on success).
func (m *Message) TryGetOneOfField(od *desc.OneOfDescriptor) (*desc.FieldDescriptor, interface{}, error) {
	if od.GetOwner().GetFullyQualifiedName() != m.md.GetFullyQualifiedName() {
		return nil, nil, fmt.Errorf("given one-of, %s, is for wrong message type: %s; expecting %s", od.GetName(), od.GetOwner().GetFullyQualifiedName(), m.md.GetFullyQualifiedName())
	}
	for _, fd := range od.GetChoices() {
		val, err := m.doGetField(fd, true)
		if err != nil {
			return nil, nil, err
		}
		if val != nil {
			return fd, val, nil
		}
	}
	return nil, nil, nil
}

// ClearOneOfField removes any value for any of the given one-of's fields. It
// panics if an error is encountered. See TryClearOneOfField.
func (m *Message) ClearOneOfField(od *desc.OneOfDescriptor) {
	if err := m.TryClearOneOfField(od); err != nil {
		panic(err.Error())
	}
}

// TryClearOneOfField removes any value for any of the given one-of's fields. An
// error is returned if the given one-of descriptor does not belong to the right
// message type.
func (m *Message) TryClearOneOfField(od *desc.OneOfDescriptor) error {
	if od.GetOwner().GetFullyQualifiedName() != m.md.GetFullyQualifiedName() {
		return fmt.Errorf("given one-of, %s, is for wrong message type: %s; expecting %s", od.GetName(), od.GetOwner().GetFullyQualifiedName(), m.md.GetFullyQualifiedName())
	}
	for _, fd := range od.GetChoices() {
		m.clearField(fd)
	}
	return nil
}

// GetMapField returns the value for the given map field descriptor and given
// key. It panics if an error is encountered. See TryGetMapField.
func (m *Message) GetMapField(fd *desc.FieldDescriptor, key interface{}) interface{} {
	if v, err := m.TryGetMapField(fd, key); err != nil {
		panic(err.Error())
	} else {
		return v
	}
}

// TryGetMapField returns the value for the given map field descriptor and given
// key. An error is returned if the given field descriptor does not belong to
// the right message type or if it is not a map field.
//
// If the map field does not contain the requested key, this method returns
// nil, nil. The Go type of the value returned mirrors the type that protoc
// would generate for the field. (See TryGetField for more details on types).
//
// If the given field descriptor is not known (e.g. not present in the message
// descriptor) but corresponds to an unknown field, the unknown value will be
// parsed and become known. The parsed value will be searched for the requested
// key and any value returned. An error will be returned if the unknown value
// cannot be parsed according to the field descriptor's type information.
func (m *Message) TryGetMapField(fd *desc.FieldDescriptor, key interface{}) (interface{}, error) {
	if err := m.checkField(fd); err != nil {
		return nil, err
	}
	return m.getMapField(fd, key)
}

// GetMapFieldByName returns the value for the map field with the given name and
// given key. It panics if an error is encountered. See TryGetMapFieldByName.
func (m *Message) GetMapFieldByName(name string, key interface{}) interface{} {
	if v, err := m.TryGetMapFieldByName(name, key); err != nil {
		panic(err.Error())
	} else {
		return v
	}
}

// TryGetMapFieldByName returns the value for the map field with the given name
// and given key. An error is returned if the given name is unknown or if it
// names a field that is not a map field.
//
// If this message has no value for the given field or the value has no value
// for the requested key, then this method returns nil, nil.
//
// (See TryGetField for more info on types.)
func (m *Message) TryGetMapFieldByName(name string, key interface{}) (interface{}, error) {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return nil, UnknownFieldNameError
	}
	return m.getMapField(fd, key)
}

// GetMapFieldByNumber returns the value for the map field with the given tag
// number and given key. It panics if an error is encountered. See
// TryGetMapFieldByNumber.
func (m *Message) GetMapFieldByNumber(tagNumber int, key interface{}) interface{} {
	if v, err := m.TryGetMapFieldByNumber(tagNumber, key); err != nil {
		panic(err.Error())
	} else {
		return v
	}
}

// TryGetMapFieldByNumber returns the value for the map field with the given tag
// number and given key. An error is returned if the given tag is unknown or if
// it indicates a field that is not a map field.
//
// If this message has no value for the given field or the value has no value
// for the requested key, then this method returns nil, nil.
//
// (See TryGetField for more info on types.)
func (m *Message) TryGetMapFieldByNumber(tagNumber int, key interface{}) (interface{}, error) {
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return nil, UnknownTagNumberError
	}
	return m.getMapField(fd, key)
}

func (m *Message) getMapField(fd *desc.FieldDescriptor, key interface{}) (interface{}, error) {
	if !fd.IsMap() {
		return nil, FieldIsNotMapError
	}
	kfd := fd.GetMessageType().GetFields()[0]
	ki, err := validElementFieldValue(kfd, key, false)
	if err != nil {
		return nil, err
	}
	mp := m.values[fd.GetNumber()]
	if mp == nil {
		if mp, err = m.parseUnknownField(fd); err != nil {
			return nil, err
		} else if mp == nil {
			return nil, nil
		}
	}
	return mp.(map[interface{}]interface{})[ki], nil
}

// ForEachMapFieldEntry executes the given function for each entry in the map
// value for the given field descriptor. It stops iteration if the function
// returns false. It panics if an error is encountered. See
// TryForEachMapFieldEntry.
func (m *Message) ForEachMapFieldEntry(fd *desc.FieldDescriptor, fn func(key, val interface{}) bool) {
	if err := m.TryForEachMapFieldEntry(fd, fn); err != nil {
		panic(err.Error())
	}
}

// TryForEachMapFieldEntry executes the given function for each entry in the map
// value for the given field descriptor. An error is returned if the given field
// descriptor does not belong to the right message type or if it is not a  map
// field.
//
// Iteration ends either when all entries have been examined or when the given
// function returns false. So the function is expected to return true for normal
// iteration and false to break out. If this message has no value for the given
// field, it returns without invoking the given function.
//
// The Go type of the key and value supplied to the function mirrors the type
// that protoc would generate for the field. (See TryGetField for more details
// on types).
//
// If the given field descriptor is not known (e.g. not present in the message
// descriptor) but corresponds to an unknown field, the unknown value will be
// parsed and become known. The parsed value will be searched for the requested
// key and any value returned. An error will be returned if the unknown value
// cannot be parsed according to the field descriptor's type information.
func (m *Message) TryForEachMapFieldEntry(fd *desc.FieldDescriptor, fn func(key, val interface{}) bool) error {
	if err := m.checkField(fd); err != nil {
		return err
	}
	return m.forEachMapFieldEntry(fd, fn)
}

// ForEachMapFieldEntryByName executes the given function for each entry in the
// map value for the field with the given name. It stops iteration if the
// function returns false. It panics if an error is encountered. See
// TryForEachMapFieldEntryByName.
func (m *Message) ForEachMapFieldEntryByName(name string, fn func(key, val interface{}) bool) {
	if err := m.TryForEachMapFieldEntryByName(name, fn); err != nil {
		panic(err.Error())
	}
}

// TryForEachMapFieldEntryByName executes the given function for each entry in
// the map value for the field with the given name. It stops iteration if the
// function returns false. An error is returned if the given name is unknown or
// if it names a field that is not a map field.
//
// If this message has no value for the given field, it returns without ever
// invoking the given function.
//
// (See TryGetField for more info on types supplied to the function.)
func (m *Message) TryForEachMapFieldEntryByName(name string, fn func(key, val interface{}) bool) error {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return UnknownFieldNameError
	}
	return m.forEachMapFieldEntry(fd, fn)
}

// ForEachMapFieldEntryByNumber executes the given function for each entry in
// the map value for the field with the given tag number. It stops iteration if
// the function returns false. It panics if an error is encountered. See
// TryForEachMapFieldEntryByNumber.
func (m *Message) ForEachMapFieldEntryByNumber(tagNumber int, fn func(key, val interface{}) bool) {
	if err := m.TryForEachMapFieldEntryByNumber(tagNumber, fn); err != nil {
		panic(err.Error())
	}
}

// TryForEachMapFieldEntryByNumber executes the given function for each entry in
// the map value for the field with the given tag number. It stops iteration if
// the function returns false. An error is returned if the given tag is unknown
// or if it indicates a field that is not a map field.
//
// If this message has no value for the given field, it returns without ever
// invoking the given function.
//
// (See TryGetField for more info on types supplied to the function.)
func (m *Message) TryForEachMapFieldEntryByNumber(tagNumber int, fn func(key, val interface{}) bool) error {
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return UnknownTagNumberError
	}
	return m.forEachMapFieldEntry(fd, fn)
}

func (m *Message) forEachMapFieldEntry(fd *desc.FieldDescriptor, fn func(key, val interface{}) bool) error {
	if !fd.IsMap() {
		return FieldIsNotMapError
	}
	mp := m.values[fd.GetNumber()]
	if mp == nil {
		if mp, err := m.parseUnknownField(fd); err != nil {
			return err
		} else if mp == nil {
			return nil
		}
	}
	for k, v := range mp.(map[interface{}]interface{}) {
		if !fn(k, v) {
			break
		}
	}
	return nil
}

// PutMapField sets the value for the given map field descriptor and given key
// to the given value. It panics if an error is encountered. See TryPutMapField.
func (m *Message) PutMapField(fd *desc.FieldDescriptor, key interface{}, val interface{}) {
	if err := m.TryPutMapField(fd, key, val); err != nil {
		panic(err.Error())
	}
}

// TryPutMapField sets the value for the given map field descriptor and given
// key to the given value. An error is returned if the given field descriptor
// does not belong to the right message type, if the given field is not a map
// field, or if the given value is not a correct/compatible type for the given
// field.
//
// The Go type expected for a field  is the same as required by TrySetField for
// a field with the same type as the map's value type.
//
// If the given field descriptor is not known (e.g. not present in the message
// descriptor) it will become known. Subsequent operations using tag numbers or
// names will be able to resolve the newly-known type. If the message has a
// value for the unknown value, it is cleared, replaced by the given known
// value.
func (m *Message) TryPutMapField(fd *desc.FieldDescriptor, key interface{}, val interface{}) error {
	if err := m.checkField(fd); err != nil {
		return err
	}
	return m.putMapField(fd, key, val)
}

// PutMapFieldByName sets the value for the map field with the given name and
// given key to the given value. It panics if an error is encountered. See
// TryPutMapFieldByName.
func (m *Message) PutMapFieldByName(name string, key interface{}, val interface{}) {
	if err := m.TryPutMapFieldByName(name, key, val); err != nil {
		panic(err.Error())
	}
}

// TryPutMapFieldByName sets the value for the map field with the given name and
// the given key to the given value. An error is returned if the given name is
// unknown, if it names a field that is not a map, or if the given value has an
// incorrect type.
//
// (See TrySetField for more info on types.)
func (m *Message) TryPutMapFieldByName(name string, key interface{}, val interface{}) error {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return UnknownFieldNameError
	}
	return m.putMapField(fd, key, val)
}

// PutMapFieldByNumber sets the value for the map field with the given tag
// number and given key to the given value. It panics if an error is
// encountered. See TryPutMapFieldByNumber.
func (m *Message) PutMapFieldByNumber(tagNumber int, key interface{}, val interface{}) {
	if err := m.TryPutMapFieldByNumber(tagNumber, key, val); err != nil {
		panic(err.Error())
	}
}

// TryPutMapFieldByNumber sets the value for the map field with the given tag
// number and the given key to the given value. An error is returned if the
// given tag is unknown, if it indicates a field that is not a map, or if the
// given value has an incorrect type.
//
// (See TrySetField for more info on types.)
func (m *Message) TryPutMapFieldByNumber(tagNumber int, key interface{}, val interface{}) error {
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return UnknownTagNumberError
	}
	return m.putMapField(fd, key, val)
}

func (m *Message) putMapField(fd *desc.FieldDescriptor, key interface{}, val interface{}) error {
	if !fd.IsMap() {
		return FieldIsNotMapError
	}
	kfd := fd.GetMessageType().GetFields()[0]
	ki, err := validElementFieldValue(kfd, key, false)
	if err != nil {
		return err
	}
	vfd := fd.GetMessageType().GetFields()[1]
	vi, err := validElementFieldValue(vfd, val, true)
	if err != nil {
		return err
	}
	mp := m.values[fd.GetNumber()]
	if mp == nil {
		if mp, err = m.parseUnknownField(fd); err != nil {
			return err
		} else if mp == nil {
			m.internalSetField(fd, map[interface{}]interface{}{ki: vi})
			return nil
		}
	}
	mp.(map[interface{}]interface{})[ki] = vi
	return nil
}

// RemoveMapField changes the value for the given field descriptor by removing
// any value associated with the given key. It panics if an error is
// encountered. See TryRemoveMapField.
func (m *Message) RemoveMapField(fd *desc.FieldDescriptor, key interface{}) {
	if err := m.TryRemoveMapField(fd, key); err != nil {
		panic(err.Error())
	}
}

// TryRemoveMapField changes the value for the given field descriptor by
// removing any value associated with the given key. An error is returned if the
// given field descriptor does not belong to the right message type or if the
// given field is not a map field.
//
// If the given field descriptor is not known (e.g. not present in the message
// descriptor) it will become known. Subsequent operations using tag numbers or
// names will be able to resolve the newly-known type. If the message has a
// value for the unknown value, it is parsed and any value for the given key
// removed.
func (m *Message) TryRemoveMapField(fd *desc.FieldDescriptor, key interface{}) error {
	if err := m.checkField(fd); err != nil {
		return err
	}
	return m.removeMapField(fd, key)
}

// RemoveMapFieldByName changes the value for the field with the given name by
// removing any value associated with the given key. It panics if an error is
// encountered. See TryRemoveMapFieldByName.
func (m *Message) RemoveMapFieldByName(name string, key interface{}) {
	if err := m.TryRemoveMapFieldByName(name, key); err != nil {
		panic(err.Error())
	}
}

// TryRemoveMapFieldByName changes the value for the field with the given name
// by removing any value associated with the given key. An error is returned if
// the given name is unknown or if it names a field that is not a map.
func (m *Message) TryRemoveMapFieldByName(name string, key interface{}) error {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return UnknownFieldNameError
	}
	return m.removeMapField(fd, key)
}

// RemoveMapFieldByNumber changes the value for the field with the given tag
// number by removing any value associated with the given key. It panics if an
// error is encountered. See TryRemoveMapFieldByNumber.
func (m *Message) RemoveMapFieldByNumber(tagNumber int, key interface{}) {
	if err := m.TryRemoveMapFieldByNumber(tagNumber, key); err != nil {
		panic(err.Error())
	}
}

// TryRemoveMapFieldByNumber changes the value for the field with the given tag
// number by removing any value associated with the given key. An error is
// returned if the given tag is unknown or if it indicates a field that is not
// a map.
func (m *Message) TryRemoveMapFieldByNumber(tagNumber int, key interface{}) error {
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return UnknownTagNumberError
	}
	return m.removeMapField(fd, key)
}

func (m *Message) removeMapField(fd *desc.FieldDescriptor, key interface{}) error {
	if !fd.IsMap() {
		return FieldIsNotMapError
	}
	kfd := fd.GetMessageType().GetFields()[0]
	ki, err := validElementFieldValue(kfd, key, false)
	if err != nil {
		return err
	}
	mp := m.values[fd.GetNumber()]
	if mp == nil {
		if mp, err = m.parseUnknownField(fd); err != nil {
			return err
		} else if mp == nil {
			return nil
		}
	}
	res := mp.(map[interface{}]interface{})
	delete(res, ki)
	if len(res) == 0 {
		delete(m.values, fd.GetNumber())
	}
	return nil
}

// FieldLength returns the number of elements in this message for the given
// field descriptor. It panics if an error is encountered. See TryFieldLength.
func (m *Message) FieldLength(fd *desc.FieldDescriptor) int {
	l, err := m.TryFieldLength(fd)
	if err != nil {
		panic(err.Error())
	}
	return l
}

// TryFieldLength returns the number of elements in this message for the given
// field descriptor. An error is returned if the given field descriptor does not
// belong to the right message type or if it is neither a map field nor a
// repeated field.
func (m *Message) TryFieldLength(fd *desc.FieldDescriptor) (int, error) {
	if err := m.checkField(fd); err != nil {
		return 0, err
	}
	return m.fieldLength(fd)
}

// FieldLengthByName returns the number of elements in this message for the
// field with the given name. It panics if an error is encountered. See
// TryFieldLengthByName.
func (m *Message) FieldLengthByName(name string) int {
	l, err := m.TryFieldLengthByName(name)
	if err != nil {
		panic(err.Error())
	}
	return l
}

// TryFieldLengthByName returns the number of elements in this message for the
// field with the given name. An error is returned if the given name is unknown
// or if the named field is neither a map field nor a repeated field.
func (m *Message) TryFieldLengthByName(name string) (int, error) {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return 0, UnknownFieldNameError
	}
	return m.fieldLength(fd)
}

// FieldLengthByNumber returns the number of elements in this message for the
// field with the given tag number. It panics if an error is encountered. See
// TryFieldLengthByNumber.
func (m *Message) FieldLengthByNumber(tagNumber int32) int {
	l, err := m.TryFieldLengthByNumber(tagNumber)
	if err != nil {
		panic(err.Error())
	}
	return l
}

// TryFieldLengthByNumber returns the number of elements in this message for the
// field with the given tag number. An error is returned if the given tag is
// unknown or if the named field is neither a map field nor a repeated field.
func (m *Message) TryFieldLengthByNumber(tagNumber int32) (int, error) {
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return 0, UnknownTagNumberError
	}
	return m.fieldLength(fd)
}

func (m *Message) fieldLength(fd *desc.FieldDescriptor) (int, error) {
	if !fd.IsRepeated() {
		return 0, FieldIsNotRepeatedError
	}
	val := m.values[fd.GetNumber()]
	if val == nil {
		var err error
		if val, err = m.parseUnknownField(fd); err != nil {
			return 0, err
		} else if val == nil {
			return 0, nil
		}
	}
	if sl, ok := val.([]interface{}); ok {
		return len(sl), nil
	} else if mp, ok := val.(map[interface{}]interface{}); ok {
		return len(mp), nil
	}
	return 0, nil
}

// GetRepeatedField returns the value for the given repeated field descriptor at
// the given index. It panics if an error is encountered. See
// TryGetRepeatedField.
func (m *Message) GetRepeatedField(fd *desc.FieldDescriptor, index int) interface{} {
	if v, err := m.TryGetRepeatedField(fd, index); err != nil {
		panic(err.Error())
	} else {
		return v
	}
}

// TryGetRepeatedField returns the value for the given repeated field descriptor
// at the given index. An error is returned if the given field descriptor does
// not belong to the right message type, if it is not a repeated field, or if
// the given index is out of range (less than zero or greater than or equal to
// the length of the repeated field). Also, even though map fields technically
// are repeated fields, if the given field is a map field an error will result:
// map representation does not lend itself to random access by index.
//
// The Go type of the value returned mirrors the type that protoc would generate
// for the field's element type. (See TryGetField for more details on types).
//
// If the given field descriptor is not known (e.g. not present in the message
// descriptor) but corresponds to an unknown field, the unknown value will be
// parsed and become known. The value at the given index in the parsed value
// will be returned. An error will be returned if the unknown value cannot be
// parsed according to the field descriptor's type information.
func (m *Message) TryGetRepeatedField(fd *desc.FieldDescriptor, index int) (interface{}, error) {
	if index < 0 {
		return nil, IndexOutOfRangeError
	}
	if err := m.checkField(fd); err != nil {
		return nil, err
	}
	return m.getRepeatedField(fd, index)
}

// GetRepeatedFieldByName returns the value for the repeated field with the
// given name at the given index. It panics if an error is encountered. See
// TryGetRepeatedFieldByName.
func (m *Message) GetRepeatedFieldByName(name string, index int) interface{} {
	if v, err := m.TryGetRepeatedFieldByName(name, index); err != nil {
		panic(err.Error())
	} else {
		return v
	}
}

// TryGetRepeatedFieldByName returns the value for the repeated field with the
// given name at the given index. An error is returned if the given name is
// unknown, if it names a field that is not a repeated field (or is a map
// field), or if the given index is out of range (less than zero or greater
// than or equal to the length of the repeated field).
//
// (See TryGetField for more info on types.)
func (m *Message) TryGetRepeatedFieldByName(name string, index int) (interface{}, error) {
	if index < 0 {
		return nil, IndexOutOfRangeError
	}
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return nil, UnknownFieldNameError
	}
	return m.getRepeatedField(fd, index)
}

// GetRepeatedFieldByNumber returns the value for the repeated field with the
// given tag number at the given index. It panics if an error is encountered.
// See TryGetRepeatedFieldByNumber.
func (m *Message) GetRepeatedFieldByNumber(tagNumber int, index int) interface{} {
	if v, err := m.TryGetRepeatedFieldByNumber(tagNumber, index); err != nil {
		panic(err.Error())
	} else {
		return v
	}
}

// TryGetRepeatedFieldByNumber returns the value for the repeated field with the
// given tag number at the given index. An error is returned if the given tag is
// unknown, if it indicates a field that is not a repeated field (or is a map
// field), or if the given index is out of range (less than zero or greater than
// or equal to the length of the repeated field).
//
// (See TryGetField for more info on types.)
func (m *Message) TryGetRepeatedFieldByNumber(tagNumber int, index int) (interface{}, error) {
	if index < 0 {
		return nil, IndexOutOfRangeError
	}
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return nil, UnknownTagNumberError
	}
	return m.getRepeatedField(fd, index)
}

func (m *Message) getRepeatedField(fd *desc.FieldDescriptor, index int) (interface{}, error) {
	if fd.IsMap() || !fd.IsRepeated() {
		return nil, FieldIsNotRepeatedError
	}
	sl := m.values[fd.GetNumber()]
	if sl == nil {
		var err error
		if sl, err = m.parseUnknownField(fd); err != nil {
			return nil, err
		} else if sl == nil {
			return nil, IndexOutOfRangeError
		}
	}
	res := sl.([]interface{})
	if index >= len(res) {
		return nil, IndexOutOfRangeError
	}
	return res[index], nil
}

// AddRepeatedField appends the given value to the given repeated field. It
// panics if an error is encountered. See TryAddRepeatedField.
func (m *Message) AddRepeatedField(fd *desc.FieldDescriptor, val interface{}) {
	if err := m.TryAddRepeatedField(fd, val); err != nil {
		panic(err.Error())
	}
}

// TryAddRepeatedField appends the given value to the given repeated field. An
// error is returned if the given field descriptor does not belong to the right
// message type, if the given field is not repeated, or if the given value is
// not a correct/compatible type for the given field. If the given field is a
// map field, the call will succeed if the given value is an instance of the
// map's entry message type.
//
// The Go type expected for a field  is the same as required by TrySetField for
// a non-repeated field of the same type.
//
// If the given field descriptor is not known (e.g. not present in the message
// descriptor) it will become known. Subsequent operations using tag numbers or
// names will be able to resolve the newly-known type. If the message has a
// value for the unknown value, it is parsed and the given value is appended to
// it.
func (m *Message) TryAddRepeatedField(fd *desc.FieldDescriptor, val interface{}) error {
	if err := m.checkField(fd); err != nil {
		return err
	}
	return m.addRepeatedField(fd, val)
}

// AddRepeatedFieldByName appends the given value to the repeated field with the
// given name. It panics if an error is encountered. See
// TryAddRepeatedFieldByName.
func (m *Message) AddRepeatedFieldByName(name string, val interface{}) {
	if err := m.TryAddRepeatedFieldByName(name, val); err != nil {
		panic(err.Error())
	}
}

// TryAddRepeatedFieldByName appends the given value to the repeated field with
// the given name. An error is returned if the given name is unknown, if it
// names a field that is not repeated, or if the given value has an incorrect
// type.
//
// (See TrySetField for more info on types.)
func (m *Message) TryAddRepeatedFieldByName(name string, val interface{}) error {
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return UnknownFieldNameError
	}
	return m.addRepeatedField(fd, val)
}

// AddRepeatedFieldByNumber appends the given value to the repeated field with
// the given tag number. It panics if an error is encountered. See
// TryAddRepeatedFieldByNumber.
func (m *Message) AddRepeatedFieldByNumber(tagNumber int, val interface{}) {
	if err := m.TryAddRepeatedFieldByNumber(tagNumber, val); err != nil {
		panic(err.Error())
	}
}

// TryAddRepeatedFieldByNumber appends the given value to the repeated field
// with the given tag number. An error is returned if the given tag is unknown,
// if it indicates a field that is not repeated, or if the given value has an
// incorrect type.
//
// (See TrySetField for more info on types.)
func (m *Message) TryAddRepeatedFieldByNumber(tagNumber int, val interface{}) error {
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return UnknownTagNumberError
	}
	return m.addRepeatedField(fd, val)
}

func (m *Message) addRepeatedField(fd *desc.FieldDescriptor, val interface{}) error {
	if !fd.IsRepeated() {
		return FieldIsNotRepeatedError
	}
	val, err := validElementFieldValue(fd, val, false)
	if err != nil {
		return err
	}

	if fd.IsMap() {
		// We're lenient. Just as we allow setting a map field to a slice of entry messages, we also allow
		// adding entries one at a time (as if the field were a normal repeated field).
		msg := val.(proto.Message)
		dm, err := asDynamicMessage(msg, fd.GetMessageType(), m.mf)
		if err != nil {
			return err
		}
		k, err := dm.TryGetFieldByNumber(1)
		if err != nil {
			return err
		}
		v, err := dm.TryGetFieldByNumber(2)
		if err != nil {
			return err
		}
		return m.putMapField(fd, k, v)
	}

	sl := m.values[fd.GetNumber()]
	if sl == nil {
		if sl, err = m.parseUnknownField(fd); err != nil {
			return err
		} else if sl == nil {
			sl = []interface{}{}
		}
	}
	res := sl.([]interface{})
	res = append(res, val)
	m.internalSetField(fd, res)
	return nil
}

// SetRepeatedField sets the value for the given repeated field descriptor and
// given index to the given value. It panics if an error is encountered. See
// SetRepeatedField.
func (m *Message) SetRepeatedField(fd *desc.FieldDescriptor, index int, val interface{}) {
	if err := m.TrySetRepeatedField(fd, index, val); err != nil {
		panic(err.Error())
	}
}

// TrySetRepeatedField sets the value for the given repeated field descriptor
// and given index to the given value. An error is returned if the given field
// descriptor does not belong to the right message type, if the given field is
// not repeated, or if the given value is not a correct/compatible type for the
// given field. Also, even though map fields technically are repeated fields, if
// the given field is a map field an error will result: map representation does
// not lend itself to random access by index.
//
// The Go type expected for a field  is the same as required by TrySetField for
// a non-repeated field of the same type.
//
// If the given field descriptor is not known (e.g. not present in the message
// descriptor) it will become known. Subsequent operations using tag numbers or
// names will be able to resolve the newly-known type. If the message has a
// value for the unknown value, it is parsed and the element at the given index
// is replaced with the given value.
func (m *Message) TrySetRepeatedField(fd *desc.FieldDescriptor, index int, val interface{}) error {
	if index < 0 {
		return IndexOutOfRangeError
	}
	if err := m.checkField(fd); err != nil {
		return err
	}
	return m.setRepeatedField(fd, index, val)
}

// SetRepeatedFieldByName sets the value for the repeated field with the given
// name and given index to the given value. It panics if an error is
// encountered. See TrySetRepeatedFieldByName.
func (m *Message) SetRepeatedFieldByName(name string, index int, val interface{}) {
	if err := m.TrySetRepeatedFieldByName(name, index, val); err != nil {
		panic(err.Error())
	}
}

// TrySetRepeatedFieldByName sets the value for the repeated field with the
// given name and the given index to the given value. An error is returned if
// the given name is unknown, if it names a field that is not repeated (or is a
// map field), or if the given value has an incorrect type.
//
// (See TrySetField for more info on types.)
func (m *Message) TrySetRepeatedFieldByName(name string, index int, val interface{}) error {
	if index < 0 {
		return IndexOutOfRangeError
	}
	fd := m.FindFieldDescriptorByName(name)
	if fd == nil {
		return UnknownFieldNameError
	}
	return m.setRepeatedField(fd, index, val)
}

// SetRepeatedFieldByNumber sets the value for the repeated field with the given
// tag number and given index to the given value. It panics if an error is
// encountered. See TrySetRepeatedFieldByNumber.
func (m *Message) SetRepeatedFieldByNumber(tagNumber int, index int, val interface{}) {
	if err := m.TrySetRepeatedFieldByNumber(tagNumber, index, val); err != nil {
		panic(err.Error())
	}
}

// TrySetRepeatedFieldByNumber sets the value for the repeated field with the
// given tag number and the given index to the given value. An error is returned
// if the given tag is unknown, if it indicates a field that is not repeated (or
// is a map field), or if the given value has an incorrect type.
//
// (See TrySetField for more info on types.)
func (m *Message) TrySetRepeatedFieldByNumber(tagNumber int, index int, val interface{}) error {
	if index < 0 {
		return IndexOutOfRangeError
	}
	fd := m.FindFieldDescriptor(int32(tagNumber))
	if fd == nil {
		return UnknownTagNumberError
	}
	return m.setRepeatedField(fd, index, val)
}

func (m *Message) setRepeatedField(fd *desc.FieldDescriptor, index int, val interface{}) error {
	if fd.IsMap() || !fd.IsRepeated() {
		return FieldIsNotRepeatedError
	}
	val, err := validElementFieldValue(fd, val, false)
	if err != nil {
		return err
	}
	sl := m.values[fd.GetNumber()]
	if sl == nil {
		if sl, err = m.parseUnknownField(fd); err != nil {
			return err
		} else if sl == nil {
			return IndexOutOfRangeError
		}
	}
	res := sl.([]interface{})
	if index >= len(res) {
		return IndexOutOfRangeError
	}
	res[index] = val
	return nil
}

// GetUnknownField gets the value(s) for the given unknown tag number. If this
// message has no unknown fields with the given tag, nil is returned.
func (m *Message) GetUnknownField(tagNumber int32) []UnknownField {
	if u, ok := m.unknownFields[tagNumber]; ok {
		return u
	} else {
		return nil
	}
}

func (m *Message) parseUnknownField(fd *desc.FieldDescriptor) (interface{}, error) {
	unks, ok := m.unknownFields[fd.GetNumber()]
	if !ok {
		return nil, nil
	}
	var v interface{}
	var sl []interface{}
	var mp map[interface{}]interface{}
	if fd.IsMap() {
		mp = map[interface{}]interface{}{}
	}
	var err error
	for _, unk := range unks {
		var val interface{}
		if unk.Encoding == proto.WireBytes || unk.Encoding == proto.WireStartGroup {
			val, err = codec.DecodeLengthDelimitedField(fd, unk.Contents, m.mf)
		} else {
			val, err = codec.DecodeScalarField(fd, unk.Value)
		}
		if err != nil {
			return nil, err
		}
		if fd.IsMap() {
			newEntry := val.(*Message)
			kk, err := newEntry.TryGetFieldByNumber(1)
			if err != nil {
				return nil, err
			}
			vv, err := newEntry.TryGetFieldByNumber(2)
			if err != nil {
				return nil, err
			}
			mp[kk] = vv
			v = mp
		} else if fd.IsRepeated() {
			t := reflect.TypeOf(val)
			if t.Kind() == reflect.Slice && t != typeOfBytes {
				// append slices if we unmarshalled a packed repeated field
				newVals := val.([]interface{})
				sl = append(sl, newVals...)
			} else {
				sl = append(sl, val)
			}
			v = sl
		} else {
			v = val
		}
	}
	m.internalSetField(fd, v)
	return v, nil
}

func validFieldValue(fd *desc.FieldDescriptor, val interface{}) (interface{}, error) {
	return validFieldValueForRv(fd, reflect.ValueOf(val))
}

func validFieldValueForRv(fd *desc.FieldDescriptor, val reflect.Value) (interface{}, error) {
	if fd.IsMap() && val.Kind() == reflect.Map {
		return validFieldValueForMapField(fd, val)
	}

	if fd.IsRepeated() { // this will also catch map fields where given value was not a map
		if val.Kind() != reflect.Array && val.Kind() != reflect.Slice {
			if fd.IsMap() {
				return nil, fmt.Errorf("value for map field must be a map; instead was %v", val.Type())
			} else {
				return nil, fmt.Errorf("value for repeated field must be a slice; instead was %v", val.Type())
			}
		}

		if fd.IsMap() {
			// value should be a slice of entry messages that we need convert into a map[interface{}]interface{}
			m := map[interface{}]interface{}{}
			for i := 0; i < val.Len(); i++ {
				e, err := validElementFieldValue(fd, val.Index(i).Interface(), false)
				if err != nil {
					return nil, err
				}
				msg := e.(proto.Message)
				dm, err := asDynamicMessage(msg, fd.GetMessageType(), nil)
				if err != nil {
					return nil, err
				}
				k, err := dm.TryGetFieldByNumber(1)
				if err != nil {
					return nil, err
				}
				v, err := dm.TryGetFieldByNumber(2)
				if err != nil {
					return nil, err
				}
				m[k] = v
			}
			return m, nil
		}

		// make a defensive copy while checking contents (also converts to []interface{})
		s := make([]interface{}, val.Len())
		for i := 0; i < val.Len(); i++ {
			ev := val.Index(i)
			if ev.Kind() == reflect.Interface {
				// unwrap it
				ev = reflect.ValueOf(ev.Interface())
			}
			e, err := validElementFieldValueForRv(fd, ev, false)
			if err != nil {
				return nil, err
			}
			s[i] = e
		}

		return s, nil
	}

	return validElementFieldValueForRv(fd, val, false)
}

func asDynamicMessage(m proto.Message, md *desc.MessageDescriptor, mf *MessageFactory) (*Message, error) {
	if dm, ok := m.(*Message); ok {
		return dm, nil
	}
	dm := NewMessageWithMessageFactory(md, mf)
	if err := dm.mergeFrom(m); err != nil {
		return nil, err
	}
	return dm, nil
}

func validElementFieldValue(fd *desc.FieldDescriptor, val interface{}, allowNilMessage bool) (interface{}, error) {
	return validElementFieldValueForRv(fd, reflect.ValueOf(val), allowNilMessage)
}

func validElementFieldValueForRv(fd *desc.FieldDescriptor, val reflect.Value, allowNilMessage bool) (interface{}, error) {
	t := fd.GetType()
	if !val.IsValid() {
		return nil, typeError(fd, nil)
	}

	switch t {
	case descriptorpb.FieldDescriptorProto_TYPE_SFIXED32,
		descriptorpb.FieldDescriptorProto_TYPE_INT32,
		descriptorpb.FieldDescriptorProto_TYPE_SINT32,
		descriptorpb.FieldDescriptorProto_TYPE_ENUM:
		return toInt32(reflect.Indirect(val), fd)

	case descriptorpb.FieldDescriptorProto_TYPE_SFIXED64,
		descriptorpb.FieldDescriptorProto_TYPE_INT64,
		descriptorpb.FieldDescriptorProto_TYPE_SINT64:
		return toInt64(reflect.Indirect(val), fd)

	case descriptorpb.FieldDescriptorProto_TYPE_FIXED32,
		descriptorpb.FieldDescriptorProto_TYPE_UINT32:
		return toUint32(reflect.Indirect(val), fd)

	case descriptorpb.FieldDescriptorProto_TYPE_FIXED64,
		descriptorpb.FieldDescriptorProto_TYPE_UINT64:
		return toUint64(reflect.Indirect(val), fd)

	case descriptorpb.FieldDescriptorProto_TYPE_FLOAT:
		return toFloat32(reflect.Indirect(val), fd)

	case descriptorpb.FieldDescriptorProto_TYPE_DOUBLE:
		return toFloat64(reflect.Indirect(val), fd)

	case descriptorpb.FieldDescriptorProto_TYPE_BOOL:
		return toBool(reflect.Indirect(val), fd)

	case descriptorpb.FieldDescriptorProto_TYPE_BYTES:
		return toBytes(reflect.Indirect(val), fd)

	case descriptorpb.FieldDescriptorProto_TYPE_STRING:
		return toString(reflect.Indirect(val), fd)

	case descriptorpb.FieldDescriptorProto_TYPE_MESSAGE,
		descriptorpb.FieldDescriptorProto_TYPE_GROUP:
		m, err := asMessage(val, fd.GetFullyQualifiedName())
		// check that message is correct type
		if err != nil {
			return nil, err
		}
		var msgType string
		if dm, ok := m.(*Message); ok {
			if allowNilMessage && dm == nil {
				// if dm == nil, we'll panic below, so early out if that is allowed
				// (only allowed for map values, to indicate an entry w/ no value)
				return m, nil
			}
			msgType = dm.GetMessageDescriptor().GetFullyQualifiedName()
		} else {
			msgType = proto.MessageName(m)
		}
		if msgType != fd.GetMessageType().GetFullyQualifiedName() {
			return nil, fmt.Errorf("message field %s requires value of type %s; received %s", fd.GetFullyQualifiedName(), fd.GetMessageType().GetFullyQualifiedName(), msgType)
		}
		return m, nil

	default:
		return nil, fmt.Errorf("unable to handle unrecognized field type: %v", fd.GetType())
	}
}

func toInt32(v reflect.Value, fd *desc.FieldDescriptor) (int32, error) {
	if v.Kind() == reflect.Int32 {
		return int32(v.Int()), nil
	}
	return 0, typeError(fd, v.Type())
}

func toUint32(v reflect.Value, fd *desc.FieldDescriptor) (uint32, error) {
	if v.Kind() == reflect.Uint32 {
		return uint32(v.Uint()), nil
	}
	return 0, typeError(fd, v.Type())
}

func toFloat32(v reflect.Value, fd *desc.FieldDescriptor) (float32, error) {
	if v.Kind() == reflect.Float32 {
		return float32(v.Float()), nil
	}
	return 0, typeError(fd, v.Type())
}

func toInt64(v reflect.Value, fd *desc.FieldDescriptor) (int64, error) {
	if v.Kind() == reflect.Int64 || v.Kind() == reflect.Int || v.Kind() == reflect.Int32 {
		return v.Int(), nil
	}
	return 0, typeError(fd, v.Type())
}

func toUint64(v reflect.Value, fd *desc.FieldDescriptor) (uint64, error) {
	if v.Kind() == reflect.Uint64 || v.Kind() == reflect.Uint || v.Kind() == reflect.Uint32 {
		return v.Uint(), nil
	}
	return 0, typeError(fd, v.Type())
}

func toFloat64(v reflect.Value, fd *desc.FieldDescriptor) (float64, error) {
	if v.Kind() == reflect.Float64 || v.Kind() == reflect.Float32 {
		return v.Float(), nil
	}
	return 0, typeError(fd, v.Type())
}

func toBool(v reflect.Value, fd *desc.FieldDescriptor) (bool, error) {
	if v.Kind() == reflect.Bool {
		return v.Bool(), nil
	}
	return false, typeError(fd, v.Type())
}

func toBytes(v reflect.Value, fd *desc.FieldDescriptor) ([]byte, error) {
	if v.Kind() == reflect.Slice && v.Type().Elem().Kind() == reflect.Uint8 {
		return v.Bytes(), nil
	}
	return nil, typeError(fd, v.Type())
}

func toString(v reflect.Value, fd *desc.FieldDescriptor) (string, error) {
	if v.Kind() == reflect.String {
		return v.String(), nil
	}
	return "", typeError(fd, v.Type())
}

func typeError(fd *desc.FieldDescriptor, t reflect.Type) error {
	return fmt.Errorf(
		"%s field %s is not compatible with value of type %v",
		getTypeString(fd), fd.GetFullyQualifiedName(), t)
}

func getTypeString(fd *desc.FieldDescriptor) string {
	return strings.ToLower(fd.GetType().String())
}

func asMessage(v reflect.Value, fieldName string) (proto.Message, error) {
	t := v.Type()
	// we need a pointer to a struct that implements proto.Message
	if t.Kind() != reflect.Ptr || t.Elem().Kind() != reflect.Struct || !t.Implements(typeOfProtoMessage) {
		return nil, fmt.Errorf("message field %s requires is not compatible with value of type %v", fieldName, v.Type())
	}
	return v.Interface().(proto.Message), nil
}

// Reset resets this message to an empty message. It removes all values set in
// the message.
func (m *Message) Reset() {
	for k := range m.values {
		delete(m.values, k)
	}
	for k := range m.unknownFields {
		delete(m.unknownFields, k)
	}
}

// String returns this message rendered in compact text format.
func (m *Message) String() string {
	b, err := m.MarshalText()
	if err != nil {
		panic(fmt.Sprintf("Failed to create string representation of message: %s", err.Error()))
	}
	return string(b)
}

// ProtoMessage is present to satisfy the proto.Message interface.
func (m *Message) ProtoMessage() {
}

// ConvertTo converts this dynamic message into the given message. This is
// shorthand for resetting then merging:
//
//	target.Reset()
//	m.MergeInto(target)
func (m *Message) ConvertTo(target proto.Message) error {
	if err := m.checkType(target); err != nil {
		return err
	}

	target.Reset()
	return m.mergeInto(target, defaultDeterminism)
}

// ConvertToDeterministic converts this dynamic message into the given message.
// It is just like ConvertTo, but it attempts to produce deterministic results.
// That means that if the target is a generated message (not another dynamic
// message) and the current runtime is unaware of any fields or extensions that
// are present in m, they will be serialized into the target's unrecognized
// fields deterministically.
func (m *Message) ConvertToDeterministic(target proto.Message) error {
	if err := m.checkType(target); err != nil {
		return err
	}

	target.Reset()
	return m.mergeInto(target, true)
}

// ConvertFrom converts the given message into this dynamic message. This is
// shorthand for resetting then merging:
//
//	m.Reset()
//	m.MergeFrom(target)
func (m *Message) ConvertFrom(target proto.Message) error {
	if err := m.checkType(target); err != nil {
		return err
	}

	m.Reset()
	return m.mergeFrom(target)
}

// MergeInto merges this dynamic message into the given message. All field
// values in this message will be set on the given message. For map fields,
// entries are added to the given message (if the given message has existing
// values for like keys, they are overwritten). For slice fields, elements are
// added.
//
// If the given message has a different set of known fields, it is possible for
// some known fields in this message to be represented as unknown fields in the
// given message after merging, and vice versa.
func (m *Message) MergeInto(target proto.Message) error {
	if err := m.checkType(target); err != nil {
		return err
	}
	return m.mergeInto(target, defaultDeterminism)
}

// MergeIntoDeterministic merges this dynamic message into the given message.
// It is just like MergeInto, but it attempts to produce deterministic results.
// That means that if the target is a generated message (not another dynamic
// message) and the current runtime is unaware of any fields or extensions that
// are present in m, they will be serialized into the target's unrecognized
// fields deterministically.
func (m *Message) MergeIntoDeterministic(target proto.Message) error {
	if err := m.checkType(target); err != nil {
		return err
	}
	return m.mergeInto(target, true)
}

// MergeFrom merges the given message into this dynamic message. All field
// values in the given message will be set on this message. For map fields,
// entries are added to this message (if this message has existing values for
// like keys, they are overwritten). For slice fields, elements are added.
//
// If the given message has a different set of known fields, it is possible for
// some known fields in that message to be represented as unknown fields in this
// message after merging, and vice versa.
func (m *Message) MergeFrom(source proto.Message) error {
	if err := m.checkType(source); err != nil {
		return err
	}
	return m.mergeFrom(source)
}

// Merge implements the proto.Merger interface so that dynamic messages are
// compatible with the proto.Merge function. It delegates to MergeFrom but will
// panic on error as the proto.Merger interface doesn't allow for returning an
// error.
//
// Unlike nearly all other methods, this method can work if this message's type
// is not defined (such as instantiating the message without using NewMessage).
// This is strictly so that dynamic message's are compatible with the
// proto.Clone function, which instantiates a new message via reflection (thus
// its message descriptor will not be set) and than calls Merge.
func (m *Message) Merge(source proto.Message) {
	if m.md == nil {
		// To support proto.Clone, initialize the descriptor from the source.
		if dm, ok := source.(*Message); ok {
			m.md = dm.md
			// also make sure the clone uses the same message factory and
			// extensions and also knows about the same extra fields (if any)
			m.mf = dm.mf
			m.er = dm.er
			m.extraFields = dm.extraFields
		} else if md, err := desc.LoadMessageDescriptorForMessage(source); err != nil {
			panic(err.Error())
		} else {
			m.md = md
		}
	}

	if err := m.MergeFrom(source); err != nil {
		panic(err.Error())
	}
}

func (m *Message) checkType(target proto.Message) error {
	if dm, ok := target.(*Message); ok {
		if dm.md.GetFullyQualifiedName() != m.md.GetFullyQualifiedName() {
			return fmt.Errorf("given message has wrong type: %q; expecting %q", dm.md.GetFullyQualifiedName(), m.md.GetFullyQualifiedName())
		}
		return nil
	}

	msgName := proto.MessageName(target)
	if msgName != m.md.GetFullyQualifiedName() {
		return fmt.Errorf("given message has wrong type: %q; expecting %q", msgName, m.md.GetFullyQualifiedName())
	}
	return nil
}

func (m *Message) mergeInto(pm proto.Message, deterministic bool) error {
	if dm, ok := pm.(*Message); ok {
		return dm.mergeFrom(m)
	}

	target := reflect.ValueOf(pm)
	if target.Kind() == reflect.Ptr {
		target = target.Elem()
	}

	// track tags for which the dynamic message has data but the given
	// message doesn't know about it
	unknownTags := map[int32]struct{}{}
	for tag := range m.values {
		unknownTags[tag] = struct{}{}
	}

	// check that we can successfully do the merge
	structProps := proto.GetProperties(reflect.TypeOf(pm).Elem())
	for _, prop := range structProps.Prop {
		if prop.Tag == 0 {
			continue // one-of or special field (such as XXX_unrecognized, etc.)
		}
		tag := int32(prop.Tag)
		v, ok := m.values[tag]
		if !ok {
			continue
		}
		if unknownTags != nil {
			delete(unknownTags, tag)
		}
		f := target.FieldByName(prop.Name)
		ft := f.Type()
		val := reflect.ValueOf(v)
		if !canConvert(val, ft) {
			return fmt.Errorf("cannot convert %v to %v", val.Type(), ft)
		}
	}
	// check one-of fields
	for _, oop := range structProps.OneofTypes {
		prop := oop.Prop
		tag := int32(prop.Tag)
		v, ok := m.values[tag]
		if !ok {
			continue
		}
		if unknownTags != nil {
			delete(unknownTags, tag)
		}
		stf, ok := oop.Type.Elem().FieldByName(prop.Name)
		if !ok {
			return fmt.Errorf("one-of field indicates struct field name %s, but type %v has no such field", prop.Name, oop.Type.Elem())
		}
		ft := stf.Type
		val := reflect.ValueOf(v)
		if !canConvert(val, ft) {
			return fmt.Errorf("cannot convert %v to %v", val.Type(), ft)
		}
	}
	// and check extensions, too
	for tag, ext := range proto.RegisteredExtensions(pm) {
		v, ok := m.values[tag]
		if !ok {
			continue
		}
		if unknownTags != nil {
			delete(unknownTags, tag)
		}
		ft := reflect.TypeOf(ext.ExtensionType)
		val := reflect.ValueOf(v)
		if !canConvert(val, ft) {
			return fmt.Errorf("cannot convert %v to %v", val.Type(), ft)
		}
	}

	// now actually perform the merge
	for _, prop := range structProps.Prop {
		v, ok := m.values[int32(prop.Tag)]
		if !ok {
			continue
		}
		f := target.FieldByName(prop.Name)
		if err := mergeVal(reflect.ValueOf(v), f, deterministic); err != nil {
			return err
		}
	}
	// merge one-ofs
	for _, oop := range structProps.OneofTypes {
		prop := oop.Prop
		tag := int32(prop.Tag)
		v, ok := m.values[tag]
		if !ok {
			continue
		}
		oov := reflect.New(oop.Type.Elem())
		f := oov.Elem().FieldByName(prop.Name)
		if err := mergeVal(reflect.ValueOf(v), f, deterministic); err != nil {
			return err
		}
		target.Field(oop.Field).Set(oov)
	}
	// merge extensions, too
	for tag, ext := range proto.RegisteredExtensions(pm) {
		v, ok := m.values[tag]
		if !ok {
			continue
		}
		e := reflect.New(reflect.TypeOf(ext.ExtensionType)).Elem()
		if err := mergeVal(reflect.ValueOf(v), e, deterministic); err != nil {
			return err
		}
		if err := proto.SetExtension(pm, ext, e.Interface()); err != nil {
			// shouldn't happen since we already checked that the extension type was compatible above
			return err
		}
	}

	// if we have fields that the given message doesn't know about, add to its unknown fields
	if len(unknownTags) > 0 {
		var b codec.Buffer
		b.SetDeterministic(deterministic)
		if deterministic {
			// if we need to emit things deterministically, sort the
			// extensions by their tag number
			sortedUnknownTags := make([]int32, 0, len(unknownTags))
			for tag := range unknownTags {
				sortedUnknownTags = append(sortedUnknownTags, tag)
			}
			sort.Slice(sortedUnknownTags, func(i, j int) bool {
				return sortedUnknownTags[i] < sortedUnknownTags[j]
			})
			for _, tag := range sortedUnknownTags {
				fd := m.FindFieldDescriptor(tag)
				if err := b.EncodeFieldValue(fd, m.values[tag]); err != nil {
					return err
				}
			}
		} else {
			for tag := range unknownTags {
				fd := m.FindFieldDescriptor(tag)
				if err := b.EncodeFieldValue(fd, m.values[tag]); err != nil {
					return err
				}
			}
		}

		internal.SetUnrecognized(pm, b.Bytes())
	}

	// finally, convey unknown fields into the given message by letting it unmarshal them
	// (this will append to its unknown fields if not known; if somehow the given message recognizes
	// a field even though the dynamic message did not, it will get correctly unmarshalled)
	if unknownTags != nil && len(m.unknownFields) > 0 {
		var b codec.Buffer
		_ = m.marshalUnknownFields(&b)
		_ = proto.UnmarshalMerge(b.Bytes(), pm)
	}

	return nil
}

func canConvert(src reflect.Value, target reflect.Type) bool {
	if src.Kind() == reflect.Interface {
		src = reflect.ValueOf(src.Interface())
	}
	srcType := src.Type()
	// we allow convertible types instead of requiring exact types so that calling
	// code can, for example, assign an enum constant to an enum field. In that case,
	// one type is the enum type (a sub-type of int32) and the other may be the int32
	// type. So we automatically do the conversion in that case.
	if srcType.ConvertibleTo(target) {
		return true
	} else if target.Kind() == reflect.Ptr && srcType.ConvertibleTo(target.Elem()) {
		return true
	} else if target.Kind() == reflect.Slice {
		if srcType.Kind() != reflect.Slice {
			return false
		}
		et := target.Elem()
		for i := 0; i < src.Len(); i++ {
			if !canConvert(src.Index(i), et) {
				return false
			}
		}
		return true
	} else if target.Kind() == reflect.Map {
		if srcType.Kind() != reflect.Map {
			return false
		}
		return canConvertMap(src, target)
	} else if srcType == typeOfDynamicMessage && target.Implements(typeOfProtoMessage) {
		z := reflect.Zero(target).Interface()
		msgType := proto.MessageName(z.(proto.Message))
		return msgType == src.Interface().(*Message).GetMessageDescriptor().GetFullyQualifiedName()
	} else {
		return false
	}
}

func mergeVal(src, target reflect.Value, deterministic bool) error {
	if src.Kind() == reflect.Interface && !src.IsNil() {
		src = src.Elem()
	}
	srcType := src.Type()
	targetType := target.Type()
	if srcType.ConvertibleTo(targetType) {
		if targetType.Implements(typeOfProtoMessage) && !target.IsNil() {
			Merge(target.Interface().(proto.Message), src.Convert(targetType).Interface().(proto.Message))
		} else {
			target.Set(src.Convert(targetType))
		}
	} else if targetType.Kind() == reflect.Ptr && srcType.ConvertibleTo(targetType.Elem()) {
		if !src.CanAddr() {
			target.Set(reflect.New(targetType.Elem()))
			target.Elem().Set(src.Convert(targetType.Elem()))
		} else {
			target.Set(src.Addr().Convert(targetType))
		}
	} else if targetType.Kind() == reflect.Slice {
		l := target.Len()
		newL := l + src.Len()
		if target.Cap() < newL {
			// expand capacity of the slice and copy
			newSl := reflect.MakeSlice(targetType, newL, newL)
			for i := 0; i < target.Len(); i++ {
				newSl.Index(i).Set(target.Index(i))
			}
			target.Set(newSl)
		} else {
			target.SetLen(newL)
		}
		for i := 0; i < src.Len(); i++ {
			dest := target.Index(l + i)
			if dest.Kind() == reflect.Ptr {
				dest.Set(reflect.New(dest.Type().Elem()))
			}
			if err := mergeVal(src.Index(i), dest, deterministic); err != nil {
				return err
			}
		}
	} else if targetType.Kind() == reflect.Map {
		return mergeMapVal(src, target, targetType, deterministic)
	} else if srcType == typeOfDynamicMessage && targetType.Implements(typeOfProtoMessage) {
		dm := src.Interface().(*Message)
		if target.IsNil() {
			target.Set(reflect.New(targetType.Elem()))
		}
		m := target.Interface().(proto.Message)
		if err := dm.mergeInto(m, deterministic); err != nil {
			return err
		}
	} else {
		return fmt.Errorf("cannot convert %v to %v", srcType, targetType)
	}
	return nil
}

func (m *Message) mergeFrom(pm proto.Message) error {
	if dm, ok := pm.(*Message); ok {
		// if given message is also a dynamic message, we merge differently
		for tag, v := range dm.values {
			fd := m.FindFieldDescriptor(tag)
			if fd == nil {
				fd = dm.FindFieldDescriptor(tag)
			}
			if err := mergeField(m, fd, v); err != nil {
				return err
			}
		}
		return nil
	}

	pmrv := reflect.ValueOf(pm)
	if pmrv.IsNil() {
		// nil is an empty message, so nothing to do
		return nil
	}

	// check that we can successfully do the merge
	src := pmrv.Elem()
	values := map[*desc.FieldDescriptor]interface{}{}
	props := proto.GetProperties(reflect.TypeOf(pm).Elem())
	if props == nil {
		return fmt.Errorf("could not determine message properties to merge for %v", reflect.TypeOf(pm).Elem())
	}

	// regular fields
	for _, prop := range props.Prop {
		if prop.Tag == 0 {
			continue // one-of or special field (such as XXX_unrecognized, etc.)
		}
		fd := m.FindFieldDescriptor(int32(prop.Tag))
		if fd == nil {
			// Our descriptor has different fields than this message object. So
			// try to reflect on the message object's fields.
			md, err := desc.LoadMessageDescriptorForMessage(pm)
			if err != nil {
				return err
			}
			fd = md.FindFieldByNumber(int32(prop.Tag))
			if fd == nil {
				return fmt.Errorf("message descriptor %q did not contain field for tag %d (%q)", md.GetFullyQualifiedName(), prop.Tag, prop.Name)
			}
		}
		rv := src.FieldByName(prop.Name)
		if (rv.Kind() == reflect.Ptr || rv.Kind() == reflect.Slice) && rv.IsNil() {
			continue
		}
		if v, err := validFieldValueForRv(fd, rv); err != nil {
			return err
		} else {
			values[fd] = v
		}
	}

	// one-of fields
	for _, oop := range props.OneofTypes {
		oov := src.Field(oop.Field).Elem()
		if !oov.IsValid() || oov.Type() != oop.Type {
			// this field is unset (in other words, one-of message field is not currently set to this option)
			continue
		}
		prop := oop.Prop
		rv := oov.Elem().FieldByName(prop.Name)
		fd := m.FindFieldDescriptor(int32(prop.Tag))
		if fd == nil {
			// Our descriptor has different fields than this message object. So
			// try to reflect on the message object's fields.
			md, err := desc.LoadMessageDescriptorForMessage(pm)
			if err != nil {
				return err
			}
			fd = md.FindFieldByNumber(int32(prop.Tag))
			if fd == nil {
				return fmt.Errorf("message descriptor %q did not contain field for tag %d (%q in one-of %q)", md.GetFullyQualifiedName(), prop.Tag, prop.Name, src.Type().Field(oop.Field).Name)
			}
		}
		if v, err := validFieldValueForRv(fd, rv); err != nil {
			return err
		} else {
			values[fd] = v
		}
	}

	// extension fields
	rexts, _ := proto.ExtensionDescs(pm)
	for _, ed := range rexts {
		v, _ := proto.GetExtension(pm, ed)
		if v == nil {
			continue
		}
		if ed.ExtensionType == nil {
			// unrecognized extension: we'll handle that below when we
			// handle other unrecognized fields
			continue
		}
		fd := m.er.FindExtension(m.md.GetFullyQualifiedName(), ed.Field)
		if fd == nil {
			var err error
			if fd, err = desc.LoadFieldDescriptorForExtension(ed); err != nil {
				return err
			}
		}
		if v, err := validFieldValue(fd, v); err != nil {
			return err
		} else {
			values[fd] = v
		}
	}

	// With API v2, it is possible that the new protoreflect interfaces
	// were used to store an extension, which means it can't be returned
	// by proto.ExtensionDescs and it's also not in the unrecognized data.
	// So we have a separate loop to trawl through it...
	var err error
	proto.MessageReflect(pm).Range(func(fld protoreflect.FieldDescriptor, val protoreflect.Value) bool {
		if !fld.IsExtension() {
			// normal field... we already got it above
			return true
		}
		xt := fld.(protoreflect.ExtensionTypeDescriptor)
		if _, ok := xt.Type().(*proto.ExtensionDesc); ok {
			// known extension... we already got it above
			return true
		}
		var fd *desc.FieldDescriptor
		fd, err = desc.WrapField(fld)
		if err != nil {
			return false
		}
		v := convertProtoReflectValue(val)
		if v, err = validFieldValue(fd, v); err != nil {
			return false
		}
		values[fd] = v
		return true
	})
	if err != nil {
		return err
	}

	// unrecognized extensions fields:
	//   In API v2 of proto, some extensions may NEITHER be included in ExtensionDescs
	//   above NOR included in unrecognized fields below. These are extensions that use
	//   a custom extension type (not a generated one -- i.e. not a linked in extension).
	mr := proto.MessageReflect(pm)
	var extBytes []byte
	var retErr error
	mr.Range(func(fld protoreflect.FieldDescriptor, val protoreflect.Value) bool {
		if !fld.IsExtension() {
			// normal field, already processed above
			return true
		}
		if extd, ok := fld.(protoreflect.ExtensionTypeDescriptor); ok {
			if _, ok := extd.Type().(*proto.ExtensionDesc); ok {
				// normal known extension, already processed above
				return true
			}
		}

		// marshal the extension to bytes and then handle as unknown field below
		mr.New()
		mr.Set(fld, val)
		extBytes, retErr = protov2.MarshalOptions{}.MarshalAppend(extBytes, mr.Interface())
		return retErr == nil
	})
	if retErr != nil {
		return retErr
	}

	// now actually perform the merge
	for fd, v := range values {
		if err := mergeField(m, fd, v); err != nil {
			return err
		}
	}

	if len(extBytes) > 0 {
		// treating unrecognized extensions like unknown fields: best-effort
		// ignore any error returned: pulling in unknown fields is best-effort
		_ = m.UnmarshalMerge(extBytes)
	}

	data := internal.GetUnrecognized(pm)
	if len(data) > 0 {
		// ignore any error returned: pulling in unknown fields is best-effort
		_ = m.UnmarshalMerge(data)
	}

	return nil
}

func convertProtoReflectValue(v protoreflect.Value) interface{} {
	val := v.Interface()
	switch val := val.(type) {
	case protoreflect.Message:
		return val.Interface()
	case protoreflect.Map:
		mp := make(map[interface{}]interface{}, val.Len())
		val.Range(func(k protoreflect.MapKey, v protoreflect.Value) bool {
			mp[convertProtoReflectValue(k.Value())] = convertProtoReflectValue(v)
			return true
		})
		return mp
	case protoreflect.List:
		sl := make([]interface{}, val.Len())
		for i := 0; i < val.Len(); i++ {
			sl[i] = convertProtoReflectValue(val.Get(i))
		}
		return sl
	case protoreflect.EnumNumber:
		return int32(val)
	default:
		return val
	}
}

// Validate checks that all required fields are present. It returns an error if any are absent.
func (m *Message) Validate() error {
	missingFields := m.findMissingFields()
	if len(missingFields) == 0 {
		return nil
	}
	return fmt.Errorf("some required fields missing: %v", strings.Join(missingFields, ", "))
}

func (m *Message) findMissingFields() []string {
	if m.md.IsProto3() {
		// proto3 does not allow required fields
		return nil
	}
	var missingFields []string
	for _, fd := range m.md.GetFields() {
		if fd.IsRequired() {
			if _, ok := m.values[fd.GetNumber()]; !ok {
				missingFields = append(missingFields, fd.GetName())
			}
		}
	}
	return missingFields
}

// ValidateRecursive checks that all required fields are present and also
// recursively validates all fields who are also messages. It returns an error
// if any required fields, in this message or nested within, are absent.
func (m *Message) ValidateRecursive() error {
	return m.validateRecursive("")
}

func (m *Message) validateRecursive(prefix string) error {
	if missingFields := m.findMissingFields(); len(missingFields) > 0 {
		for i := range missingFields {
			missingFields[i] = fmt.Sprintf("%s%s", prefix, missingFields[i])
		}
		return fmt.Errorf("some required fields missing: %v", strings.Join(missingFields, ", "))
	}

	for tag, fld := range m.values {
		fd := m.FindFieldDescriptor(tag)
		var chprefix string
		var md *desc.MessageDescriptor
		checkMsg := func(pm proto.Message) error {
			var dm *Message
			if d, ok := pm.(*Message); ok {
				dm = d
			} else if pm != nil {
				dm = m.mf.NewDynamicMessage(md)
				if err := dm.ConvertFrom(pm); err != nil {
					return nil
				}
			}
			if dm == nil {
				return nil
			}
			if err := dm.validateRecursive(chprefix); err != nil {
				return err
			}
			return nil
		}
		isMap := fd.IsMap()
		if isMap && fd.GetMapValueType().GetMessageType() != nil {
			md = fd.GetMapValueType().GetMessageType()
			mp := fld.(map[interface{}]interface{})
			for k, v := range mp {
				chprefix = fmt.Sprintf("%s%s[%v].", prefix, getName(fd), k)
				if err := checkMsg(v.(proto.Message)); err != nil {
					return err
				}
			}
		} else if !isMap && fd.GetMessageType() != nil {
			md = fd.GetMessageType()
			if fd.IsRepeated() {
				sl := fld.([]interface{})
				for i, v := range sl {
					chprefix = fmt.Sprintf("%s%s[%d].", prefix, getName(fd), i)
					if err := checkMsg(v.(proto.Message)); err != nil {
						return err
					}
				}
			} else {
				chprefix = fmt.Sprintf("%s%s.", prefix, getName(fd))
				if err := checkMsg(fld.(proto.Message)); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func getName(fd *desc.FieldDescriptor) string {
	if fd.IsExtension() {
		return fmt.Sprintf("(%s)", fd.GetFullyQualifiedName())
	} else {
		return fd.GetName()
	}
}

// knownFieldTags return tags of present and recognized fields, in sorted order.
func (m *Message) knownFieldTags() []int {
	if len(m.values) == 0 {
		return []int(nil)
	}

	keys := make([]int, len(m.values))
	i := 0
	for k := range m.values {
		keys[i] = int(k)
		i++
	}

	sort.Ints(keys)
	return keys
}

// allKnownFieldTags return tags of present and recognized fields, including
// those that are unset, in sorted order. This only includes extensions that are
// present. Known but not-present extensions are not included in the returned
// set of tags.
func (m *Message) allKnownFieldTags() []int {
	fds := m.md.GetFields()
	keys := make([]int, 0, len(fds)+len(m.extraFields))

	for k := range m.values {
		keys = append(keys, int(k))
	}

	// also include known fields that are not present
	for _, fd := range fds {
		if _, ok := m.values[fd.GetNumber()]; !ok {
			keys = append(keys, int(fd.GetNumber()))
		}
	}
	for _, fd := range m.extraFields {
		if !fd.IsExtension() { // skip extensions that are not present
			if _, ok := m.values[fd.GetNumber()]; !ok {
				keys = append(keys, int(fd.GetNumber()))
			}
		}
	}

	sort.Ints(keys)
	return keys
}

// unknownFieldTags return tags of present but unrecognized fields, in sorted order.
func (m *Message) unknownFieldTags() []int {
	if len(m.unknownFields) == 0 {
		return []int(nil)
	}
	keys := make([]int, len(m.unknownFields))
	i := 0
	for k := range m.unknownFields {
		keys[i] = int(k)
		i++
	}
	sort.Ints(keys)
	return keys
}
