package sourceinfo

import (
	"fmt"

	"google.golang.org/protobuf/reflect/protoreflect"
)

// These are wrappers around the various interfaces in the
// google.golang.org/protobuf/reflect/protoreflect that all
// make sure to return a FileDescriptor that includes source
// code info.

type fileDescriptor struct {
	protoreflect.FileDescriptor
	locs protoreflect.SourceLocations
}

func (f fileDescriptor) ParentFile() protoreflect.FileDescriptor {
	return f
}

func (f fileDescriptor) Parent() protoreflect.Descriptor {
	return nil
}

func (f fileDescriptor) Imports() protoreflect.FileImports {
	return imports{f.FileDescriptor.Imports()}
}

func (f fileDescriptor) Messages() protoreflect.MessageDescriptors {
	return messages{f.FileDescriptor.Messages()}
}

func (f fileDescriptor) Enums() protoreflect.EnumDescriptors {
	return enums{f.FileDescriptor.Enums()}
}

func (f fileDescriptor) Extensions() protoreflect.ExtensionDescriptors {
	return extensions{f.FileDescriptor.Extensions()}
}

func (f fileDescriptor) Services() protoreflect.ServiceDescriptors {
	return services{f.FileDescriptor.Services()}
}

func (f fileDescriptor) SourceLocations() protoreflect.SourceLocations {
	return f.locs
}

type imports struct {
	protoreflect.FileImports
}

func (im imports) Get(i int) protoreflect.FileImport {
	fi := im.FileImports.Get(i)
	return protoreflect.FileImport{
		FileDescriptor: getFile(fi.FileDescriptor),
		IsPublic:       fi.IsPublic,
		IsWeak:         fi.IsWeak,
	}
}

type messages struct {
	protoreflect.MessageDescriptors
}

func (m messages) Get(i int) protoreflect.MessageDescriptor {
	return messageDescriptor{m.MessageDescriptors.Get(i)}
}

func (m messages) ByName(n protoreflect.Name) protoreflect.MessageDescriptor {
	return messageDescriptor{m.MessageDescriptors.ByName(n)}
}

type enums struct {
	protoreflect.EnumDescriptors
}

func (e enums) Get(i int) protoreflect.EnumDescriptor {
	return enumDescriptor{e.EnumDescriptors.Get(i)}
}

func (e enums) ByName(n protoreflect.Name) protoreflect.EnumDescriptor {
	return enumDescriptor{e.EnumDescriptors.ByName(n)}
}

type extensions struct {
	protoreflect.ExtensionDescriptors
}

func (e extensions) Get(i int) protoreflect.ExtensionDescriptor {
	d := e.ExtensionDescriptors.Get(i)
	if ed, ok := d.(protoreflect.ExtensionTypeDescriptor); ok {
		return extensionDescriptor{ed}
	}
	return fieldDescriptor{d}
}

func (e extensions) ByName(n protoreflect.Name) protoreflect.ExtensionDescriptor {
	d := e.ExtensionDescriptors.ByName(n)
	if ed, ok := d.(protoreflect.ExtensionTypeDescriptor); ok {
		return extensionDescriptor{ed}
	}
	return fieldDescriptor{d}
}

type services struct {
	protoreflect.ServiceDescriptors
}

func (s services) Get(i int) protoreflect.ServiceDescriptor {
	return serviceDescriptor{s.ServiceDescriptors.Get(i)}
}

func (s services) ByName(n protoreflect.Name) protoreflect.ServiceDescriptor {
	return serviceDescriptor{s.ServiceDescriptors.ByName(n)}
}

type messageDescriptor struct {
	protoreflect.MessageDescriptor
}

func (m messageDescriptor) ParentFile() protoreflect.FileDescriptor {
	return getFile(m.MessageDescriptor.ParentFile())
}

func (m messageDescriptor) Parent() protoreflect.Descriptor {
	d := m.MessageDescriptor.Parent()
	switch d := d.(type) {
	case protoreflect.MessageDescriptor:
		return messageDescriptor{d}
	case protoreflect.FileDescriptor:
		return getFile(d)
	case nil:
		return nil
	default:
		panic(fmt.Sprintf("unexpected descriptor type %T", d))
	}
}

func (m messageDescriptor) Fields() protoreflect.FieldDescriptors {
	return fields{m.MessageDescriptor.Fields()}
}

func (m messageDescriptor) Oneofs() protoreflect.OneofDescriptors {
	return oneOfs{m.MessageDescriptor.Oneofs()}
}

func (m messageDescriptor) Enums() protoreflect.EnumDescriptors {
	return enums{m.MessageDescriptor.Enums()}
}

func (m messageDescriptor) Messages() protoreflect.MessageDescriptors {
	return messages{m.MessageDescriptor.Messages()}
}

func (m messageDescriptor) Extensions() protoreflect.ExtensionDescriptors {
	return extensions{m.MessageDescriptor.Extensions()}
}

type fields struct {
	protoreflect.FieldDescriptors
}

func (f fields) Get(i int) protoreflect.FieldDescriptor {
	return fieldDescriptor{f.FieldDescriptors.Get(i)}
}

func (f fields) ByName(n protoreflect.Name) protoreflect.FieldDescriptor {
	return fieldDescriptor{f.FieldDescriptors.ByName(n)}
}

func (f fields) ByJSONName(n string) protoreflect.FieldDescriptor {
	return fieldDescriptor{f.FieldDescriptors.ByJSONName(n)}
}

func (f fields) ByTextName(n string) protoreflect.FieldDescriptor {
	return fieldDescriptor{f.FieldDescriptors.ByTextName(n)}
}

func (f fields) ByNumber(n protoreflect.FieldNumber) protoreflect.FieldDescriptor {
	return fieldDescriptor{f.FieldDescriptors.ByNumber(n)}
}

type oneOfs struct {
	protoreflect.OneofDescriptors
}

func (o oneOfs) Get(i int) protoreflect.OneofDescriptor {
	return oneOfDescriptor{o.OneofDescriptors.Get(i)}
}

func (o oneOfs) ByName(n protoreflect.Name) protoreflect.OneofDescriptor {
	return oneOfDescriptor{o.OneofDescriptors.ByName(n)}
}

type fieldDescriptor struct {
	protoreflect.FieldDescriptor
}

func (f fieldDescriptor) ParentFile() protoreflect.FileDescriptor {
	return getFile(f.FieldDescriptor.ParentFile())
}

func (f fieldDescriptor) Parent() protoreflect.Descriptor {
	d := f.FieldDescriptor.Parent()
	switch d := d.(type) {
	case protoreflect.MessageDescriptor:
		return messageDescriptor{d}
	case protoreflect.FileDescriptor:
		return getFile(d)
	case nil:
		return nil
	default:
		panic(fmt.Sprintf("unexpected descriptor type %T", d))
	}
}

func (f fieldDescriptor) MapKey() protoreflect.FieldDescriptor {
	fd := f.FieldDescriptor.MapKey()
	if fd == nil {
		return nil
	}
	return fieldDescriptor{fd}
}

func (f fieldDescriptor) MapValue() protoreflect.FieldDescriptor {
	fd := f.FieldDescriptor.MapValue()
	if fd == nil {
		return nil
	}
	return fieldDescriptor{fd}
}

func (f fieldDescriptor) DefaultEnumValue() protoreflect.EnumValueDescriptor {
	ed := f.FieldDescriptor.DefaultEnumValue()
	if ed == nil {
		return nil
	}
	return enumValueDescriptor{ed}
}

func (f fieldDescriptor) ContainingOneof() protoreflect.OneofDescriptor {
	od := f.FieldDescriptor.ContainingOneof()
	if od == nil {
		return nil
	}
	return oneOfDescriptor{od}
}

func (f fieldDescriptor) ContainingMessage() protoreflect.MessageDescriptor {
	return messageDescriptor{f.FieldDescriptor.ContainingMessage()}
}

func (f fieldDescriptor) Enum() protoreflect.EnumDescriptor {
	ed := f.FieldDescriptor.Enum()
	if ed == nil {
		return nil
	}
	return enumDescriptor{ed}
}

func (f fieldDescriptor) Message() protoreflect.MessageDescriptor {
	md := f.FieldDescriptor.Message()
	if md == nil {
		return nil
	}
	return messageDescriptor{md}
}

type oneOfDescriptor struct {
	protoreflect.OneofDescriptor
}

func (o oneOfDescriptor) ParentFile() protoreflect.FileDescriptor {
	return getFile(o.OneofDescriptor.ParentFile())
}

func (o oneOfDescriptor) Parent() protoreflect.Descriptor {
	d := o.OneofDescriptor.Parent()
	switch d := d.(type) {
	case protoreflect.MessageDescriptor:
		return messageDescriptor{d}
	case nil:
		return nil
	default:
		panic(fmt.Sprintf("unexpected descriptor type %T", d))
	}
}

func (o oneOfDescriptor) Fields() protoreflect.FieldDescriptors {
	return fields{o.OneofDescriptor.Fields()}
}

type enumDescriptor struct {
	protoreflect.EnumDescriptor
}

func (e enumDescriptor) ParentFile() protoreflect.FileDescriptor {
	return getFile(e.EnumDescriptor.ParentFile())
}

func (e enumDescriptor) Parent() protoreflect.Descriptor {
	d := e.EnumDescriptor.Parent()
	switch d := d.(type) {
	case protoreflect.MessageDescriptor:
		return messageDescriptor{d}
	case protoreflect.FileDescriptor:
		return getFile(d)
	case nil:
		return nil
	default:
		panic(fmt.Sprintf("unexpected descriptor type %T", d))
	}
}

func (e enumDescriptor) Values() protoreflect.EnumValueDescriptors {
	return enumValues{e.EnumDescriptor.Values()}
}

type enumValues struct {
	protoreflect.EnumValueDescriptors
}

func (e enumValues) Get(i int) protoreflect.EnumValueDescriptor {
	return enumValueDescriptor{e.EnumValueDescriptors.Get(i)}
}

func (e enumValues) ByName(n protoreflect.Name) protoreflect.EnumValueDescriptor {
	return enumValueDescriptor{e.EnumValueDescriptors.ByName(n)}
}

func (e enumValues) ByNumber(n protoreflect.EnumNumber) protoreflect.EnumValueDescriptor {
	return enumValueDescriptor{e.EnumValueDescriptors.ByNumber(n)}
}

type enumValueDescriptor struct {
	protoreflect.EnumValueDescriptor
}

func (e enumValueDescriptor) ParentFile() protoreflect.FileDescriptor {
	return getFile(e.EnumValueDescriptor.ParentFile())
}

func (e enumValueDescriptor) Parent() protoreflect.Descriptor {
	d := e.EnumValueDescriptor.Parent()
	switch d := d.(type) {
	case protoreflect.EnumDescriptor:
		return enumDescriptor{d}
	case nil:
		return nil
	default:
		panic(fmt.Sprintf("unexpected descriptor type %T", d))
	}
}

type extensionDescriptor struct {
	protoreflect.ExtensionTypeDescriptor
}

func (e extensionDescriptor) ParentFile() protoreflect.FileDescriptor {
	return getFile(e.ExtensionTypeDescriptor.ParentFile())
}

func (e extensionDescriptor) Parent() protoreflect.Descriptor {
	d := e.ExtensionTypeDescriptor.Parent()
	switch d := d.(type) {
	case protoreflect.MessageDescriptor:
		return messageDescriptor{d}
	case protoreflect.FileDescriptor:
		return getFile(d)
	case nil:
		return nil
	default:
		panic(fmt.Sprintf("unexpected descriptor type %T", d))
	}
}

func (e extensionDescriptor) MapKey() protoreflect.FieldDescriptor {
	fd := e.ExtensionTypeDescriptor.MapKey()
	if fd == nil {
		return nil
	}
	return fieldDescriptor{fd}
}

func (e extensionDescriptor) MapValue() protoreflect.FieldDescriptor {
	fd := e.ExtensionTypeDescriptor.MapValue()
	if fd == nil {
		return nil
	}
	return fieldDescriptor{fd}
}

func (e extensionDescriptor) DefaultEnumValue() protoreflect.EnumValueDescriptor {
	ed := e.ExtensionTypeDescriptor.DefaultEnumValue()
	if ed == nil {
		return nil
	}
	return enumValueDescriptor{ed}
}

func (e extensionDescriptor) ContainingOneof() protoreflect.OneofDescriptor {
	od := e.ExtensionTypeDescriptor.ContainingOneof()
	if od == nil {
		return nil
	}
	return oneOfDescriptor{od}
}

func (e extensionDescriptor) ContainingMessage() protoreflect.MessageDescriptor {
	return messageDescriptor{e.ExtensionTypeDescriptor.ContainingMessage()}
}

func (e extensionDescriptor) Enum() protoreflect.EnumDescriptor {
	ed := e.ExtensionTypeDescriptor.Enum()
	if ed == nil {
		return nil
	}
	return enumDescriptor{ed}
}

func (e extensionDescriptor) Message() protoreflect.MessageDescriptor {
	md := e.ExtensionTypeDescriptor.Message()
	if md == nil {
		return nil
	}
	return messageDescriptor{md}
}

func (e extensionDescriptor) Descriptor() protoreflect.ExtensionDescriptor {
	return e
}

var _ protoreflect.ExtensionTypeDescriptor = extensionDescriptor{}

type serviceDescriptor struct {
	protoreflect.ServiceDescriptor
}

func (s serviceDescriptor) ParentFile() protoreflect.FileDescriptor {
	return getFile(s.ServiceDescriptor.ParentFile())
}

func (s serviceDescriptor) Parent() protoreflect.Descriptor {
	d := s.ServiceDescriptor.Parent()
	switch d := d.(type) {
	case protoreflect.FileDescriptor:
		return getFile(d)
	case nil:
		return nil
	default:
		panic(fmt.Sprintf("unexpected descriptor type %T", d))
	}
}

func (s serviceDescriptor) Methods() protoreflect.MethodDescriptors {
	return methods{s.ServiceDescriptor.Methods()}
}

type methods struct {
	protoreflect.MethodDescriptors
}

func (m methods) Get(i int) protoreflect.MethodDescriptor {
	return methodDescriptor{m.MethodDescriptors.Get(i)}
}

func (m methods) ByName(n protoreflect.Name) protoreflect.MethodDescriptor {
	return methodDescriptor{m.MethodDescriptors.ByName(n)}
}

type methodDescriptor struct {
	protoreflect.MethodDescriptor
}

func (m methodDescriptor) ParentFile() protoreflect.FileDescriptor {
	return getFile(m.MethodDescriptor.ParentFile())
}

func (m methodDescriptor) Parent() protoreflect.Descriptor {
	d := m.MethodDescriptor.Parent()
	switch d := d.(type) {
	case protoreflect.ServiceDescriptor:
		return serviceDescriptor{d}
	case nil:
		return nil
	default:
		panic(fmt.Sprintf("unexpected descriptor type %T", d))
	}
}

func (m methodDescriptor) Input() protoreflect.MessageDescriptor {
	return messageDescriptor{m.MethodDescriptor.Input()}
}

func (m methodDescriptor) Output() protoreflect.MessageDescriptor {
	return messageDescriptor{m.MethodDescriptor.Output()}
}

type extensionType struct {
	protoreflect.ExtensionType
}

func (e extensionType) TypeDescriptor() protoreflect.ExtensionTypeDescriptor {
	return extensionDescriptor{e.ExtensionType.TypeDescriptor()}
}

type messageType struct {
	protoreflect.MessageType
}

func (m messageType) Descriptor() protoreflect.MessageDescriptor {
	return messageDescriptor{m.MessageType.Descriptor()}
}

// WrapFile wraps the given file descriptor so that it will include source
// code info that was registered with this package if the given file was
// processed with protoc-gen-gosrcinfo. Returns fd without wrapping if fd
// already contains source code info.
func WrapFile(fd protoreflect.FileDescriptor) protoreflect.FileDescriptor {
	if wrapper, ok := fd.(fileDescriptor); ok {
		// already wrapped
		return wrapper
	}
	if fd.SourceLocations().Len() > 0 {
		// no need to wrap since it includes source info already
		return fd
	}
	return getFile(fd)
}

// WrapMessage wraps the given message descriptor so that it will include source
// code info that was registered with this package if the file it is defined in
// was processed with protoc-gen-gosrcinfo. Returns md without wrapping if md's
// parent file already contains source code info.
func WrapMessage(md protoreflect.MessageDescriptor) protoreflect.MessageDescriptor {
	if wrapper, ok := md.(messageDescriptor); ok {
		// already wrapped
		return wrapper
	}
	if md.ParentFile().SourceLocations().Len() > 0 {
		// no need to wrap since it includes source info already
		return md
	}
	if !canWrap(md) {
		return md
	}
	return messageDescriptor{md}
}

// WrapEnum wraps the given enum descriptor so that it will include source
// code info that was registered with this package if the file it is defined in
// was processed with protoc-gen-gosrcinfo. Returns ed without wrapping if ed's
// parent file already contains source code info.
func WrapEnum(ed protoreflect.EnumDescriptor) protoreflect.EnumDescriptor {
	if wrapper, ok := ed.(enumDescriptor); ok {
		// already wrapped
		return wrapper
	}
	if ed.ParentFile().SourceLocations().Len() > 0 {
		// no need to wrap since it includes source info already
		return ed
	}
	if !canWrap(ed) {
		return ed
	}
	return enumDescriptor{ed}
}

// WrapService wraps the given service descriptor so that it will include source
// code info that was registered with this package if the file it is defined in
// was processed with protoc-gen-gosrcinfo. Returns sd without wrapping if sd's
// parent file already contains source code info.
func WrapService(sd protoreflect.ServiceDescriptor) protoreflect.ServiceDescriptor {
	if wrapper, ok := sd.(serviceDescriptor); ok {
		// already wrapped
		return wrapper
	}
	if sd.ParentFile().SourceLocations().Len() > 0 {
		// no need to wrap since it includes source info already
		return sd
	}
	if !canWrap(sd) {
		return sd
	}
	return serviceDescriptor{sd}
}

// WrapExtensionType wraps the given extension type so that its associated
// descriptor will include source code info that was registered with this package
// if the file it is defined in was processed with protoc-gen-gosrcinfo. Returns
// xt without wrapping if the parent file of xt's descriptor already contains
// source code info.
func WrapExtensionType(xt protoreflect.ExtensionType) protoreflect.ExtensionType {
	if wrapper, ok := xt.(extensionType); ok {
		// already wrapped
		return wrapper
	}
	if xt.TypeDescriptor().ParentFile().SourceLocations().Len() > 0 {
		// no need to wrap since it includes source info already
		return xt
	}
	if !canWrap(xt.TypeDescriptor()) {
		return xt
	}
	return extensionType{xt}
}

// WrapMessageType wraps the given message type so that its associated
// descriptor will include source code info that was registered with this package
// if the file it is defined in was processed with protoc-gen-gosrcinfo. Returns
// mt without wrapping if the parent file of mt's descriptor already contains
// source code info.
func WrapMessageType(mt protoreflect.MessageType) protoreflect.MessageType {
	if wrapper, ok := mt.(messageType); ok {
		// already wrapped
		return wrapper
	}
	if mt.Descriptor().ParentFile().SourceLocations().Len() > 0 {
		// no need to wrap since it includes source info already
		return mt
	}
	if !canWrap(mt.Descriptor()) {
		return mt
	}
	return messageType{mt}
}
