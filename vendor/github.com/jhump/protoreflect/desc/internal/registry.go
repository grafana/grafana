package internal

import (
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/dynamicpb"
)

// RegisterExtensionsFromImportedFile registers extensions in the given file as well
// as those in its public imports. So if another file imports the given fd, this adds
// all extensions made visible to that importing file.
//
// All extensions in the given file are made visible to the importing file, and so are
// extensions in any public imports in the given file.
func RegisterExtensionsFromImportedFile(reg *protoregistry.Types, fd protoreflect.FileDescriptor) {
	registerTypesForFile(reg, fd, true, true)
}

// RegisterExtensionsVisibleToFile registers all extensions visible to the given file.
// This includes all extensions defined in fd and as well as extensions defined in the
// files that it imports (and any public imports thereof, etc).
//
// This is effectively the same as registering the extensions in fd and then calling
// RegisterExtensionsFromImportedFile for each file imported by fd.
func RegisterExtensionsVisibleToFile(reg *protoregistry.Types, fd protoreflect.FileDescriptor) {
	registerTypesForFile(reg, fd, true, false)
}

// RegisterTypesVisibleToFile registers all types visible to the given file.
// This is the same as RegisterExtensionsVisibleToFile but it also registers
// message and enum types, not just extensions.
func RegisterTypesVisibleToFile(reg *protoregistry.Types, fd protoreflect.FileDescriptor) {
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
