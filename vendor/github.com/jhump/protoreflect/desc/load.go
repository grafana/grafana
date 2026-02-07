package desc

import (
	"errors"
	"fmt"
	"reflect"
	"sync"

	"github.com/golang/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"

	"github.com/jhump/protoreflect/desc/sourceinfo"
	"github.com/jhump/protoreflect/internal"
)

// The global cache is used to store descriptors that wrap items in
// protoregistry.GlobalTypes and protoregistry.GlobalFiles. This prevents
// repeating work to re-wrap underlying global descriptors.
var (
	// We put all wrapped file and message descriptors in this cache.
	loadedDescriptors = lockingCache{cache: mapCache{}}

	// Unfortunately, we need a different mechanism for enums for
	// compatibility with old APIs, which required that they were
	// registered in a different way :(
	loadedEnumsMu sync.RWMutex
	loadedEnums   = map[reflect.Type]*EnumDescriptor{}
)

// LoadFileDescriptor creates a file descriptor using the bytes returned by
// proto.FileDescriptor. Descriptors are cached so that they do not need to be
// re-processed if the same file is fetched again later.
func LoadFileDescriptor(file string) (*FileDescriptor, error) {
	d, err := sourceinfo.GlobalFiles.FindFileByPath(file)
	if errors.Is(err, protoregistry.NotFound) {
		// for backwards compatibility, see if this matches a known old
		// alias for the file (older versions of libraries that registered
		// the files using incorrect/non-canonical paths)
		if alt := internal.StdFileAliases[file]; alt != "" {
			d, err = sourceinfo.GlobalFiles.FindFileByPath(alt)
		}
	}
	if err != nil {
		if !errors.Is(err, protoregistry.NotFound) {
			return nil, internal.ErrNoSuchFile(file)
		}
		return nil, err
	}
	if fd := loadedDescriptors.get(d); fd != nil {
		return fd.(*FileDescriptor), nil
	}

	var fd *FileDescriptor
	loadedDescriptors.withLock(func(cache descriptorCache) {
		fd, err = wrapFile(d, cache)
	})
	return fd, err
}

// LoadMessageDescriptor loads descriptor using the encoded descriptor proto returned by
// Message.Descriptor() for the given message type. If the given type is not recognized,
// then a nil descriptor is returned.
func LoadMessageDescriptor(message string) (*MessageDescriptor, error) {
	mt, err := sourceinfo.GlobalTypes.FindMessageByName(protoreflect.FullName(message))
	if err != nil {
		if errors.Is(err, protoregistry.NotFound) {
			return nil, nil
		}
		return nil, err
	}
	return loadMessageDescriptor(mt.Descriptor())
}

func loadMessageDescriptor(md protoreflect.MessageDescriptor) (*MessageDescriptor, error) {
	d := loadedDescriptors.get(md)
	if d != nil {
		return d.(*MessageDescriptor), nil
	}

	var err error
	loadedDescriptors.withLock(func(cache descriptorCache) {
		d, err = wrapMessage(md, cache)
	})
	if err != nil {
		return nil, err
	}
	return d.(*MessageDescriptor), err
}

// LoadMessageDescriptorForType loads descriptor using the encoded descriptor proto returned
// by message.Descriptor() for the given message type. If the given type is not recognized,
// then a nil descriptor is returned.
func LoadMessageDescriptorForType(messageType reflect.Type) (*MessageDescriptor, error) {
	m, err := messageFromType(messageType)
	if err != nil {
		return nil, err
	}
	return LoadMessageDescriptorForMessage(m)
}

// LoadMessageDescriptorForMessage loads descriptor using the encoded descriptor proto
// returned by message.Descriptor(). If the given type is not recognized, then a nil
// descriptor is returned.
func LoadMessageDescriptorForMessage(message proto.Message) (*MessageDescriptor, error) {
	// efficiently handle dynamic messages
	type descriptorable interface {
		GetMessageDescriptor() *MessageDescriptor
	}
	if d, ok := message.(descriptorable); ok {
		return d.GetMessageDescriptor(), nil
	}

	var md protoreflect.MessageDescriptor
	if m, ok := message.(protoreflect.ProtoMessage); ok {
		md = m.ProtoReflect().Descriptor()
	} else {
		md = proto.MessageReflect(message).Descriptor()
	}
	return loadMessageDescriptor(sourceinfo.WrapMessage(md))
}

func messageFromType(mt reflect.Type) (proto.Message, error) {
	if mt.Kind() != reflect.Ptr {
		mt = reflect.PtrTo(mt)
	}
	m, ok := reflect.Zero(mt).Interface().(proto.Message)
	if !ok {
		return nil, fmt.Errorf("failed to create message from type: %v", mt)
	}
	return m, nil
}

// interface implemented by all generated enums
type protoEnum interface {
	EnumDescriptor() ([]byte, []int)
}

// NB: There is no LoadEnumDescriptor that takes a fully-qualified enum name because
// it is not useful since protoc-gen-go does not expose the name anywhere in generated
// code or register it in a way that is it accessible for reflection code. This also
// means we have to cache enum descriptors differently -- we can only cache them as
// they are requested, as opposed to caching all enum types whenever a file descriptor
// is cached. This is because we need to know the generated type of the enums, and we
// don't know that at the time of caching file descriptors.

// LoadEnumDescriptorForType loads descriptor using the encoded descriptor proto returned
// by enum.EnumDescriptor() for the given enum type.
func LoadEnumDescriptorForType(enumType reflect.Type) (*EnumDescriptor, error) {
	// we cache descriptors using non-pointer type
	if enumType.Kind() == reflect.Ptr {
		enumType = enumType.Elem()
	}
	e := getEnumFromCache(enumType)
	if e != nil {
		return e, nil
	}
	enum, err := enumFromType(enumType)
	if err != nil {
		return nil, err
	}

	return loadEnumDescriptor(enumType, enum)
}

func getEnumFromCache(t reflect.Type) *EnumDescriptor {
	loadedEnumsMu.RLock()
	defer loadedEnumsMu.RUnlock()
	return loadedEnums[t]
}

func putEnumInCache(t reflect.Type, d *EnumDescriptor) {
	loadedEnumsMu.Lock()
	defer loadedEnumsMu.Unlock()
	loadedEnums[t] = d
}

// LoadEnumDescriptorForEnum loads descriptor using the encoded descriptor proto
// returned by enum.EnumDescriptor().
func LoadEnumDescriptorForEnum(enum protoEnum) (*EnumDescriptor, error) {
	et := reflect.TypeOf(enum)
	// we cache descriptors using non-pointer type
	if et.Kind() == reflect.Ptr {
		et = et.Elem()
		enum = reflect.Zero(et).Interface().(protoEnum)
	}
	e := getEnumFromCache(et)
	if e != nil {
		return e, nil
	}

	return loadEnumDescriptor(et, enum)
}

func enumFromType(et reflect.Type) (protoEnum, error) {
	e, ok := reflect.Zero(et).Interface().(protoEnum)
	if !ok {
		if et.Kind() != reflect.Ptr {
			et = et.Elem()
		}
		e, ok = reflect.Zero(et).Interface().(protoEnum)
	}
	if !ok {
		return nil, fmt.Errorf("failed to create enum from type: %v", et)
	}
	return e, nil
}

func getDescriptorForEnum(enum protoEnum) (*descriptorpb.FileDescriptorProto, []int, error) {
	fdb, path := enum.EnumDescriptor()
	name := fmt.Sprintf("%T", enum)
	fd, err := internal.DecodeFileDescriptor(name, fdb)
	return fd, path, err
}

func loadEnumDescriptor(et reflect.Type, enum protoEnum) (*EnumDescriptor, error) {
	fdp, path, err := getDescriptorForEnum(enum)
	if err != nil {
		return nil, err
	}

	fd, err := LoadFileDescriptor(fdp.GetName())
	if err != nil {
		return nil, err
	}

	ed := findEnum(fd, path)
	putEnumInCache(et, ed)
	return ed, nil
}

func findEnum(fd *FileDescriptor, path []int) *EnumDescriptor {
	if len(path) == 1 {
		return fd.GetEnumTypes()[path[0]]
	}
	md := fd.GetMessageTypes()[path[0]]
	for _, i := range path[1 : len(path)-1] {
		md = md.GetNestedMessageTypes()[i]
	}
	return md.GetNestedEnumTypes()[path[len(path)-1]]
}

// LoadFieldDescriptorForExtension loads the field descriptor that corresponds to the given
// extension description.
func LoadFieldDescriptorForExtension(ext *proto.ExtensionDesc) (*FieldDescriptor, error) {
	file, err := LoadFileDescriptor(ext.Filename)
	if err != nil {
		return nil, err
	}
	field, ok := file.FindSymbol(ext.Name).(*FieldDescriptor)
	// make sure descriptor agrees with attributes of the ExtensionDesc
	if !ok || !field.IsExtension() || field.GetOwner().GetFullyQualifiedName() != proto.MessageName(ext.ExtendedType) ||
		field.GetNumber() != ext.Field {
		return nil, fmt.Errorf("file descriptor contained unexpected object with name %s", ext.Name)
	}
	return field, nil
}
