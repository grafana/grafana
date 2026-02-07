package dynamic

import (
	"errors"
	"reflect"

	"github.com/golang/protobuf/proto"

	"github.com/jhump/protoreflect/desc"
)

// Merge merges the given source message into the given destination message. Use
// use this instead of proto.Merge when one or both of the messages might be a
// a dynamic message. If there is a problem merging the messages, such as the
// two messages having different types, then this method will panic (just as
// proto.Merges does).
func Merge(dst, src proto.Message) {
	if dm, ok := dst.(*Message); ok {
		if err := dm.MergeFrom(src); err != nil {
			panic(err.Error())
		}
	} else if dm, ok := src.(*Message); ok {
		if err := dm.MergeInto(dst); err != nil {
			panic(err.Error())
		}
	} else {
		proto.Merge(dst, src)
	}
}

// TryMerge merges the given source message into the given destination message.
// You can use this instead of proto.Merge when one or both of the messages
// might be a dynamic message. Unlike proto.Merge, this method will return an
// error on failure instead of panic'ing.
func TryMerge(dst, src proto.Message) error {
	if dm, ok := dst.(*Message); ok {
		if err := dm.MergeFrom(src); err != nil {
			return err
		}
	} else if dm, ok := src.(*Message); ok {
		if err := dm.MergeInto(dst); err != nil {
			return err
		}
	} else {
		// proto.Merge panics on bad input, so we first verify
		// inputs and return error instead of panic
		out := reflect.ValueOf(dst)
		if out.IsNil() {
			return errors.New("proto: nil destination")
		}
		in := reflect.ValueOf(src)
		if in.Type() != out.Type() {
			return errors.New("proto: type mismatch")
		}
		proto.Merge(dst, src)
	}
	return nil
}

func mergeField(m *Message, fd *desc.FieldDescriptor, val interface{}) error {
	rv := reflect.ValueOf(val)

	if fd.IsMap() && rv.Kind() == reflect.Map {
		return mergeMapField(m, fd, rv)
	}

	if fd.IsRepeated() && rv.Kind() == reflect.Slice && rv.Type() != typeOfBytes {
		for i := 0; i < rv.Len(); i++ {
			e := rv.Index(i)
			if e.Kind() == reflect.Interface && !e.IsNil() {
				e = e.Elem()
			}
			if err := m.addRepeatedField(fd, e.Interface()); err != nil {
				return err
			}
		}
		return nil
	}

	if fd.IsRepeated() {
		return m.addRepeatedField(fd, val)
	} else if fd.GetMessageType() == nil {
		return m.setField(fd, val)
	}

	// it's a message type, so we want to merge contents
	var err error
	if val, err = validFieldValue(fd, val); err != nil {
		return err
	}

	existing, _ := m.doGetField(fd, true)
	if existing != nil && !reflect.ValueOf(existing).IsNil() {
		return TryMerge(existing.(proto.Message), val.(proto.Message))
	}

	// no existing message, so just set field
	m.internalSetField(fd, val)
	return nil
}
