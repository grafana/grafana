package dynamic

import (
	"bytes"
	"reflect"

	"github.com/golang/protobuf/proto"

	"github.com/jhump/protoreflect/desc"
)

// Equal returns true if the given two dynamic messages are equal. Two messages are equal when they
// have the same message type and same fields set to equal values. For proto3 messages, fields set
// to their zero value are considered unset.
func Equal(a, b *Message) bool {
	if a == b {
		return true
	}
	if (a == nil) != (b == nil) {
		return false
	}
	if a.md.GetFullyQualifiedName() != b.md.GetFullyQualifiedName() {
		return false
	}
	if len(a.values) != len(b.values) {
		return false
	}
	if len(a.unknownFields) != len(b.unknownFields) {
		return false
	}
	for tag, aval := range a.values {
		bval, ok := b.values[tag]
		if !ok {
			return false
		}
		if !fieldsEqual(aval, bval) {
			return false
		}
	}
	for tag, au := range a.unknownFields {
		bu, ok := b.unknownFields[tag]
		if !ok {
			return false
		}
		if len(au) != len(bu) {
			return false
		}
		for i, aval := range au {
			bval := bu[i]
			if aval.Encoding != bval.Encoding {
				return false
			}
			if aval.Encoding == proto.WireBytes || aval.Encoding == proto.WireStartGroup {
				if !bytes.Equal(aval.Contents, bval.Contents) {
					return false
				}
			} else if aval.Value != bval.Value {
				return false
			}
		}
	}
	// all checks pass!
	return true
}

func fieldsEqual(aval, bval interface{}) bool {
	arv := reflect.ValueOf(aval)
	brv := reflect.ValueOf(bval)
	if arv.Type() != brv.Type() {
		// it is possible that one is a dynamic message and one is not
		apm, ok := aval.(proto.Message)
		if !ok {
			return false
		}
		bpm, ok := bval.(proto.Message)
		if !ok {
			return false
		}
		return MessagesEqual(apm, bpm)

	} else {
		switch arv.Kind() {
		case reflect.Ptr:
			apm, ok := aval.(proto.Message)
			if !ok {
				// Don't know how to compare pointer values that aren't messages!
				// Maybe this should panic?
				return false
			}
			bpm := bval.(proto.Message) // we know it will succeed because we know a and b have same type
			return MessagesEqual(apm, bpm)

		case reflect.Map:
			return mapsEqual(arv, brv)

		case reflect.Slice:
			if arv.Type() == typeOfBytes {
				return bytes.Equal(aval.([]byte), bval.([]byte))
			} else {
				return slicesEqual(arv, brv)
			}

		default:
			return aval == bval
		}
	}
}

func slicesEqual(a, b reflect.Value) bool {
	if a.Len() != b.Len() {
		return false
	}
	for i := 0; i < a.Len(); i++ {
		ai := a.Index(i)
		bi := b.Index(i)
		if !fieldsEqual(ai.Interface(), bi.Interface()) {
			return false
		}
	}
	return true
}

// MessagesEqual returns true if the given two messages are equal. Use this instead of proto.Equal
// when one or both of the messages might be a dynamic message.
func MessagesEqual(a, b proto.Message) bool {
	da, aok := a.(*Message)
	db, bok := b.(*Message)
	// Both dynamic messages
	if aok && bok {
		return Equal(da, db)
	}
	// Neither dynamic messages
	if !aok && !bok {
		return proto.Equal(a, b)
	}
	// Mixed
	if bok {
		// we want a to be the dynamic one
		b, da = a, db
	}

	// Instead of panic'ing below if we have a nil dynamic message, check
	// now and return false if the input message is not also nil.
	if da == nil {
		return isNil(b)
	}

	md, err := desc.LoadMessageDescriptorForMessage(b)
	if err != nil {
		return false
	}
	db = NewMessageWithMessageFactory(md, da.mf)
	if db.ConvertFrom(b) != nil {
		return false
	}
	return Equal(da, db)
}
