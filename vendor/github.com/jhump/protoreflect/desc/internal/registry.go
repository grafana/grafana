package internal

import (
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/dynamicpb"
)

func RegisterExtensionsForFile(reg *protoregistry.Types, fd protoreflect.FileDescriptor) {
	registerTypesForFile(reg, fd, true, false)
}

func RegisterTypesForFile(reg *protoregistry.Types, fd protoreflect.FileDescriptor) {
	registerTypesForFile(reg, fd, false, false)
}

func registerTypesForFile(reg *protoregistry.Types, fd protoreflect.FileDescriptor, extensionsOnly, publicImportsOnly bool) {
	registerTypes(reg, fd, extensionsOnly)
	for i := 0; i < fd.Imports().Len(); i++ {
		imp := fd.Imports().Get(i)
		if imp.IsPublic || !publicImportsOnly {
			registerTypesForFile(reg, imp, extensionsOnly, true)
		}
	}
}

func registerTypes(reg *protoregistry.Types, elem fileOrMessage, extensionsOnly bool) {
	for i := 0; i < elem.Extensions().Len(); i++ {
		_ = reg.RegisterExtension(dynamicpb.NewExtensionType(elem.Extensions().Get(i)))
	}
	if !extensionsOnly {
		for i := 0; i < elem.Messages().Len(); i++ {
			_ = reg.RegisterMessage(dynamicpb.NewMessageType(elem.Messages().Get(i)))
		}
		for i := 0; i < elem.Enums().Len(); i++ {
			_ = reg.RegisterEnum(dynamicpb.NewEnumType(elem.Enums().Get(i)))
		}
	}
	for i := 0; i < elem.Messages().Len(); i++ {
		registerTypes(reg, elem.Messages().Get(i), extensionsOnly)
	}
}

type fileOrMessage interface {
	Extensions() protoreflect.ExtensionDescriptors
	Messages() protoreflect.MessageDescriptors
	Enums() protoreflect.EnumDescriptors
}
