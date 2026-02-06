package desc

import (
	"fmt"

	"github.com/bufbuild/protocompile/protoutil"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// DescriptorWrapper wraps a protoreflect.Descriptor. All of the Descriptor
// implementations in this package implement this interface. This can be
// used to recover the underlying descriptor. Each descriptor type in this
// package also provides a strongly-typed form of this method, such as the
// following method for *FileDescriptor:
//
//	UnwrapFile() protoreflect.FileDescriptor
type DescriptorWrapper interface {
	Unwrap() protoreflect.Descriptor
}

// WrapDescriptor wraps the given descriptor, returning a desc.Descriptor
// value that represents the same element.
func WrapDescriptor(d protoreflect.Descriptor) (Descriptor, error) {
	return wrapDescriptor(d, mapCache{})
}

func wrapDescriptor(d protoreflect.Descriptor, cache descriptorCache) (Descriptor, error) {
	switch d := d.(type) {
	case protoreflect.FileDescriptor:
		return wrapFile(d, cache)
	case protoreflect.MessageDescriptor:
		return wrapMessage(d, cache)
	case protoreflect.FieldDescriptor:
		return wrapField(d, cache)
	case protoreflect.OneofDescriptor:
		return wrapOneOf(d, cache)
	case protoreflect.EnumDescriptor:
		return wrapEnum(d, cache)
	case protoreflect.EnumValueDescriptor:
		return wrapEnumValue(d, cache)
	case protoreflect.ServiceDescriptor:
		return wrapService(d, cache)
	case protoreflect.MethodDescriptor:
		return wrapMethod(d, cache)
	default:
		return nil, fmt.Errorf("unknown descriptor type: %T", d)
	}
}

// WrapFiles wraps the given file descriptors, returning a slice of *desc.FileDescriptor
// values that represent the same files.
func WrapFiles(d []protoreflect.FileDescriptor) ([]*FileDescriptor, error) {
	cache := mapCache{}
	results := make([]*FileDescriptor, len(d))
	for i := range d {
		var err error
		results[i], err = wrapFile(d[i], cache)
		if err != nil {
			return nil, err
		}
	}
	return results, nil
}

// WrapFile wraps the given file descriptor, returning a *desc.FileDescriptor
// value that represents the same file.
func WrapFile(d protoreflect.FileDescriptor) (*FileDescriptor, error) {
	return wrapFile(d, mapCache{})
}

func wrapFile(d protoreflect.FileDescriptor, cache descriptorCache) (*FileDescriptor, error) {
	if res := cache.get(d); res != nil {
		return res.(*FileDescriptor), nil
	}
	fdp := protoutil.ProtoFromFileDescriptor(d)
	return convertFile(d, fdp, cache)
}

// WrapMessage wraps the given message descriptor, returning a *desc.MessageDescriptor
// value that represents the same message.
func WrapMessage(d protoreflect.MessageDescriptor) (*MessageDescriptor, error) {
	return wrapMessage(d, mapCache{})
}

func wrapMessage(d protoreflect.MessageDescriptor, cache descriptorCache) (*MessageDescriptor, error) {
	parent, err := wrapDescriptor(d.Parent(), cache)
	if err != nil {
		return nil, err
	}
	switch p := parent.(type) {
	case *FileDescriptor:
		return p.messages[d.Index()], nil
	case *MessageDescriptor:
		return p.nested[d.Index()], nil
	default:
		return nil, fmt.Errorf("message has unexpected parent type: %T", parent)
	}
}

// WrapField wraps the given field descriptor, returning a *desc.FieldDescriptor
// value that represents the same field.
func WrapField(d protoreflect.FieldDescriptor) (*FieldDescriptor, error) {
	return wrapField(d, mapCache{})
}

func wrapField(d protoreflect.FieldDescriptor, cache descriptorCache) (*FieldDescriptor, error) {
	parent, err := wrapDescriptor(d.Parent(), cache)
	if err != nil {
		return nil, err
	}
	switch p := parent.(type) {
	case *FileDescriptor:
		return p.extensions[d.Index()], nil
	case *MessageDescriptor:
		if d.IsExtension() {
			return p.extensions[d.Index()], nil
		}
		return p.fields[d.Index()], nil
	default:
		return nil, fmt.Errorf("field has unexpected parent type: %T", parent)
	}
}

// WrapOneOf wraps the given oneof descriptor, returning a *desc.OneOfDescriptor
// value that represents the same oneof.
func WrapOneOf(d protoreflect.OneofDescriptor) (*OneOfDescriptor, error) {
	return wrapOneOf(d, mapCache{})
}

func wrapOneOf(d protoreflect.OneofDescriptor, cache descriptorCache) (*OneOfDescriptor, error) {
	parent, err := wrapDescriptor(d.Parent(), cache)
	if err != nil {
		return nil, err
	}
	if p, ok := parent.(*MessageDescriptor); ok {
		return p.oneOfs[d.Index()], nil
	}
	return nil, fmt.Errorf("oneof has unexpected parent type: %T", parent)
}

// WrapEnum wraps the given enum descriptor, returning a *desc.EnumDescriptor
// value that represents the same enum.
func WrapEnum(d protoreflect.EnumDescriptor) (*EnumDescriptor, error) {
	return wrapEnum(d, mapCache{})
}

func wrapEnum(d protoreflect.EnumDescriptor, cache descriptorCache) (*EnumDescriptor, error) {
	parent, err := wrapDescriptor(d.Parent(), cache)
	if err != nil {
		return nil, err
	}
	switch p := parent.(type) {
	case *FileDescriptor:
		return p.enums[d.Index()], nil
	case *MessageDescriptor:
		return p.enums[d.Index()], nil
	default:
		return nil, fmt.Errorf("enum has unexpected parent type: %T", parent)
	}
}

// WrapEnumValue wraps the given enum value descriptor, returning a *desc.EnumValueDescriptor
// value that represents the same enum value.
func WrapEnumValue(d protoreflect.EnumValueDescriptor) (*EnumValueDescriptor, error) {
	return wrapEnumValue(d, mapCache{})
}

func wrapEnumValue(d protoreflect.EnumValueDescriptor, cache descriptorCache) (*EnumValueDescriptor, error) {
	parent, err := wrapDescriptor(d.Parent(), cache)
	if err != nil {
		return nil, err
	}
	if p, ok := parent.(*EnumDescriptor); ok {
		return p.values[d.Index()], nil
	}
	return nil, fmt.Errorf("enum value has unexpected parent type: %T", parent)
}

// WrapService wraps the given service descriptor, returning a *desc.ServiceDescriptor
// value that represents the same service.
func WrapService(d protoreflect.ServiceDescriptor) (*ServiceDescriptor, error) {
	return wrapService(d, mapCache{})
}

func wrapService(d protoreflect.ServiceDescriptor, cache descriptorCache) (*ServiceDescriptor, error) {
	parent, err := wrapDescriptor(d.Parent(), cache)
	if err != nil {
		return nil, err
	}
	if p, ok := parent.(*FileDescriptor); ok {
		return p.services[d.Index()], nil
	}
	return nil, fmt.Errorf("service has unexpected parent type: %T", parent)
}

// WrapMethod wraps the given method descriptor, returning a *desc.MethodDescriptor
// value that represents the same method.
func WrapMethod(d protoreflect.MethodDescriptor) (*MethodDescriptor, error) {
	return wrapMethod(d, mapCache{})
}

func wrapMethod(d protoreflect.MethodDescriptor, cache descriptorCache) (*MethodDescriptor, error) {
	parent, err := wrapDescriptor(d.Parent(), cache)
	if err != nil {
		return nil, err
	}
	if p, ok := parent.(*ServiceDescriptor); ok {
		return p.methods[d.Index()], nil
	}
	return nil, fmt.Errorf("method has unexpected parent type: %T", parent)
}
