package dynamic

import (
	"reflect"
	"sync"

	"github.com/golang/protobuf/proto"

	"github.com/jhump/protoreflect/desc"
)

// MessageFactory can be used to create new empty message objects. A default instance
// (without extension registry or known-type registry specified) will always return
// dynamic messages (e.g. type will be *dynamic.Message) except for "well-known" types.
// The well-known types include primitive wrapper types and a handful of other special
// types defined in standard protobuf definitions, like Any, Duration, and Timestamp.
type MessageFactory struct {
	er  *ExtensionRegistry
	ktr *KnownTypeRegistry
}

// NewMessageFactoryWithExtensionRegistry creates a new message factory where any
// dynamic messages produced will use the given extension registry to recognize and
// parse extension fields.
func NewMessageFactoryWithExtensionRegistry(er *ExtensionRegistry) *MessageFactory {
	return NewMessageFactoryWithRegistries(er, nil)
}

// NewMessageFactoryWithKnownTypeRegistry creates a new message factory where the
// known types, per the given registry, will be returned as normal protobuf messages
// (e.g. generated structs, instead of dynamic messages).
func NewMessageFactoryWithKnownTypeRegistry(ktr *KnownTypeRegistry) *MessageFactory {
	return NewMessageFactoryWithRegistries(nil, ktr)
}

// NewMessageFactoryWithDefaults creates a new message factory where all "default" types
// (those for which protoc-generated code is statically linked into the Go program) are
// known types. If any dynamic messages are produced, they will recognize and parse all
// "default" extension fields. This is the equivalent of:
//
//	NewMessageFactoryWithRegistries(
//	    NewExtensionRegistryWithDefaults(),
//	    NewKnownTypeRegistryWithDefaults())
func NewMessageFactoryWithDefaults() *MessageFactory {
	return NewMessageFactoryWithRegistries(NewExtensionRegistryWithDefaults(), NewKnownTypeRegistryWithDefaults())
}

// NewMessageFactoryWithRegistries creates a new message factory with the given extension
// and known type registries.
func NewMessageFactoryWithRegistries(er *ExtensionRegistry, ktr *KnownTypeRegistry) *MessageFactory {
	return &MessageFactory{
		er:  er,
		ktr: ktr,
	}
}

// NewMessage creates a new empty message that corresponds to the given descriptor.
// If the given descriptor describes a "known type" then that type is instantiated.
// Otherwise, an empty dynamic message is returned.
func (f *MessageFactory) NewMessage(md *desc.MessageDescriptor) proto.Message {
	var ktr *KnownTypeRegistry
	if f != nil {
		ktr = f.ktr
	}
	if m := ktr.CreateIfKnown(md.GetFullyQualifiedName()); m != nil {
		return m
	}
	return NewMessageWithMessageFactory(md, f)
}

// NewDynamicMessage creates a new empty dynamic message that corresponds to the given
// descriptor. This is like f.NewMessage(md) except the known type registry is not
// consulted so the return value is always a dynamic message.
//
// This is also like dynamic.NewMessage(md) except that the returned message will use
// this factory when creating other messages, like during de-serialization of fields
// that are themselves message types.
func (f *MessageFactory) NewDynamicMessage(md *desc.MessageDescriptor) *Message {
	return NewMessageWithMessageFactory(md, f)
}

// GetKnownTypeRegistry returns the known type registry that this factory uses to
// instantiate known (e.g. generated) message types.
func (f *MessageFactory) GetKnownTypeRegistry() *KnownTypeRegistry {
	if f == nil {
		return nil
	}
	return f.ktr
}

// GetExtensionRegistry returns the extension registry that this factory uses to
// create dynamic messages. The registry is used by dynamic messages to recognize
// and parse extension fields during de-serialization.
func (f *MessageFactory) GetExtensionRegistry() *ExtensionRegistry {
	if f == nil {
		return nil
	}
	return f.er
}

type wkt interface {
	XXX_WellKnownType() string
}

var typeOfWkt = reflect.TypeOf((*wkt)(nil)).Elem()

// KnownTypeRegistry is a registry of known message types, as identified by their
// fully-qualified name. A known message type is one for which a protoc-generated
// struct exists, so a dynamic message is not necessary to represent it. A
// MessageFactory uses a KnownTypeRegistry to decide whether to create a generated
// struct or a dynamic message. The zero-value registry (including the behavior of
// a nil pointer) only knows about the "well-known types" in protobuf. These
// include only the wrapper types and a handful of other special types like Any,
// Duration, and Timestamp.
type KnownTypeRegistry struct {
	excludeWkt     bool
	includeDefault bool
	mu             sync.RWMutex
	types          map[string]reflect.Type
}

// NewKnownTypeRegistryWithDefaults creates a new registry that knows about all
// "default" types (those for which protoc-generated code is statically linked
// into the Go program).
func NewKnownTypeRegistryWithDefaults() *KnownTypeRegistry {
	return &KnownTypeRegistry{includeDefault: true}
}

// NewKnownTypeRegistryWithoutWellKnownTypes creates a new registry that does *not*
// include the "well-known types" in protobuf. So even well-known types would be
// represented by a dynamic message.
func NewKnownTypeRegistryWithoutWellKnownTypes() *KnownTypeRegistry {
	return &KnownTypeRegistry{excludeWkt: true}
}

// AddKnownType adds the types of the given messages as known types.
func (r *KnownTypeRegistry) AddKnownType(kts ...proto.Message) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.types == nil {
		r.types = map[string]reflect.Type{}
	}
	for _, kt := range kts {
		r.types[proto.MessageName(kt)] = reflect.TypeOf(kt)
	}
}

// CreateIfKnown will construct an instance of the given message if it is a known type.
// If the given name is unknown, nil is returned.
func (r *KnownTypeRegistry) CreateIfKnown(messageName string) proto.Message {
	msgType := r.GetKnownType(messageName)
	if msgType == nil {
		return nil
	}

	if msgType.Kind() == reflect.Ptr {
		return reflect.New(msgType.Elem()).Interface().(proto.Message)
	} else {
		return reflect.New(msgType).Elem().Interface().(proto.Message)
	}
}

func isWellKnownType(t reflect.Type) bool {
	if t.Implements(typeOfWkt) {
		return true
	}
	if msg, ok := reflect.Zero(t).Interface().(proto.Message); ok {
		name := proto.MessageName(msg)
		_, ok := wellKnownTypeNames[name]
		return ok
	}
	return false
}

// GetKnownType will return the reflect.Type for the given message name if it is
// known. If it is not known, nil is returned.
func (r *KnownTypeRegistry) GetKnownType(messageName string) reflect.Type {
	if r == nil {
		// a nil registry behaves the same as zero value instance: only know of well-known types
		t := proto.MessageType(messageName)
		if t != nil && isWellKnownType(t) {
			return t
		}
		return nil
	}

	if r.includeDefault {
		t := proto.MessageType(messageName)
		if t != nil && isMessage(t) {
			return t
		}
	} else if !r.excludeWkt {
		t := proto.MessageType(messageName)
		if t != nil && isWellKnownType(t) {
			return t
		}
	}

	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.types[messageName]
}

func isMessage(t reflect.Type) bool {
	_, ok := reflect.Zero(t).Interface().(proto.Message)
	return ok
}
