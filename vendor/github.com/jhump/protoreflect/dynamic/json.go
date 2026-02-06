package dynamic

// JSON marshalling and unmarshalling for dynamic messages

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"

	"github.com/golang/protobuf/jsonpb"
	"github.com/golang/protobuf/proto"
	"google.golang.org/protobuf/types/descriptorpb"
	// link in the well-known-types that have a special JSON format
	_ "google.golang.org/protobuf/types/known/anypb"
	_ "google.golang.org/protobuf/types/known/durationpb"
	_ "google.golang.org/protobuf/types/known/emptypb"
	_ "google.golang.org/protobuf/types/known/structpb"
	_ "google.golang.org/protobuf/types/known/timestamppb"
	_ "google.golang.org/protobuf/types/known/wrapperspb"

	"github.com/jhump/protoreflect/desc"
)

var wellKnownTypeNames = map[string]struct{}{
	"google.protobuf.Any":       {},
	"google.protobuf.Empty":     {},
	"google.protobuf.Duration":  {},
	"google.protobuf.Timestamp": {},
	// struct.proto
	"google.protobuf.Struct":    {},
	"google.protobuf.Value":     {},
	"google.protobuf.ListValue": {},
	// wrappers.proto
	"google.protobuf.DoubleValue": {},
	"google.protobuf.FloatValue":  {},
	"google.protobuf.Int64Value":  {},
	"google.protobuf.UInt64Value": {},
	"google.protobuf.Int32Value":  {},
	"google.protobuf.UInt32Value": {},
	"google.protobuf.BoolValue":   {},
	"google.protobuf.StringValue": {},
	"google.protobuf.BytesValue":  {},
}

// MarshalJSON serializes this message to bytes in JSON format, returning an
// error if the operation fails. The resulting bytes will be a valid UTF8
// string.
//
// This method uses a compact form: no newlines, and spaces between fields and
// between field identifiers and values are elided.
//
// This method is convenient shorthand for invoking MarshalJSONPB with a default
// (zero value) marshaler:
//
//	m.MarshalJSONPB(&jsonpb.Marshaler{})
//
// So enums are serialized using enum value name strings, and values that are
// not present (including those with default/zero value for messages defined in
// "proto3" syntax) are omitted.
func (m *Message) MarshalJSON() ([]byte, error) {
	return m.MarshalJSONPB(&jsonpb.Marshaler{})
}

// MarshalJSONIndent serializes this message to bytes in JSON format, returning
// an error if the operation fails. The resulting bytes will be a valid UTF8
// string.
//
// This method uses a "pretty-printed" form, with each field on its own line and
// spaces between field identifiers and values. Indentation of two spaces is
// used.
//
// This method is convenient shorthand for invoking MarshalJSONPB with a default
// (zero value) marshaler:
//
//	m.MarshalJSONPB(&jsonpb.Marshaler{Indent: "  "})
//
// So enums are serialized using enum value name strings, and values that are
// not present (including those with default/zero value for messages defined in
// "proto3" syntax) are omitted.
func (m *Message) MarshalJSONIndent() ([]byte, error) {
	return m.MarshalJSONPB(&jsonpb.Marshaler{Indent: "  "})
}

// MarshalJSONPB serializes this message to bytes in JSON format, returning an
// error if the operation fails. The resulting bytes will be a valid UTF8
// string. The given marshaler is used to convey options used during marshaling.
//
// If this message contains nested messages that are generated message types (as
// opposed to dynamic messages), the given marshaler is used to marshal it.
//
// When marshaling any nested messages, any jsonpb.AnyResolver configured in the
// given marshaler is augmented with knowledge of message types known to this
// message's descriptor (and its enclosing file and set of transitive
// dependencies).
func (m *Message) MarshalJSONPB(opts *jsonpb.Marshaler) ([]byte, error) {
	var b indentBuffer
	b.indent = opts.Indent
	if len(opts.Indent) == 0 {
		b.indentCount = -1
	}
	b.comma = true
	if err := m.marshalJSON(&b, opts); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

func (m *Message) marshalJSON(b *indentBuffer, opts *jsonpb.Marshaler) error {
	if m == nil {
		_, err := b.WriteString("null")
		return err
	}
	if r, changed := wrapResolver(opts.AnyResolver, m.mf, m.md.GetFile()); changed {
		newOpts := *opts
		newOpts.AnyResolver = r
		opts = &newOpts
	}

	if ok, err := marshalWellKnownType(m, b, opts); ok {
		return err
	}

	err := b.WriteByte('{')
	if err != nil {
		return err
	}
	err = b.start()
	if err != nil {
		return err
	}

	var tags []int
	if opts.EmitDefaults {
		tags = m.allKnownFieldTags()
	} else {
		tags = m.knownFieldTags()
	}

	first := true

	for _, tag := range tags {
		itag := int32(tag)
		fd := m.FindFieldDescriptor(itag)

		v, ok := m.values[itag]
		if !ok {
			if fd.GetOneOf() != nil {
				// don't print defaults for fields in a oneof
				continue
			}
			v = fd.GetDefaultValue()
		}

		err := b.maybeNext(&first)
		if err != nil {
			return err
		}
		err = marshalKnownFieldJSON(b, fd, v, opts)
		if err != nil {
			return err
		}
	}

	err = b.end()
	if err != nil {
		return err
	}
	err = b.WriteByte('}')
	if err != nil {
		return err
	}

	return nil
}

func marshalWellKnownType(m *Message, b *indentBuffer, opts *jsonpb.Marshaler) (bool, error) {
	fqn := m.md.GetFullyQualifiedName()
	if _, ok := wellKnownTypeNames[fqn]; !ok {
		return false, nil
	}

	msgType := proto.MessageType(fqn)
	if msgType == nil {
		// wtf?
		panic(fmt.Sprintf("could not find registered message type for %q", fqn))
	}

	// convert dynamic message to well-known type and let jsonpb marshal it
	msg := reflect.New(msgType.Elem()).Interface().(proto.Message)
	if err := m.MergeInto(msg); err != nil {
		return true, err
	}
	return true, opts.Marshal(b, msg)
}

func marshalKnownFieldJSON(b *indentBuffer, fd *desc.FieldDescriptor, v interface{}, opts *jsonpb.Marshaler) error {
	var jsonName string
	if opts.OrigName {
		jsonName = fd.GetName()
	} else {
		jsonName = fd.AsFieldDescriptorProto().GetJsonName()
		if jsonName == "" {
			jsonName = fd.GetName()
		}
	}
	if fd.IsExtension() {
		var scope string
		switch parent := fd.GetParent().(type) {
		case *desc.FileDescriptor:
			scope = parent.GetPackage()
		default:
			scope = parent.GetFullyQualifiedName()
		}
		if scope == "" {
			jsonName = fmt.Sprintf("[%s]", jsonName)
		} else {
			jsonName = fmt.Sprintf("[%s.%s]", scope, jsonName)
		}
	}
	err := writeJsonString(b, jsonName)
	if err != nil {
		return err
	}
	err = b.sep()
	if err != nil {
		return err
	}

	if isNil(v) {
		_, err := b.WriteString("null")
		return err
	}

	if fd.IsMap() {
		err = b.WriteByte('{')
		if err != nil {
			return err
		}
		err = b.start()
		if err != nil {
			return err
		}

		md := fd.GetMessageType()
		vfd := md.FindFieldByNumber(2)

		mp := v.(map[interface{}]interface{})
		keys := make([]interface{}, 0, len(mp))
		for k := range mp {
			keys = append(keys, k)
		}
		sort.Sort(sortable(keys))
		first := true
		for _, mk := range keys {
			mv := mp[mk]
			err := b.maybeNext(&first)
			if err != nil {
				return err
			}

			err = marshalKnownFieldMapEntryJSON(b, mk, vfd, mv, opts)
			if err != nil {
				return err
			}
		}

		err = b.end()
		if err != nil {
			return err
		}
		return b.WriteByte('}')

	} else if fd.IsRepeated() {
		err = b.WriteByte('[')
		if err != nil {
			return err
		}
		err = b.start()
		if err != nil {
			return err
		}

		sl := v.([]interface{})
		first := true
		for _, slv := range sl {
			err := b.maybeNext(&first)
			if err != nil {
				return err
			}
			err = marshalKnownFieldValueJSON(b, fd, slv, opts)
			if err != nil {
				return err
			}
		}

		err = b.end()
		if err != nil {
			return err
		}
		return b.WriteByte(']')

	} else {
		return marshalKnownFieldValueJSON(b, fd, v, opts)
	}
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

func isNil(v interface{}) bool {
	if v == nil {
		return true
	}
	rv := reflect.ValueOf(v)
	return rv.Kind() == reflect.Ptr && rv.IsNil()
}

func marshalKnownFieldMapEntryJSON(b *indentBuffer, mk interface{}, vfd *desc.FieldDescriptor, mv interface{}, opts *jsonpb.Marshaler) error {
	rk := reflect.ValueOf(mk)
	var strkey string
	switch rk.Kind() {
	case reflect.Bool:
		strkey = strconv.FormatBool(rk.Bool())
	case reflect.Int32, reflect.Int64:
		strkey = strconv.FormatInt(rk.Int(), 10)
	case reflect.Uint32, reflect.Uint64:
		strkey = strconv.FormatUint(rk.Uint(), 10)
	case reflect.String:
		strkey = rk.String()
	default:
		return fmt.Errorf("invalid map key value: %v (%v)", mk, rk.Type())
	}
	err := writeJsonString(b, strkey)
	if err != nil {
		return err
	}
	err = b.sep()
	if err != nil {
		return err
	}
	return marshalKnownFieldValueJSON(b, vfd, mv, opts)
}

func marshalKnownFieldValueJSON(b *indentBuffer, fd *desc.FieldDescriptor, v interface{}, opts *jsonpb.Marshaler) error {
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Int64:
		return writeJsonString(b, strconv.FormatInt(rv.Int(), 10))
	case reflect.Int32:
		ed := fd.GetEnumType()
		if !opts.EnumsAsInts && ed != nil {
			n := int32(rv.Int())
			vd := ed.FindValueByNumber(n)
			if vd == nil {
				_, err := b.WriteString(strconv.FormatInt(rv.Int(), 10))
				return err
			} else {
				return writeJsonString(b, vd.GetName())
			}
		} else {
			_, err := b.WriteString(strconv.FormatInt(rv.Int(), 10))
			return err
		}
	case reflect.Uint64:
		return writeJsonString(b, strconv.FormatUint(rv.Uint(), 10))
	case reflect.Uint32:
		_, err := b.WriteString(strconv.FormatUint(rv.Uint(), 10))
		return err
	case reflect.Float32, reflect.Float64:
		f := rv.Float()
		var str string
		if math.IsNaN(f) {
			str = `"NaN"`
		} else if math.IsInf(f, 1) {
			str = `"Infinity"`
		} else if math.IsInf(f, -1) {
			str = `"-Infinity"`
		} else {
			var bits int
			if rv.Kind() == reflect.Float32 {
				bits = 32
			} else {
				bits = 64
			}
			str = strconv.FormatFloat(rv.Float(), 'g', -1, bits)
		}
		_, err := b.WriteString(str)
		return err
	case reflect.Bool:
		_, err := b.WriteString(strconv.FormatBool(rv.Bool()))
		return err
	case reflect.Slice:
		bstr := base64.StdEncoding.EncodeToString(rv.Bytes())
		return writeJsonString(b, bstr)
	case reflect.String:
		return writeJsonString(b, rv.String())
	default:
		// must be a message
		if isNil(v) {
			_, err := b.WriteString("null")
			return err
		}

		if dm, ok := v.(*Message); ok {
			return dm.marshalJSON(b, opts)
		}

		var err error
		if b.indentCount <= 0 || len(b.indent) == 0 {
			err = opts.Marshal(b, v.(proto.Message))
		} else {
			str, err := opts.MarshalToString(v.(proto.Message))
			if err != nil {
				return err
			}
			indent := strings.Repeat(b.indent, b.indentCount)
			pos := 0
			// add indention prefix to each line
			for pos < len(str) {
				start := pos
				nextPos := strings.Index(str[pos:], "\n")
				if nextPos == -1 {
					nextPos = len(str)
				} else {
					nextPos = pos + nextPos + 1 // include newline
				}
				line := str[start:nextPos]
				if pos > 0 {
					_, err = b.WriteString(indent)
					if err != nil {
						return err
					}
				}
				_, err = b.WriteString(line)
				if err != nil {
					return err
				}
				pos = nextPos
			}
		}
		return err
	}
}

func writeJsonString(b *indentBuffer, s string) error {
	if sbytes, err := json.Marshal(s); err != nil {
		return err
	} else {
		_, err := b.Write(sbytes)
		return err
	}
}

// UnmarshalJSON de-serializes the message that is present, in JSON format, in
// the given bytes into this message. It first resets the current message. It
// returns an error if the given bytes do not contain a valid encoding of this
// message type in JSON format.
//
// This method is shorthand for invoking UnmarshalJSONPB with a default (zero
// value) unmarshaler:
//
//	m.UnmarshalMergeJSONPB(&jsonpb.Unmarshaler{}, js)
//
// So unknown fields will result in an error, and no provided jsonpb.AnyResolver
// will be used when parsing google.protobuf.Any messages.
func (m *Message) UnmarshalJSON(js []byte) error {
	return m.UnmarshalJSONPB(&jsonpb.Unmarshaler{}, js)
}

// UnmarshalMergeJSON de-serializes the message that is present, in JSON format,
// in the given bytes into this message. Unlike UnmarshalJSON, it does not first
// reset the message, instead merging the data in the given bytes into the
// existing data in this message.
func (m *Message) UnmarshalMergeJSON(js []byte) error {
	return m.UnmarshalMergeJSONPB(&jsonpb.Unmarshaler{}, js)
}

// UnmarshalJSONPB de-serializes the message that is present, in JSON format, in
// the given bytes into this message. The given unmarshaler conveys options used
// when parsing the JSON. This function first resets the current message. It
// returns an error if the given bytes do not contain a valid encoding of this
// message type in JSON format.
//
// The decoding is lenient:
//  1. The JSON can refer to fields either by their JSON name or by their
//     declared name.
//  2. The JSON can use either numeric values or string names for enum values.
//
// When instantiating nested messages, if this message's associated factory
// returns a generated message type (as opposed to a dynamic message), the given
// unmarshaler is used to unmarshal it.
//
// When unmarshaling any nested messages, any jsonpb.AnyResolver configured in
// the given unmarshaler is augmented with knowledge of message types known to
// this message's descriptor (and its enclosing file and set of transitive
// dependencies).
func (m *Message) UnmarshalJSONPB(opts *jsonpb.Unmarshaler, js []byte) error {
	m.Reset()
	if err := m.UnmarshalMergeJSONPB(opts, js); err != nil {
		return err
	}
	return m.Validate()
}

// UnmarshalMergeJSONPB de-serializes the message that is present, in JSON
// format, in the given bytes into this message. The given unmarshaler conveys
// options used when parsing the JSON. Unlike UnmarshalJSONPB, it does not first
// reset the message, instead merging the data in the given bytes into the
// existing data in this message.
func (m *Message) UnmarshalMergeJSONPB(opts *jsonpb.Unmarshaler, js []byte) error {
	r := newJsReader(js)
	err := m.unmarshalJson(r, opts)
	if err != nil {
		return err
	}
	if t, err := r.poll(); err != io.EOF {
		b, _ := ioutil.ReadAll(r.unread())
		s := fmt.Sprintf("%v%s", t, string(b))
		return fmt.Errorf("superfluous data found after JSON object: %q", s)
	}
	return nil
}

func unmarshalWellKnownType(m *Message, r *jsReader, opts *jsonpb.Unmarshaler) (bool, error) {
	fqn := m.md.GetFullyQualifiedName()
	if _, ok := wellKnownTypeNames[fqn]; !ok {
		return false, nil
	}

	msgType := proto.MessageType(fqn)
	if msgType == nil {
		// wtf?
		panic(fmt.Sprintf("could not find registered message type for %q", fqn))
	}

	// extract json value from r
	var js json.RawMessage
	if err := json.NewDecoder(r.unread()).Decode(&js); err != nil {
		return true, err
	}
	if err := r.skip(); err != nil {
		return true, err
	}

	// unmarshal into well-known type and then convert to dynamic message
	msg := reflect.New(msgType.Elem()).Interface().(proto.Message)
	if err := opts.Unmarshal(bytes.NewReader(js), msg); err != nil {
		return true, err
	}
	return true, m.MergeFrom(msg)
}

func (m *Message) unmarshalJson(r *jsReader, opts *jsonpb.Unmarshaler) error {
	if r, changed := wrapResolver(opts.AnyResolver, m.mf, m.md.GetFile()); changed {
		newOpts := *opts
		newOpts.AnyResolver = r
		opts = &newOpts
	}

	if ok, err := unmarshalWellKnownType(m, r, opts); ok {
		return err
	}

	t, err := r.peek()
	if err != nil {
		return err
	}
	if t == nil {
		// if json is simply "null" we do nothing
		r.poll()
		return nil
	}

	if err := r.beginObject(); err != nil {
		return err
	}

	for r.hasNext() {
		f, err := r.nextObjectKey()
		if err != nil {
			return err
		}
		fd := m.FindFieldDescriptorByJSONName(f)
		if fd == nil {
			if opts.AllowUnknownFields {
				r.skip()
				continue
			}
			return fmt.Errorf("message type %s has no known field named %s", m.md.GetFullyQualifiedName(), f)
		}
		v, err := unmarshalJsField(fd, r, m.mf, opts)
		if err != nil {
			return err
		}
		if v != nil {
			if err := mergeField(m, fd, v); err != nil {
				return err
			}
		} else if fd.GetOneOf() != nil {
			// preserve explicit null for oneof fields (this is a little odd but
			// mimics the behavior of jsonpb with oneofs in generated message types)
			if fd.GetMessageType() != nil {
				typ := m.mf.GetKnownTypeRegistry().GetKnownType(fd.GetMessageType().GetFullyQualifiedName())
				if typ != nil {
					// typed nil
					if typ.Kind() != reflect.Ptr {
						typ = reflect.PtrTo(typ)
					}
					v = reflect.Zero(typ).Interface()
				} else {
					// can't use nil dynamic message, so we just use empty one instead
					v = m.mf.NewDynamicMessage(fd.GetMessageType())
				}
				if err := m.setField(fd, v); err != nil {
					return err
				}
			} else {
				// not a message... explicit null makes no sense
				return fmt.Errorf("message type %s cannot set field %s to null: it is not a message type", m.md.GetFullyQualifiedName(), f)
			}
		} else {
			m.clearField(fd)
		}
	}

	if err := r.endObject(); err != nil {
		return err
	}

	return nil
}

func isWellKnownValue(fd *desc.FieldDescriptor) bool {
	return !fd.IsRepeated() && fd.GetType() == descriptorpb.FieldDescriptorProto_TYPE_MESSAGE &&
		fd.GetMessageType().GetFullyQualifiedName() == "google.protobuf.Value"
}

func isWellKnownListValue(fd *desc.FieldDescriptor) bool {
	// we look for ListValue; but we also look for Value, which can be assigned a ListValue
	return !fd.IsRepeated() && fd.GetType() == descriptorpb.FieldDescriptorProto_TYPE_MESSAGE &&
		(fd.GetMessageType().GetFullyQualifiedName() == "google.protobuf.ListValue" ||
			fd.GetMessageType().GetFullyQualifiedName() == "google.protobuf.Value")
}

func unmarshalJsField(fd *desc.FieldDescriptor, r *jsReader, mf *MessageFactory, opts *jsonpb.Unmarshaler) (interface{}, error) {
	t, err := r.peek()
	if err != nil {
		return nil, err
	}
	if t == nil && !isWellKnownValue(fd) {
		// if value is null, just return nil
		// (unless field is google.protobuf.Value, in which case
		// we fall through to parse it as an instance where its
		// underlying value is set to a NullValue)
		r.poll()
		return nil, nil
	}

	if t == json.Delim('{') && fd.IsMap() {
		entryType := fd.GetMessageType()
		keyType := entryType.FindFieldByNumber(1)
		valueType := entryType.FindFieldByNumber(2)
		mp := map[interface{}]interface{}{}

		// TODO: if there are just two map keys "key" and "value" and they have the right type of values,
		// treat this JSON object as a single map entry message. (In keeping with support of map fields as
		// if they were normal repeated field of entry messages as well as supporting a transition from
		// optional to repeated...)

		if err := r.beginObject(); err != nil {
			return nil, err
		}
		for r.hasNext() {
			kk, err := unmarshalJsFieldElement(keyType, r, mf, opts, false)
			if err != nil {
				return nil, err
			}
			vv, err := unmarshalJsFieldElement(valueType, r, mf, opts, true)
			if err != nil {
				return nil, err
			}
			mp[kk] = vv
		}
		if err := r.endObject(); err != nil {
			return nil, err
		}

		return mp, nil
	} else if t == json.Delim('[') && !isWellKnownListValue(fd) {
		// We support parsing an array, even if field is not repeated, to mimic support in proto
		// binary wire format that supports changing an optional field to repeated and vice versa.
		// If the field is not repeated, we only keep the last value in the array.

		if err := r.beginArray(); err != nil {
			return nil, err
		}
		var sl []interface{}
		var v interface{}
		for r.hasNext() {
			var err error
			v, err = unmarshalJsFieldElement(fd, r, mf, opts, false)
			if err != nil {
				return nil, err
			}
			if fd.IsRepeated() && v != nil {
				sl = append(sl, v)
			}
		}
		if err := r.endArray(); err != nil {
			return nil, err
		}
		if fd.IsMap() {
			mp := map[interface{}]interface{}{}
			for _, m := range sl {
				msg := m.(*Message)
				kk, err := msg.TryGetFieldByNumber(1)
				if err != nil {
					return nil, err
				}
				vv, err := msg.TryGetFieldByNumber(2)
				if err != nil {
					return nil, err
				}
				mp[kk] = vv
			}
			return mp, nil
		} else if fd.IsRepeated() {
			return sl, nil
		} else {
			return v, nil
		}
	} else {
		// We support parsing a singular value, even if field is repeated, to mimic support in proto
		// binary wire format that supports changing an optional field to repeated and vice versa.
		// If the field is repeated, we store value as singleton slice of that one value.

		v, err := unmarshalJsFieldElement(fd, r, mf, opts, false)
		if err != nil {
			return nil, err
		}
		if v == nil {
			return nil, nil
		}
		if fd.IsRepeated() {
			return []interface{}{v}, nil
		} else {
			return v, nil
		}
	}
}

func unmarshalJsFieldElement(fd *desc.FieldDescriptor, r *jsReader, mf *MessageFactory, opts *jsonpb.Unmarshaler, allowNilMessage bool) (interface{}, error) {
	t, err := r.peek()
	if err != nil {
		return nil, err
	}

	switch fd.GetType() {
	case descriptorpb.FieldDescriptorProto_TYPE_MESSAGE,
		descriptorpb.FieldDescriptorProto_TYPE_GROUP:

		if t == nil && allowNilMessage {
			// if json is simply "null" return a nil pointer
			r.poll()
			return nilMessage(fd.GetMessageType()), nil
		}

		m := mf.NewMessage(fd.GetMessageType())
		if dm, ok := m.(*Message); ok {
			if err := dm.unmarshalJson(r, opts); err != nil {
				return nil, err
			}
		} else {
			var msg json.RawMessage
			if err := json.NewDecoder(r.unread()).Decode(&msg); err != nil {
				return nil, err
			}
			if err := r.skip(); err != nil {
				return nil, err
			}
			if err := opts.Unmarshal(bytes.NewReader([]byte(msg)), m); err != nil {
				return nil, err
			}
		}
		return m, nil

	case descriptorpb.FieldDescriptorProto_TYPE_ENUM:
		if e, err := r.nextNumber(); err != nil {
			return nil, err
		} else {
			// value could be string or number
			if i, err := e.Int64(); err != nil {
				// number cannot be parsed, so see if it's an enum value name
				vd := fd.GetEnumType().FindValueByName(string(e))
				if vd != nil {
					return vd.GetNumber(), nil
				} else {
					return nil, fmt.Errorf("enum %q does not have value named %q", fd.GetEnumType().GetFullyQualifiedName(), e)
				}
			} else if i > math.MaxInt32 || i < math.MinInt32 {
				return nil, NumericOverflowError
			} else {
				return int32(i), err
			}
		}

	case descriptorpb.FieldDescriptorProto_TYPE_INT32,
		descriptorpb.FieldDescriptorProto_TYPE_SINT32,
		descriptorpb.FieldDescriptorProto_TYPE_SFIXED32:
		if i, err := r.nextInt(); err != nil {
			return nil, err
		} else if i > math.MaxInt32 || i < math.MinInt32 {
			return nil, NumericOverflowError
		} else {
			return int32(i), err
		}

	case descriptorpb.FieldDescriptorProto_TYPE_INT64,
		descriptorpb.FieldDescriptorProto_TYPE_SINT64,
		descriptorpb.FieldDescriptorProto_TYPE_SFIXED64:
		return r.nextInt()

	case descriptorpb.FieldDescriptorProto_TYPE_UINT32,
		descriptorpb.FieldDescriptorProto_TYPE_FIXED32:
		if i, err := r.nextUint(); err != nil {
			return nil, err
		} else if i > math.MaxUint32 {
			return nil, NumericOverflowError
		} else {
			return uint32(i), err
		}

	case descriptorpb.FieldDescriptorProto_TYPE_UINT64,
		descriptorpb.FieldDescriptorProto_TYPE_FIXED64:
		return r.nextUint()

	case descriptorpb.FieldDescriptorProto_TYPE_BOOL:
		if str, ok := t.(string); ok {
			if str == "true" {
				r.poll() // consume token
				return true, err
			} else if str == "false" {
				r.poll() // consume token
				return false, err
			}
		}
		return r.nextBool()

	case descriptorpb.FieldDescriptorProto_TYPE_FLOAT:
		if f, err := r.nextFloat(); err != nil {
			return nil, err
		} else {
			return float32(f), nil
		}

	case descriptorpb.FieldDescriptorProto_TYPE_DOUBLE:
		return r.nextFloat()

	case descriptorpb.FieldDescriptorProto_TYPE_BYTES:
		return r.nextBytes()

	case descriptorpb.FieldDescriptorProto_TYPE_STRING:
		return r.nextString()

	default:
		return nil, fmt.Errorf("unknown field type: %v", fd.GetType())
	}
}

type jsReader struct {
	reader  *bytes.Reader
	dec     *json.Decoder
	current json.Token
	peeked  bool
}

func newJsReader(b []byte) *jsReader {
	reader := bytes.NewReader(b)
	dec := json.NewDecoder(reader)
	dec.UseNumber()
	return &jsReader{reader: reader, dec: dec}
}

func (r *jsReader) unread() io.Reader {
	bufs := make([]io.Reader, 3)
	var peeked []byte
	if r.peeked {
		if _, ok := r.current.(json.Delim); ok {
			peeked = []byte(fmt.Sprintf("%v", r.current))
		} else {
			peeked, _ = json.Marshal(r.current)
		}
	}
	readerCopy := *r.reader
	decCopy := *r.dec

	bufs[0] = bytes.NewReader(peeked)
	bufs[1] = decCopy.Buffered()
	bufs[2] = &readerCopy
	return &concatReader{bufs: bufs}
}

func (r *jsReader) hasNext() bool {
	return r.dec.More()
}

func (r *jsReader) peek() (json.Token, error) {
	if r.peeked {
		return r.current, nil
	}
	t, err := r.dec.Token()
	if err != nil {
		return nil, err
	}
	r.peeked = true
	r.current = t
	return t, nil
}

func (r *jsReader) poll() (json.Token, error) {
	if r.peeked {
		ret := r.current
		r.current = nil
		r.peeked = false
		return ret, nil
	}
	return r.dec.Token()
}

func (r *jsReader) beginObject() error {
	_, err := r.expect(func(t json.Token) bool { return t == json.Delim('{') }, nil, "start of JSON object: '{'")
	return err
}

func (r *jsReader) endObject() error {
	_, err := r.expect(func(t json.Token) bool { return t == json.Delim('}') }, nil, "end of JSON object: '}'")
	return err
}

func (r *jsReader) beginArray() error {
	_, err := r.expect(func(t json.Token) bool { return t == json.Delim('[') }, nil, "start of array: '['")
	return err
}

func (r *jsReader) endArray() error {
	_, err := r.expect(func(t json.Token) bool { return t == json.Delim(']') }, nil, "end of array: ']'")
	return err
}

func (r *jsReader) nextObjectKey() (string, error) {
	return r.nextString()
}

func (r *jsReader) nextString() (string, error) {
	t, err := r.expect(func(t json.Token) bool { _, ok := t.(string); return ok }, "", "string")
	if err != nil {
		return "", err
	}
	return t.(string), nil
}

func (r *jsReader) nextBytes() ([]byte, error) {
	str, err := r.nextString()
	if err != nil {
		return nil, err
	}
	return base64.StdEncoding.DecodeString(str)
}

func (r *jsReader) nextBool() (bool, error) {
	t, err := r.expect(func(t json.Token) bool { _, ok := t.(bool); return ok }, false, "boolean")
	if err != nil {
		return false, err
	}
	return t.(bool), nil
}

func (r *jsReader) nextInt() (int64, error) {
	n, err := r.nextNumber()
	if err != nil {
		return 0, err
	}
	return n.Int64()
}

func (r *jsReader) nextUint() (uint64, error) {
	n, err := r.nextNumber()
	if err != nil {
		return 0, err
	}
	return strconv.ParseUint(string(n), 10, 64)
}

func (r *jsReader) nextFloat() (float64, error) {
	n, err := r.nextNumber()
	if err != nil {
		return 0, err
	}
	return n.Float64()
}

func (r *jsReader) nextNumber() (json.Number, error) {
	t, err := r.expect(func(t json.Token) bool { return reflect.TypeOf(t).Kind() == reflect.String }, "0", "number")
	if err != nil {
		return "", err
	}
	switch t := t.(type) {
	case json.Number:
		return t, nil
	case string:
		return json.Number(t), nil
	}
	return "", fmt.Errorf("expecting a number but got %v", t)
}

func (r *jsReader) skip() error {
	t, err := r.poll()
	if err != nil {
		return err
	}
	if t == json.Delim('[') {
		if err := r.skipArray(); err != nil {
			return err
		}
	} else if t == json.Delim('{') {
		if err := r.skipObject(); err != nil {
			return err
		}
	}
	return nil
}

func (r *jsReader) skipArray() error {
	for r.hasNext() {
		if err := r.skip(); err != nil {
			return err
		}
	}
	if err := r.endArray(); err != nil {
		return err
	}
	return nil
}

func (r *jsReader) skipObject() error {
	for r.hasNext() {
		// skip object key
		if err := r.skip(); err != nil {
			return err
		}
		// and value
		if err := r.skip(); err != nil {
			return err
		}
	}
	if err := r.endObject(); err != nil {
		return err
	}
	return nil
}

func (r *jsReader) expect(predicate func(json.Token) bool, ifNil interface{}, expected string) (interface{}, error) {
	t, err := r.poll()
	if err != nil {
		return nil, err
	}
	if t == nil && ifNil != nil {
		return ifNil, nil
	}
	if !predicate(t) {
		return t, fmt.Errorf("bad input: expecting %s ; instead got %v", expected, t)
	}
	return t, nil
}

type concatReader struct {
	bufs []io.Reader
	curr int
}

func (r *concatReader) Read(p []byte) (n int, err error) {
	for {
		if r.curr >= len(r.bufs) {
			err = io.EOF
			return
		}
		var c int
		c, err = r.bufs[r.curr].Read(p)
		n += c
		if err != io.EOF {
			return
		}
		r.curr++
		p = p[c:]
	}
}

// AnyResolver returns a jsonpb.AnyResolver that uses the given file descriptors
// to resolve message names. It uses the given factory, which may be nil, to
// instantiate messages. The messages that it returns when resolving a type name
// may often be dynamic messages.
func AnyResolver(mf *MessageFactory, files ...*desc.FileDescriptor) jsonpb.AnyResolver {
	return &anyResolver{mf: mf, files: files}
}

type anyResolver struct {
	mf      *MessageFactory
	files   []*desc.FileDescriptor
	ignored map[*desc.FileDescriptor]struct{}
	other   jsonpb.AnyResolver
}

func wrapResolver(r jsonpb.AnyResolver, mf *MessageFactory, f *desc.FileDescriptor) (jsonpb.AnyResolver, bool) {
	if r, ok := r.(*anyResolver); ok {
		if _, ok := r.ignored[f]; ok {
			// if the current resolver is ignoring this file, it's because another
			// (upstream) resolver is already handling it, so nothing to do
			return r, false
		}
		for _, file := range r.files {
			if file == f {
				// no need to wrap!
				return r, false
			}
		}
		// ignore files that will be checked by the resolver we're wrapping
		// (we'll just delegate and let it search those files)
		ignored := map[*desc.FileDescriptor]struct{}{}
		for i := range r.ignored {
			ignored[i] = struct{}{}
		}
		ignore(r.files, ignored)
		return &anyResolver{mf: mf, files: []*desc.FileDescriptor{f}, ignored: ignored, other: r}, true
	}
	return &anyResolver{mf: mf, files: []*desc.FileDescriptor{f}, other: r}, true
}

func ignore(files []*desc.FileDescriptor, ignored map[*desc.FileDescriptor]struct{}) {
	for _, f := range files {
		if _, ok := ignored[f]; ok {
			continue
		}
		ignored[f] = struct{}{}
		ignore(f.GetDependencies(), ignored)
	}
}

func (r *anyResolver) Resolve(typeUrl string) (proto.Message, error) {
	mname := typeUrl
	if slash := strings.LastIndex(mname, "/"); slash >= 0 {
		mname = mname[slash+1:]
	}

	// see if the user-specified resolver is able to do the job
	if r.other != nil {
		msg, err := r.other.Resolve(typeUrl)
		if err == nil {
			return msg, nil
		}
	}

	// try to find the message in our known set of files
	checked := map[*desc.FileDescriptor]struct{}{}
	for _, f := range r.files {
		md := r.findMessage(f, mname, checked)
		if md != nil {
			return r.mf.NewMessage(md), nil
		}
	}
	// failing that, see if the message factory knows about this type
	var ktr *KnownTypeRegistry
	if r.mf != nil {
		ktr = r.mf.ktr
	} else {
		ktr = (*KnownTypeRegistry)(nil)
	}
	m := ktr.CreateIfKnown(mname)
	if m != nil {
		return m, nil
	}

	// no other resolver to fallback to? mimic default behavior
	mt := proto.MessageType(mname)
	if mt == nil {
		return nil, fmt.Errorf("unknown message type %q", mname)
	}
	return reflect.New(mt.Elem()).Interface().(proto.Message), nil
}

func (r *anyResolver) findMessage(fd *desc.FileDescriptor, msgName string, checked map[*desc.FileDescriptor]struct{}) *desc.MessageDescriptor {
	// if this is an ignored descriptor, skip
	if _, ok := r.ignored[fd]; ok {
		return nil
	}

	// bail if we've already checked this file
	if _, ok := checked[fd]; ok {
		return nil
	}
	checked[fd] = struct{}{}

	// see if this file has the message
	md := fd.FindMessage(msgName)
	if md != nil {
		return md
	}

	// if not, recursively search the file's imports
	for _, dep := range fd.GetDependencies() {
		md = r.findMessage(dep, msgName, checked)
		if md != nil {
			return md
		}
	}
	return nil
}

var _ jsonpb.AnyResolver = (*anyResolver)(nil)
