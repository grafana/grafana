package desc

import (
	"bytes"
	"fmt"
	"sort"
	"strconv"
	"unicode"
	"unicode/utf8"

	"github.com/golang/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"

	"github.com/jhump/protoreflect/desc/internal"
)

// Descriptor is the common interface implemented by all descriptor objects.
type Descriptor interface {
	// GetName returns the name of the object described by the descriptor. This will
	// be a base name that does not include enclosing message names or the package name.
	// For file descriptors, this indicates the path and name to the described file.
	GetName() string
	// GetFullyQualifiedName returns the fully-qualified name of the object described by
	// the descriptor. This will include the package name and any enclosing message names.
	// For file descriptors, this returns the path and name to the described file (same as
	// GetName).
	GetFullyQualifiedName() string
	// GetParent returns the enclosing element in a proto source file. If the described
	// object is a top-level object, this returns the file descriptor. Otherwise, it returns
	// the element in which the described object was declared. File descriptors have no
	// parent and return nil.
	GetParent() Descriptor
	// GetFile returns the file descriptor in which this element was declared. File
	// descriptors return themselves.
	GetFile() *FileDescriptor
	// GetOptions returns the options proto containing options for the described element.
	GetOptions() proto.Message
	// GetSourceInfo returns any source code information that was present in the file
	// descriptor. Source code info is optional. If no source code info is available for
	// the element (including if there is none at all in the file descriptor) then this
	// returns nil
	GetSourceInfo() *descriptorpb.SourceCodeInfo_Location
	// AsProto returns the underlying descriptor proto for this descriptor.
	AsProto() proto.Message
}

type sourceInfoRecomputeFunc = internal.SourceInfoComputeFunc

// FileDescriptor describes a proto source file.
type FileDescriptor struct {
	wrapped    protoreflect.FileDescriptor
	proto      *descriptorpb.FileDescriptorProto
	symbols    map[string]Descriptor
	deps       []*FileDescriptor
	publicDeps []*FileDescriptor
	weakDeps   []*FileDescriptor
	messages   []*MessageDescriptor
	enums      []*EnumDescriptor
	extensions []*FieldDescriptor
	services   []*ServiceDescriptor
	fieldIndex map[string]map[int32]*FieldDescriptor
	sourceInfo internal.SourceInfoMap
	sourceInfoRecomputeFunc
}

// Unwrap returns the underlying protoreflect.Descriptor. Most usages will be more
// interested in UnwrapFile, which has a more specific return type. This generic
// version is present to satisfy the DescriptorWrapper interface.
func (fd *FileDescriptor) Unwrap() protoreflect.Descriptor {
	return fd.wrapped
}

// UnwrapFile returns the underlying protoreflect.FileDescriptor.
func (fd *FileDescriptor) UnwrapFile() protoreflect.FileDescriptor {
	return fd.wrapped
}

func (fd *FileDescriptor) recomputeSourceInfo() {
	internal.PopulateSourceInfoMap(fd.proto, fd.sourceInfo)
}

func (fd *FileDescriptor) registerField(field *FieldDescriptor) {
	fields := fd.fieldIndex[field.owner.GetFullyQualifiedName()]
	if fields == nil {
		fields = map[int32]*FieldDescriptor{}
		fd.fieldIndex[field.owner.GetFullyQualifiedName()] = fields
	}
	fields[field.GetNumber()] = field
}

// GetName returns the name of the file, as it was given to the protoc invocation
// to compile it, possibly including path (relative to a directory in the proto
// import path).
func (fd *FileDescriptor) GetName() string {
	return fd.wrapped.Path()
}

// GetFullyQualifiedName returns the name of the file, same as GetName. It is
// present to satisfy the Descriptor interface.
func (fd *FileDescriptor) GetFullyQualifiedName() string {
	return fd.wrapped.Path()
}

// GetPackage returns the name of the package declared in the file.
func (fd *FileDescriptor) GetPackage() string {
	return string(fd.wrapped.Package())
}

// GetParent always returns nil: files are the root of descriptor hierarchies.
// Is it present to satisfy the Descriptor interface.
func (fd *FileDescriptor) GetParent() Descriptor {
	return nil
}

// GetFile returns the receiver, which is a file descriptor. This is present
// to satisfy the Descriptor interface.
func (fd *FileDescriptor) GetFile() *FileDescriptor {
	return fd
}

// GetOptions returns the file's options. Most usages will be more interested
// in GetFileOptions, which has a concrete return type. This generic version
// is present to satisfy the Descriptor interface.
func (fd *FileDescriptor) GetOptions() proto.Message {
	return fd.proto.GetOptions()
}

// GetFileOptions returns the file's options.
func (fd *FileDescriptor) GetFileOptions() *descriptorpb.FileOptions {
	return fd.proto.GetOptions()
}

// GetSourceInfo returns nil for files. It is present to satisfy the Descriptor
// interface.
func (fd *FileDescriptor) GetSourceInfo() *descriptorpb.SourceCodeInfo_Location {
	return nil
}

// AsProto returns the underlying descriptor proto. Most usages will be more
// interested in AsFileDescriptorProto, which has a concrete return type. This
// generic version is present to satisfy the Descriptor interface.
func (fd *FileDescriptor) AsProto() proto.Message {
	return fd.proto
}

// AsFileDescriptorProto returns the underlying descriptor proto.
func (fd *FileDescriptor) AsFileDescriptorProto() *descriptorpb.FileDescriptorProto {
	return fd.proto
}

// String returns the underlying descriptor proto, in compact text format.
func (fd *FileDescriptor) String() string {
	return fd.proto.String()
}

// IsProto3 returns true if the file declares a syntax of "proto3".
//
// When this returns false, the file is either syntax "proto2" (if
// Edition() returns zero) or the file uses editions.
func (fd *FileDescriptor) IsProto3() bool {
	return fd.wrapped.Syntax() == protoreflect.Proto3
}

// Edition returns the edition of the file. If the file does not
// use editions syntax, zero is returned.
func (fd *FileDescriptor) Edition() descriptorpb.Edition {
	if fd.wrapped.Syntax() == protoreflect.Editions {
		return fd.proto.GetEdition()
	}
	return 0
}

// GetDependencies returns all of this file's dependencies. These correspond to
// import statements in the file.
func (fd *FileDescriptor) GetDependencies() []*FileDescriptor {
	return fd.deps
}

// GetPublicDependencies returns all of this file's public dependencies. These
// correspond to public import statements in the file.
func (fd *FileDescriptor) GetPublicDependencies() []*FileDescriptor {
	return fd.publicDeps
}

// GetWeakDependencies returns all of this file's weak dependencies. These
// correspond to weak import statements in the file.
func (fd *FileDescriptor) GetWeakDependencies() []*FileDescriptor {
	return fd.weakDeps
}

// GetMessageTypes returns all top-level messages declared in this file.
func (fd *FileDescriptor) GetMessageTypes() []*MessageDescriptor {
	return fd.messages
}

// GetEnumTypes returns all top-level enums declared in this file.
func (fd *FileDescriptor) GetEnumTypes() []*EnumDescriptor {
	return fd.enums
}

// GetExtensions returns all top-level extensions declared in this file.
func (fd *FileDescriptor) GetExtensions() []*FieldDescriptor {
	return fd.extensions
}

// GetServices returns all services declared in this file.
func (fd *FileDescriptor) GetServices() []*ServiceDescriptor {
	return fd.services
}

// FindSymbol returns the descriptor contained within this file for the
// element with the given fully-qualified symbol name. If no such element
// exists then this method returns nil.
func (fd *FileDescriptor) FindSymbol(symbol string) Descriptor {
	if len(symbol) == 0 {
		return nil
	}
	if symbol[0] == '.' {
		symbol = symbol[1:]
	}
	if ret := fd.symbols[symbol]; ret != nil {
		return ret
	}

	// allow accessing symbols through public imports, too
	for _, dep := range fd.GetPublicDependencies() {
		if ret := dep.FindSymbol(symbol); ret != nil {
			return ret
		}
	}

	// not found
	return nil
}

// FindMessage finds the message with the given fully-qualified name. If no
// such element exists in this file then nil is returned.
func (fd *FileDescriptor) FindMessage(msgName string) *MessageDescriptor {
	if md, ok := fd.symbols[msgName].(*MessageDescriptor); ok {
		return md
	} else {
		return nil
	}
}

// FindEnum finds the enum with the given fully-qualified name. If no such
// element exists in this file then nil is returned.
func (fd *FileDescriptor) FindEnum(enumName string) *EnumDescriptor {
	if ed, ok := fd.symbols[enumName].(*EnumDescriptor); ok {
		return ed
	} else {
		return nil
	}
}

// FindService finds the service with the given fully-qualified name. If no
// such element exists in this file then nil is returned.
func (fd *FileDescriptor) FindService(serviceName string) *ServiceDescriptor {
	if sd, ok := fd.symbols[serviceName].(*ServiceDescriptor); ok {
		return sd
	} else {
		return nil
	}
}

// FindExtension finds the extension field for the given extended type name and
// tag number. If no such element exists in this file then nil is returned.
func (fd *FileDescriptor) FindExtension(extendeeName string, tagNumber int32) *FieldDescriptor {
	if exd, ok := fd.fieldIndex[extendeeName][tagNumber]; ok && exd.IsExtension() {
		return exd
	} else {
		return nil
	}
}

// FindExtensionByName finds the extension field with the given fully-qualified
// name. If no such element exists in this file then nil is returned.
func (fd *FileDescriptor) FindExtensionByName(extName string) *FieldDescriptor {
	if exd, ok := fd.symbols[extName].(*FieldDescriptor); ok && exd.IsExtension() {
		return exd
	} else {
		return nil
	}
}

// MessageDescriptor describes a protocol buffer message.
type MessageDescriptor struct {
	wrapped        protoreflect.MessageDescriptor
	proto          *descriptorpb.DescriptorProto
	parent         Descriptor
	file           *FileDescriptor
	fields         []*FieldDescriptor
	nested         []*MessageDescriptor
	enums          []*EnumDescriptor
	extensions     []*FieldDescriptor
	oneOfs         []*OneOfDescriptor
	extRanges      extRanges
	sourceInfoPath []int32
	jsonNames      jsonNameMap
}

// Unwrap returns the underlying protoreflect.Descriptor. Most usages will be more
// interested in UnwrapMessage, which has a more specific return type. This generic
// version is present to satisfy the DescriptorWrapper interface.
func (md *MessageDescriptor) Unwrap() protoreflect.Descriptor {
	return md.wrapped
}

// UnwrapMessage returns the underlying protoreflect.MessageDescriptor.
func (md *MessageDescriptor) UnwrapMessage() protoreflect.MessageDescriptor {
	return md.wrapped
}

func createMessageDescriptor(fd *FileDescriptor, parent Descriptor, md protoreflect.MessageDescriptor, mdp *descriptorpb.DescriptorProto, symbols map[string]Descriptor, cache descriptorCache, path []int32) *MessageDescriptor {
	ret := &MessageDescriptor{
		wrapped:        md,
		proto:          mdp,
		parent:         parent,
		file:           fd,
		sourceInfoPath: append([]int32(nil), path...), // defensive copy
	}
	cache.put(md, ret)
	path = append(path, internal.Message_nestedMessagesTag)
	for i := 0; i < md.Messages().Len(); i++ {
		src := md.Messages().Get(i)
		srcProto := mdp.GetNestedType()[src.Index()]
		nmd := createMessageDescriptor(fd, ret, src, srcProto, symbols, cache, append(path, int32(i)))
		symbols[string(src.FullName())] = nmd
		ret.nested = append(ret.nested, nmd)
	}
	path[len(path)-1] = internal.Message_enumsTag
	for i := 0; i < md.Enums().Len(); i++ {
		src := md.Enums().Get(i)
		srcProto := mdp.GetEnumType()[src.Index()]
		ed := createEnumDescriptor(fd, ret, src, srcProto, symbols, cache, append(path, int32(i)))
		symbols[string(src.FullName())] = ed
		ret.enums = append(ret.enums, ed)
	}
	path[len(path)-1] = internal.Message_fieldsTag
	for i := 0; i < md.Fields().Len(); i++ {
		src := md.Fields().Get(i)
		srcProto := mdp.GetField()[src.Index()]
		fld := createFieldDescriptor(fd, ret, src, srcProto, cache, append(path, int32(i)))
		symbols[string(src.FullName())] = fld
		ret.fields = append(ret.fields, fld)
	}
	path[len(path)-1] = internal.Message_extensionsTag
	for i := 0; i < md.Extensions().Len(); i++ {
		src := md.Extensions().Get(i)
		srcProto := mdp.GetExtension()[src.Index()]
		exd := createFieldDescriptor(fd, ret, src, srcProto, cache, append(path, int32(i)))
		symbols[string(src.FullName())] = exd
		ret.extensions = append(ret.extensions, exd)
	}
	path[len(path)-1] = internal.Message_oneOfsTag
	for i := 0; i < md.Oneofs().Len(); i++ {
		src := md.Oneofs().Get(i)
		srcProto := mdp.GetOneofDecl()[src.Index()]
		od := createOneOfDescriptor(fd, ret, i, src, srcProto, append(path, int32(i)))
		symbols[string(src.FullName())] = od
		ret.oneOfs = append(ret.oneOfs, od)
	}
	for _, r := range mdp.GetExtensionRange() {
		// proto.ExtensionRange is inclusive (and that's how extension ranges are defined in code).
		// but protoc converts range to exclusive end in descriptor, so we must convert back
		end := r.GetEnd() - 1
		ret.extRanges = append(ret.extRanges, proto.ExtensionRange{
			Start: r.GetStart(),
			End:   end})
	}
	sort.Sort(ret.extRanges)

	return ret
}

func (md *MessageDescriptor) resolve(cache descriptorCache) error {
	for _, nmd := range md.nested {
		if err := nmd.resolve(cache); err != nil {
			return err
		}
	}
	for _, fld := range md.fields {
		if err := fld.resolve(cache); err != nil {
			return err
		}
	}
	for _, exd := range md.extensions {
		if err := exd.resolve(cache); err != nil {
			return err
		}
	}
	return nil
}

// GetName returns the simple (unqualified) name of the message.
func (md *MessageDescriptor) GetName() string {
	return string(md.wrapped.Name())
}

// GetFullyQualifiedName returns the fully qualified name of the message. This
// includes the package name (if there is one) as well as the names of any
// enclosing messages.
func (md *MessageDescriptor) GetFullyQualifiedName() string {
	return string(md.wrapped.FullName())
}

// GetParent returns the message's enclosing descriptor. For top-level messages,
// this will be a file descriptor. Otherwise it will be the descriptor for the
// enclosing message.
func (md *MessageDescriptor) GetParent() Descriptor {
	return md.parent
}

// GetFile returns the descriptor for the file in which this message is defined.
func (md *MessageDescriptor) GetFile() *FileDescriptor {
	return md.file
}

// GetOptions returns the message's options. Most usages will be more interested
// in GetMessageOptions, which has a concrete return type. This generic version
// is present to satisfy the Descriptor interface.
func (md *MessageDescriptor) GetOptions() proto.Message {
	return md.proto.GetOptions()
}

// GetMessageOptions returns the message's options.
func (md *MessageDescriptor) GetMessageOptions() *descriptorpb.MessageOptions {
	return md.proto.GetOptions()
}

// GetSourceInfo returns source info for the message, if present in the
// descriptor. Not all descriptors will contain source info. If non-nil, the
// returned info contains information about the location in the file where the
// message was defined and also contains comments associated with the message
// definition.
func (md *MessageDescriptor) GetSourceInfo() *descriptorpb.SourceCodeInfo_Location {
	return md.file.sourceInfo.Get(md.sourceInfoPath)
}

// AsProto returns the underlying descriptor proto. Most usages will be more
// interested in AsDescriptorProto, which has a concrete return type. This
// generic version is present to satisfy the Descriptor interface.
func (md *MessageDescriptor) AsProto() proto.Message {
	return md.proto
}

// AsDescriptorProto returns the underlying descriptor proto.
func (md *MessageDescriptor) AsDescriptorProto() *descriptorpb.DescriptorProto {
	return md.proto
}

// String returns the underlying descriptor proto, in compact text format.
func (md *MessageDescriptor) String() string {
	return md.proto.String()
}

// IsMapEntry returns true if this is a synthetic message type that represents an entry
// in a map field.
func (md *MessageDescriptor) IsMapEntry() bool {
	return md.wrapped.IsMapEntry()
}

// GetFields returns all of the fields for this message.
func (md *MessageDescriptor) GetFields() []*FieldDescriptor {
	return md.fields
}

// GetNestedMessageTypes returns all of the message types declared inside this message.
func (md *MessageDescriptor) GetNestedMessageTypes() []*MessageDescriptor {
	return md.nested
}

// GetNestedEnumTypes returns all of the enums declared inside this message.
func (md *MessageDescriptor) GetNestedEnumTypes() []*EnumDescriptor {
	return md.enums
}

// GetNestedExtensions returns all of the extensions declared inside this message.
func (md *MessageDescriptor) GetNestedExtensions() []*FieldDescriptor {
	return md.extensions
}

// GetOneOfs returns all of the one-of field sets declared inside this message.
func (md *MessageDescriptor) GetOneOfs() []*OneOfDescriptor {
	return md.oneOfs
}

// IsProto3 returns true if the file in which this message is defined declares a syntax of "proto3".
func (md *MessageDescriptor) IsProto3() bool {
	return md.file.IsProto3()
}

// GetExtensionRanges returns the ranges of extension field numbers for this message.
func (md *MessageDescriptor) GetExtensionRanges() []proto.ExtensionRange {
	return md.extRanges
}

// IsExtendable returns true if this message has any extension ranges.
func (md *MessageDescriptor) IsExtendable() bool {
	return len(md.extRanges) > 0
}

// IsExtension returns true if the given tag number is within any of this message's
// extension ranges.
func (md *MessageDescriptor) IsExtension(tagNumber int32) bool {
	return md.extRanges.IsExtension(tagNumber)
}

type extRanges []proto.ExtensionRange

func (er extRanges) String() string {
	var buf bytes.Buffer
	first := true
	for _, r := range er {
		if first {
			first = false
		} else {
			buf.WriteString(",")
		}
		fmt.Fprintf(&buf, "%d..%d", r.Start, r.End)
	}
	return buf.String()
}

func (er extRanges) IsExtension(tagNumber int32) bool {
	i := sort.Search(len(er), func(i int) bool { return er[i].End >= tagNumber })
	return i < len(er) && tagNumber >= er[i].Start
}

func (er extRanges) Len() int {
	return len(er)
}

func (er extRanges) Less(i, j int) bool {
	return er[i].Start < er[j].Start
}

func (er extRanges) Swap(i, j int) {
	er[i], er[j] = er[j], er[i]
}

// FindFieldByName finds the field with the given name. If no such field exists
// then nil is returned. Only regular fields are returned, not extensions.
func (md *MessageDescriptor) FindFieldByName(fieldName string) *FieldDescriptor {
	fqn := md.GetFullyQualifiedName() + "." + fieldName
	if fd, ok := md.file.symbols[fqn].(*FieldDescriptor); ok && !fd.IsExtension() {
		return fd
	} else {
		return nil
	}
}

// FindFieldByNumber finds the field with the given tag number. If no such field
// exists then nil is returned. Only regular fields are returned, not extensions.
func (md *MessageDescriptor) FindFieldByNumber(tagNumber int32) *FieldDescriptor {
	if fd, ok := md.file.fieldIndex[md.GetFullyQualifiedName()][tagNumber]; ok && !fd.IsExtension() {
		return fd
	} else {
		return nil
	}
}

// FieldDescriptor describes a field of a protocol buffer message.
type FieldDescriptor struct {
	wrapped        protoreflect.FieldDescriptor
	proto          *descriptorpb.FieldDescriptorProto
	parent         Descriptor
	owner          *MessageDescriptor
	file           *FileDescriptor
	oneOf          *OneOfDescriptor
	msgType        *MessageDescriptor
	enumType       *EnumDescriptor
	sourceInfoPath []int32
	def            memoizedDefault
}

// Unwrap returns the underlying protoreflect.Descriptor. Most usages will be more
// interested in UnwrapField, which has a more specific return type. This generic
// version is present to satisfy the DescriptorWrapper interface.
func (fd *FieldDescriptor) Unwrap() protoreflect.Descriptor {
	return fd.wrapped
}

// UnwrapField returns the underlying protoreflect.FieldDescriptor.
func (fd *FieldDescriptor) UnwrapField() protoreflect.FieldDescriptor {
	return fd.wrapped
}

func createFieldDescriptor(fd *FileDescriptor, parent Descriptor, fld protoreflect.FieldDescriptor, fldp *descriptorpb.FieldDescriptorProto, cache descriptorCache, path []int32) *FieldDescriptor {
	ret := &FieldDescriptor{
		wrapped:        fld,
		proto:          fldp,
		parent:         parent,
		file:           fd,
		sourceInfoPath: append([]int32(nil), path...), // defensive copy
	}
	cache.put(fld, ret)
	if !fld.IsExtension() {
		ret.owner = parent.(*MessageDescriptor)
	}
	// owner for extensions, field type (be it message or enum), and one-ofs get resolved later
	return ret
}

func descriptorType(d Descriptor) string {
	switch d := d.(type) {
	case *FileDescriptor:
		return "a file"
	case *MessageDescriptor:
		return "a message"
	case *FieldDescriptor:
		if d.IsExtension() {
			return "an extension"
		}
		return "a field"
	case *OneOfDescriptor:
		return "a oneof"
	case *EnumDescriptor:
		return "an enum"
	case *EnumValueDescriptor:
		return "an enum value"
	case *ServiceDescriptor:
		return "a service"
	case *MethodDescriptor:
		return "a method"
	default:
		return fmt.Sprintf("a %T", d)
	}
}

func (fd *FieldDescriptor) resolve(cache descriptorCache) error {
	if fd.proto.OneofIndex != nil && fd.oneOf == nil {
		return fmt.Errorf("could not link field %s to one-of index %d", fd.GetFullyQualifiedName(), *fd.proto.OneofIndex)
	}
	if fd.proto.GetType() == descriptorpb.FieldDescriptorProto_TYPE_ENUM {
		desc, err := resolve(fd.file, fd.wrapped.Enum(), cache)
		if err != nil {
			return err
		}
		enumType, ok := desc.(*EnumDescriptor)
		if !ok {
			return fmt.Errorf("field %v indicates a type of enum, but references %q which is %s", fd.GetFullyQualifiedName(), fd.proto.GetTypeName(), descriptorType(desc))
		}
		fd.enumType = enumType
	}
	if fd.proto.GetType() == descriptorpb.FieldDescriptorProto_TYPE_MESSAGE || fd.proto.GetType() == descriptorpb.FieldDescriptorProto_TYPE_GROUP {
		desc, err := resolve(fd.file, fd.wrapped.Message(), cache)
		if err != nil {
			return err
		}
		msgType, ok := desc.(*MessageDescriptor)
		if !ok {
			return fmt.Errorf("field %v indicates a type of message, but references %q which is %s", fd.GetFullyQualifiedName(), fd.proto.GetTypeName(), descriptorType(desc))
		}
		fd.msgType = msgType
	}
	if fd.IsExtension() {
		desc, err := resolve(fd.file, fd.wrapped.ContainingMessage(), cache)
		if err != nil {
			return err
		}
		msgType, ok := desc.(*MessageDescriptor)
		if !ok {
			return fmt.Errorf("field %v extends %q which should be a message but is %s", fd.GetFullyQualifiedName(), fd.proto.GetExtendee(), descriptorType(desc))
		}
		fd.owner = msgType
	}
	fd.file.registerField(fd)
	return nil
}

func (fd *FieldDescriptor) determineDefault() interface{} {
	if fd.IsMap() {
		return map[interface{}]interface{}(nil)
	} else if fd.IsRepeated() {
		return []interface{}(nil)
	} else if fd.msgType != nil {
		return nil
	}

	proto3 := fd.file.IsProto3()
	if !proto3 {
		def := fd.AsFieldDescriptorProto().GetDefaultValue()
		if def != "" {
			ret := parseDefaultValue(fd, def)
			if ret != nil {
				return ret
			}
			// if we can't parse default value, fall-through to return normal default...
		}
	}

	switch fd.GetType() {
	case descriptorpb.FieldDescriptorProto_TYPE_FIXED32,
		descriptorpb.FieldDescriptorProto_TYPE_UINT32:
		return uint32(0)
	case descriptorpb.FieldDescriptorProto_TYPE_SFIXED32,
		descriptorpb.FieldDescriptorProto_TYPE_INT32,
		descriptorpb.FieldDescriptorProto_TYPE_SINT32:
		return int32(0)
	case descriptorpb.FieldDescriptorProto_TYPE_FIXED64,
		descriptorpb.FieldDescriptorProto_TYPE_UINT64:
		return uint64(0)
	case descriptorpb.FieldDescriptorProto_TYPE_SFIXED64,
		descriptorpb.FieldDescriptorProto_TYPE_INT64,
		descriptorpb.FieldDescriptorProto_TYPE_SINT64:
		return int64(0)
	case descriptorpb.FieldDescriptorProto_TYPE_FLOAT:
		return float32(0.0)
	case descriptorpb.FieldDescriptorProto_TYPE_DOUBLE:
		return float64(0.0)
	case descriptorpb.FieldDescriptorProto_TYPE_BOOL:
		return false
	case descriptorpb.FieldDescriptorProto_TYPE_BYTES:
		return []byte(nil)
	case descriptorpb.FieldDescriptorProto_TYPE_STRING:
		return ""
	case descriptorpb.FieldDescriptorProto_TYPE_ENUM:
		if proto3 {
			return int32(0)
		}
		enumVals := fd.GetEnumType().GetValues()
		if len(enumVals) > 0 {
			return enumVals[0].GetNumber()
		} else {
			return int32(0) // WTF?
		}
	default:
		panic(fmt.Sprintf("Unknown field type: %v", fd.GetType()))
	}
}

func parseDefaultValue(fd *FieldDescriptor, val string) interface{} {
	switch fd.GetType() {
	case descriptorpb.FieldDescriptorProto_TYPE_ENUM:
		vd := fd.GetEnumType().FindValueByName(val)
		if vd != nil {
			return vd.GetNumber()
		}
		return nil
	case descriptorpb.FieldDescriptorProto_TYPE_BOOL:
		if val == "true" {
			return true
		} else if val == "false" {
			return false
		}
		return nil
	case descriptorpb.FieldDescriptorProto_TYPE_BYTES:
		return []byte(unescape(val))
	case descriptorpb.FieldDescriptorProto_TYPE_STRING:
		return val
	case descriptorpb.FieldDescriptorProto_TYPE_FLOAT:
		if f, err := strconv.ParseFloat(val, 32); err == nil {
			return float32(f)
		} else {
			return float32(0)
		}
	case descriptorpb.FieldDescriptorProto_TYPE_DOUBLE:
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		} else {
			return float64(0)
		}
	case descriptorpb.FieldDescriptorProto_TYPE_INT32,
		descriptorpb.FieldDescriptorProto_TYPE_SINT32,
		descriptorpb.FieldDescriptorProto_TYPE_SFIXED32:
		if i, err := strconv.ParseInt(val, 10, 32); err == nil {
			return int32(i)
		} else {
			return int32(0)
		}
	case descriptorpb.FieldDescriptorProto_TYPE_UINT32,
		descriptorpb.FieldDescriptorProto_TYPE_FIXED32:
		if i, err := strconv.ParseUint(val, 10, 32); err == nil {
			return uint32(i)
		} else {
			return uint32(0)
		}
	case descriptorpb.FieldDescriptorProto_TYPE_INT64,
		descriptorpb.FieldDescriptorProto_TYPE_SINT64,
		descriptorpb.FieldDescriptorProto_TYPE_SFIXED64:
		if i, err := strconv.ParseInt(val, 10, 64); err == nil {
			return i
		} else {
			return int64(0)
		}
	case descriptorpb.FieldDescriptorProto_TYPE_UINT64,
		descriptorpb.FieldDescriptorProto_TYPE_FIXED64:
		if i, err := strconv.ParseUint(val, 10, 64); err == nil {
			return i
		} else {
			return uint64(0)
		}
	default:
		return nil
	}
}

func unescape(s string) string {
	// protoc encodes default values for 'bytes' fields using C escaping,
	// so this function reverses that escaping
	out := make([]byte, 0, len(s))
	var buf [4]byte
	for len(s) > 0 {
		if s[0] != '\\' || len(s) < 2 {
			// not escape sequence, or too short to be well-formed escape
			out = append(out, s[0])
			s = s[1:]
		} else if s[1] == 'x' || s[1] == 'X' {
			n := matchPrefix(s[2:], 2, isHex)
			if n == 0 {
				// bad escape
				out = append(out, s[:2]...)
				s = s[2:]
			} else {
				c, err := strconv.ParseUint(s[2:2+n], 16, 8)
				if err != nil {
					// shouldn't really happen...
					out = append(out, s[:2+n]...)
				} else {
					out = append(out, byte(c))
				}
				s = s[2+n:]
			}
		} else if s[1] >= '0' && s[1] <= '7' {
			n := 1 + matchPrefix(s[2:], 2, isOctal)
			c, err := strconv.ParseUint(s[1:1+n], 8, 8)
			if err != nil || c > 0xff {
				out = append(out, s[:1+n]...)
			} else {
				out = append(out, byte(c))
			}
			s = s[1+n:]
		} else if s[1] == 'u' {
			if len(s) < 6 {
				// bad escape
				out = append(out, s...)
				s = s[len(s):]
			} else {
				c, err := strconv.ParseUint(s[2:6], 16, 16)
				if err != nil {
					// bad escape
					out = append(out, s[:6]...)
				} else {
					w := utf8.EncodeRune(buf[:], rune(c))
					out = append(out, buf[:w]...)
				}
				s = s[6:]
			}
		} else if s[1] == 'U' {
			if len(s) < 10 {
				// bad escape
				out = append(out, s...)
				s = s[len(s):]
			} else {
				c, err := strconv.ParseUint(s[2:10], 16, 32)
				if err != nil || c > 0x10ffff {
					// bad escape
					out = append(out, s[:10]...)
				} else {
					w := utf8.EncodeRune(buf[:], rune(c))
					out = append(out, buf[:w]...)
				}
				s = s[10:]
			}
		} else {
			switch s[1] {
			case 'a':
				out = append(out, '\a')
			case 'b':
				out = append(out, '\b')
			case 'f':
				out = append(out, '\f')
			case 'n':
				out = append(out, '\n')
			case 'r':
				out = append(out, '\r')
			case 't':
				out = append(out, '\t')
			case 'v':
				out = append(out, '\v')
			case '\\':
				out = append(out, '\\')
			case '\'':
				out = append(out, '\'')
			case '"':
				out = append(out, '"')
			case '?':
				out = append(out, '?')
			default:
				// invalid escape, just copy it as-is
				out = append(out, s[:2]...)
			}
			s = s[2:]
		}
	}
	return string(out)
}

func isOctal(b byte) bool { return b >= '0' && b <= '7' }
func isHex(b byte) bool {
	return (b >= '0' && b <= '9') || (b >= 'a' && b <= 'f') || (b >= 'A' && b <= 'F')
}
func matchPrefix(s string, limit int, fn func(byte) bool) int {
	l := len(s)
	if l > limit {
		l = limit
	}
	i := 0
	for ; i < l; i++ {
		if !fn(s[i]) {
			return i
		}
	}
	return i
}

// GetName returns the name of the field.
func (fd *FieldDescriptor) GetName() string {
	return string(fd.wrapped.Name())
}

// GetNumber returns the tag number of this field.
func (fd *FieldDescriptor) GetNumber() int32 {
	return int32(fd.wrapped.Number())
}

// GetFullyQualifiedName returns the fully qualified name of the field. Unlike
// GetName, this includes fully qualified name of the enclosing message for
// regular fields.
//
// For extension fields, this includes the package (if there is one) as well as
// any enclosing messages. The package and/or enclosing messages are for where
// the extension is defined, not the message it extends.
//
// If this field is part of a one-of, the fully qualified name does *not*
// include the name of the one-of, only of the enclosing message.
func (fd *FieldDescriptor) GetFullyQualifiedName() string {
	return string(fd.wrapped.FullName())
}

// GetParent returns the fields's enclosing descriptor. For normal
// (non-extension) fields, this is the enclosing message. For extensions, this
// is the descriptor in which the extension is defined, not the message that is
// extended. The parent for an extension may be a file descriptor or a message,
// depending on where the extension is defined.
func (fd *FieldDescriptor) GetParent() Descriptor {
	return fd.parent
}

// GetFile returns the descriptor for the file in which this field is defined.
func (fd *FieldDescriptor) GetFile() *FileDescriptor {
	return fd.file
}

// GetOptions returns the field's options. Most usages will be more interested
// in GetFieldOptions, which has a concrete return type. This generic version
// is present to satisfy the Descriptor interface.
func (fd *FieldDescriptor) GetOptions() proto.Message {
	return fd.proto.GetOptions()
}

// GetFieldOptions returns the field's options.
func (fd *FieldDescriptor) GetFieldOptions() *descriptorpb.FieldOptions {
	return fd.proto.GetOptions()
}

// GetSourceInfo returns source info for the field, if present in the
// descriptor. Not all descriptors will contain source info. If non-nil, the
// returned info contains information about the location in the file where the
// field was defined and also contains comments associated with the field
// definition.
func (fd *FieldDescriptor) GetSourceInfo() *descriptorpb.SourceCodeInfo_Location {
	return fd.file.sourceInfo.Get(fd.sourceInfoPath)
}

// AsProto returns the underlying descriptor proto. Most usages will be more
// interested in AsFieldDescriptorProto, which has a concrete return type. This
// generic version is present to satisfy the Descriptor interface.
func (fd *FieldDescriptor) AsProto() proto.Message {
	return fd.proto
}

// AsFieldDescriptorProto returns the underlying descriptor proto.
func (fd *FieldDescriptor) AsFieldDescriptorProto() *descriptorpb.FieldDescriptorProto {
	return fd.proto
}

// String returns the underlying descriptor proto, in compact text format.
func (fd *FieldDescriptor) String() string {
	return fd.proto.String()
}

// GetJSONName returns the name of the field as referenced in the message's JSON
// format.
func (fd *FieldDescriptor) GetJSONName() string {
	if jsonName := fd.proto.JsonName; jsonName != nil {
		// if json name is present, use its value
		return *jsonName
	}
	// otherwise, compute the proper JSON name from the field name
	return jsonCamelCase(fd.proto.GetName())
}

func jsonCamelCase(s string) string {
	// This mirrors the implementation in protoc/C++ runtime and in the Java runtime:
	//   https://github.com/protocolbuffers/protobuf/blob/a104dffcb6b1958a424f5fa6f9e6bdc0ab9b6f9e/src/google/protobuf/descriptor.cc#L276
	//   https://github.com/protocolbuffers/protobuf/blob/a1c886834425abb64a966231dd2c9dd84fb289b3/java/core/src/main/java/com/google/protobuf/Descriptors.java#L1286
	var buf bytes.Buffer
	prevWasUnderscore := false
	for _, r := range s {
		if r == '_' {
			prevWasUnderscore = true
			continue
		}
		if prevWasUnderscore {
			r = unicode.ToUpper(r)
			prevWasUnderscore = false
		}
		buf.WriteRune(r)
	}
	return buf.String()
}

// GetFullyQualifiedJSONName returns the JSON format name (same as GetJSONName),
// but includes the fully qualified name of the enclosing message.
//
// If the field is an extension, it will return the package name (if there is
// one) as well as the names of any enclosing messages. The package and/or
// enclosing messages are for where the extension is defined, not the message it
// extends.
func (fd *FieldDescriptor) GetFullyQualifiedJSONName() string {
	parent := fd.GetParent()
	switch parent := parent.(type) {
	case *FileDescriptor:
		pkg := parent.GetPackage()
		if pkg == "" {
			return fd.GetJSONName()
		}
		return fmt.Sprintf("%s.%s", pkg, fd.GetJSONName())
	default:
		return fmt.Sprintf("%s.%s", parent.GetFullyQualifiedName(), fd.GetJSONName())
	}
}

// GetOwner returns the message type that this field belongs to. If this is a normal
// field then this is the same as GetParent. But for extensions, this will be the
// extendee message whereas GetParent refers to where the extension was declared.
func (fd *FieldDescriptor) GetOwner() *MessageDescriptor {
	return fd.owner
}

// IsExtension returns true if this is an extension field.
func (fd *FieldDescriptor) IsExtension() bool {
	return fd.wrapped.IsExtension()
}

// GetOneOf returns the one-of field set to which this field belongs. If this field
// is not part of a one-of then this method returns nil.
func (fd *FieldDescriptor) GetOneOf() *OneOfDescriptor {
	return fd.oneOf
}

// GetType returns the type of this field. If the type indicates an enum, the
// enum type can be queried via GetEnumType. If the type indicates a message, the
// message type can be queried via GetMessageType.
func (fd *FieldDescriptor) GetType() descriptorpb.FieldDescriptorProto_Type {
	return fd.proto.GetType()
}

// GetLabel returns the label for this field. The label can be required (proto2-only),
// optional (default for proto3), or required.
func (fd *FieldDescriptor) GetLabel() descriptorpb.FieldDescriptorProto_Label {
	return fd.proto.GetLabel()
}

// IsRequired returns true if this field has the "required" label.
func (fd *FieldDescriptor) IsRequired() bool {
	return fd.wrapped.Cardinality() == protoreflect.Required
}

// IsRepeated returns true if this field has the "repeated" label.
func (fd *FieldDescriptor) IsRepeated() bool {
	return fd.wrapped.Cardinality() == protoreflect.Repeated
}

// IsProto3Optional returns true if this field has an explicit "optional" label
// and is in a "proto3" syntax file. Such fields, if they are normal fields (not
// extensions), will be nested in synthetic oneofs that contain only the single
// field.
func (fd *FieldDescriptor) IsProto3Optional() bool {
	return fd.proto.GetProto3Optional()
}

// HasPresence returns true if this field can distinguish when a value is
// present or not. Scalar fields in "proto3" syntax files, for example, return
// false since absent values are indistinguishable from zero values.
func (fd *FieldDescriptor) HasPresence() bool {
	return fd.wrapped.HasPresence()
}

// IsMap returns true if this is a map field. If so, it will have the "repeated"
// label its type will be a message that represents a map entry. The map entry
// message will have exactly two fields: tag #1 is the key and tag #2 is the value.
func (fd *FieldDescriptor) IsMap() bool {
	return fd.wrapped.IsMap()
}

// GetMapKeyType returns the type of the key field if this is a map field. If it is
// not a map field, nil is returned.
func (fd *FieldDescriptor) GetMapKeyType() *FieldDescriptor {
	if fd.IsMap() {
		return fd.msgType.FindFieldByNumber(int32(1))
	}
	return nil
}

// GetMapValueType returns the type of the value field if this is a map field. If it
// is not a map field, nil is returned.
func (fd *FieldDescriptor) GetMapValueType() *FieldDescriptor {
	if fd.IsMap() {
		return fd.msgType.FindFieldByNumber(int32(2))
	}
	return nil
}

// GetMessageType returns the type of this field if it is a message type. If
// this field is not a message type, it returns nil.
func (fd *FieldDescriptor) GetMessageType() *MessageDescriptor {
	return fd.msgType
}

// GetEnumType returns the type of this field if it is an enum type. If this
// field is not an enum type, it returns nil.
func (fd *FieldDescriptor) GetEnumType() *EnumDescriptor {
	return fd.enumType
}

// GetDefaultValue returns the default value for this field.
//
// If this field represents a message type, this method always returns nil (even though
// for proto2 files, the default value should be a default instance of the message type).
// If the field represents an enum type, this method returns an int32 corresponding to the
// enum value. If this field is a map, it returns a nil map[interface{}]interface{}. If
// this field is repeated (and not a map), it returns a nil []interface{}.
//
// Otherwise, it returns the declared default value for the field or a zero value, if no
// default is declared or if the file is proto3. The type of said return value corresponds
// to the type of the field:
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
func (fd *FieldDescriptor) GetDefaultValue() interface{} {
	return fd.getDefaultValue()
}

// EnumDescriptor describes an enum declared in a proto file.
type EnumDescriptor struct {
	wrapped        protoreflect.EnumDescriptor
	proto          *descriptorpb.EnumDescriptorProto
	parent         Descriptor
	file           *FileDescriptor
	values         []*EnumValueDescriptor
	valuesByNum    sortedValues
	sourceInfoPath []int32
}

// Unwrap returns the underlying protoreflect.Descriptor. Most usages will be more
// interested in UnwrapEnum, which has a more specific return type. This generic
// version is present to satisfy the DescriptorWrapper interface.
func (ed *EnumDescriptor) Unwrap() protoreflect.Descriptor {
	return ed.wrapped
}

// UnwrapEnum returns the underlying protoreflect.EnumDescriptor.
func (ed *EnumDescriptor) UnwrapEnum() protoreflect.EnumDescriptor {
	return ed.wrapped
}

func createEnumDescriptor(fd *FileDescriptor, parent Descriptor, ed protoreflect.EnumDescriptor, edp *descriptorpb.EnumDescriptorProto, symbols map[string]Descriptor, cache descriptorCache, path []int32) *EnumDescriptor {
	ret := &EnumDescriptor{
		wrapped:        ed,
		proto:          edp,
		parent:         parent,
		file:           fd,
		sourceInfoPath: append([]int32(nil), path...), // defensive copy
	}
	path = append(path, internal.Enum_valuesTag)
	for i := 0; i < ed.Values().Len(); i++ {
		src := ed.Values().Get(i)
		srcProto := edp.GetValue()[src.Index()]
		evd := createEnumValueDescriptor(fd, ret, src, srcProto, append(path, int32(i)))
		symbols[string(src.FullName())] = evd
		// NB: for backwards compatibility, also register the enum value as if
		// scoped within the enum (counter-intuitively, enum value full names are
		// scoped in the enum's parent element). EnumValueDescripto.GetFullyQualifiedName
		// returns that alternate full name.
		symbols[evd.GetFullyQualifiedName()] = evd
		ret.values = append(ret.values, evd)
	}
	if len(ret.values) > 0 {
		ret.valuesByNum = make(sortedValues, len(ret.values))
		copy(ret.valuesByNum, ret.values)
		sort.Stable(ret.valuesByNum)
	}
	return ret
}

type sortedValues []*EnumValueDescriptor

func (sv sortedValues) Len() int {
	return len(sv)
}

func (sv sortedValues) Less(i, j int) bool {
	return sv[i].GetNumber() < sv[j].GetNumber()
}

func (sv sortedValues) Swap(i, j int) {
	sv[i], sv[j] = sv[j], sv[i]

}

// GetName returns the simple (unqualified) name of the enum type.
func (ed *EnumDescriptor) GetName() string {
	return string(ed.wrapped.Name())
}

// GetFullyQualifiedName returns the fully qualified name of the enum type.
// This includes the package name (if there is one) as well as the names of any
// enclosing messages.
func (ed *EnumDescriptor) GetFullyQualifiedName() string {
	return string(ed.wrapped.FullName())
}

// GetParent returns the enum type's enclosing descriptor. For top-level enums,
// this will be a file descriptor. Otherwise it will be the descriptor for the
// enclosing message.
func (ed *EnumDescriptor) GetParent() Descriptor {
	return ed.parent
}

// GetFile returns the descriptor for the file in which this enum is defined.
func (ed *EnumDescriptor) GetFile() *FileDescriptor {
	return ed.file
}

// GetOptions returns the enum type's options. Most usages will be more
// interested in GetEnumOptions, which has a concrete return type. This generic
// version is present to satisfy the Descriptor interface.
func (ed *EnumDescriptor) GetOptions() proto.Message {
	return ed.proto.GetOptions()
}

// GetEnumOptions returns the enum type's options.
func (ed *EnumDescriptor) GetEnumOptions() *descriptorpb.EnumOptions {
	return ed.proto.GetOptions()
}

// GetSourceInfo returns source info for the enum type, if present in the
// descriptor. Not all descriptors will contain source info. If non-nil, the
// returned info contains information about the location in the file where the
// enum type was defined and also contains comments associated with the enum
// definition.
func (ed *EnumDescriptor) GetSourceInfo() *descriptorpb.SourceCodeInfo_Location {
	return ed.file.sourceInfo.Get(ed.sourceInfoPath)
}

// AsProto returns the underlying descriptor proto. Most usages will be more
// interested in AsEnumDescriptorProto, which has a concrete return type. This
// generic version is present to satisfy the Descriptor interface.
func (ed *EnumDescriptor) AsProto() proto.Message {
	return ed.proto
}

// AsEnumDescriptorProto returns the underlying descriptor proto.
func (ed *EnumDescriptor) AsEnumDescriptorProto() *descriptorpb.EnumDescriptorProto {
	return ed.proto
}

// String returns the underlying descriptor proto, in compact text format.
func (ed *EnumDescriptor) String() string {
	return ed.proto.String()
}

// GetValues returns all of the allowed values defined for this enum.
func (ed *EnumDescriptor) GetValues() []*EnumValueDescriptor {
	return ed.values
}

// FindValueByName finds the enum value with the given name. If no such value exists
// then nil is returned.
func (ed *EnumDescriptor) FindValueByName(name string) *EnumValueDescriptor {
	fqn := fmt.Sprintf("%s.%s", ed.GetFullyQualifiedName(), name)
	if vd, ok := ed.file.symbols[fqn].(*EnumValueDescriptor); ok {
		return vd
	} else {
		return nil
	}
}

// FindValueByNumber finds the value with the given numeric value. If no such value
// exists then nil is returned. If aliases are allowed and multiple values have the
// given number, the first declared value is returned.
func (ed *EnumDescriptor) FindValueByNumber(num int32) *EnumValueDescriptor {
	index := sort.Search(len(ed.valuesByNum), func(i int) bool { return ed.valuesByNum[i].GetNumber() >= num })
	if index < len(ed.valuesByNum) {
		vd := ed.valuesByNum[index]
		if vd.GetNumber() == num {
			return vd
		}
	}
	return nil
}

// EnumValueDescriptor describes an allowed value of an enum declared in a proto file.
type EnumValueDescriptor struct {
	wrapped        protoreflect.EnumValueDescriptor
	proto          *descriptorpb.EnumValueDescriptorProto
	parent         *EnumDescriptor
	file           *FileDescriptor
	sourceInfoPath []int32
}

// Unwrap returns the underlying protoreflect.Descriptor. Most usages will be more
// interested in UnwrapEnumValue, which has a more specific return type. This generic
// version is present to satisfy the DescriptorWrapper interface.
func (vd *EnumValueDescriptor) Unwrap() protoreflect.Descriptor {
	return vd.wrapped
}

// UnwrapEnumValue returns the underlying protoreflect.EnumValueDescriptor.
func (vd *EnumValueDescriptor) UnwrapEnumValue() protoreflect.EnumValueDescriptor {
	return vd.wrapped
}

func createEnumValueDescriptor(fd *FileDescriptor, parent *EnumDescriptor, evd protoreflect.EnumValueDescriptor, evdp *descriptorpb.EnumValueDescriptorProto, path []int32) *EnumValueDescriptor {
	return &EnumValueDescriptor{
		wrapped:        evd,
		proto:          evdp,
		parent:         parent,
		file:           fd,
		sourceInfoPath: append([]int32(nil), path...), // defensive copy
	}
}

func (vd *EnumValueDescriptor) resolve(path []int32) {
	vd.sourceInfoPath = append([]int32(nil), path...) // defensive copy
}

// GetName returns the name of the enum value.
func (vd *EnumValueDescriptor) GetName() string {
	return string(vd.wrapped.Name())
}

// GetNumber returns the numeric value associated with this enum value.
func (vd *EnumValueDescriptor) GetNumber() int32 {
	return int32(vd.wrapped.Number())
}

// GetFullyQualifiedName returns the fully qualified name of the enum value.
// Unlike GetName, this includes fully qualified name of the enclosing enum.
func (vd *EnumValueDescriptor) GetFullyQualifiedName() string {
	// NB: Technically, we do not return the correct value. Enum values are
	// scoped within the enclosing element, not within the enum itself (which
	// is very non-intuitive, but it follows C++ scoping rules). The value
	// returned from vd.wrapped.FullName() is correct. However, we return
	// something different, just for backwards compatibility, as this package
	// has always instead returned the name scoped inside the enum.
	return fmt.Sprintf("%s.%s", vd.parent.GetFullyQualifiedName(), vd.wrapped.Name())
}

// GetParent returns the descriptor for the enum in which this enum value is
// defined. Most usages will prefer to use GetEnum, which has a concrete return
// type. This more generic method is present to satisfy the Descriptor interface.
func (vd *EnumValueDescriptor) GetParent() Descriptor {
	return vd.parent
}

// GetEnum returns the enum in which this enum value is defined.
func (vd *EnumValueDescriptor) GetEnum() *EnumDescriptor {
	return vd.parent
}

// GetFile returns the descriptor for the file in which this enum value is
// defined.
func (vd *EnumValueDescriptor) GetFile() *FileDescriptor {
	return vd.file
}

// GetOptions returns the enum value's options. Most usages will be more
// interested in GetEnumValueOptions, which has a concrete return type. This
// generic version is present to satisfy the Descriptor interface.
func (vd *EnumValueDescriptor) GetOptions() proto.Message {
	return vd.proto.GetOptions()
}

// GetEnumValueOptions returns the enum value's options.
func (vd *EnumValueDescriptor) GetEnumValueOptions() *descriptorpb.EnumValueOptions {
	return vd.proto.GetOptions()
}

// GetSourceInfo returns source info for the enum value, if present in the
// descriptor. Not all descriptors will contain source info. If non-nil, the
// returned info contains information about the location in the file where the
// enum value was defined and also contains comments associated with the enum
// value definition.
func (vd *EnumValueDescriptor) GetSourceInfo() *descriptorpb.SourceCodeInfo_Location {
	return vd.file.sourceInfo.Get(vd.sourceInfoPath)
}

// AsProto returns the underlying descriptor proto. Most usages will be more
// interested in AsEnumValueDescriptorProto, which has a concrete return type.
// This generic version is present to satisfy the Descriptor interface.
func (vd *EnumValueDescriptor) AsProto() proto.Message {
	return vd.proto
}

// AsEnumValueDescriptorProto returns the underlying descriptor proto.
func (vd *EnumValueDescriptor) AsEnumValueDescriptorProto() *descriptorpb.EnumValueDescriptorProto {
	return vd.proto
}

// String returns the underlying descriptor proto, in compact text format.
func (vd *EnumValueDescriptor) String() string {
	return vd.proto.String()
}

// ServiceDescriptor describes an RPC service declared in a proto file.
type ServiceDescriptor struct {
	wrapped        protoreflect.ServiceDescriptor
	proto          *descriptorpb.ServiceDescriptorProto
	file           *FileDescriptor
	methods        []*MethodDescriptor
	sourceInfoPath []int32
}

// Unwrap returns the underlying protoreflect.Descriptor. Most usages will be more
// interested in UnwrapService, which has a more specific return type. This generic
// version is present to satisfy the DescriptorWrapper interface.
func (sd *ServiceDescriptor) Unwrap() protoreflect.Descriptor {
	return sd.wrapped
}

// UnwrapService returns the underlying protoreflect.ServiceDescriptor.
func (sd *ServiceDescriptor) UnwrapService() protoreflect.ServiceDescriptor {
	return sd.wrapped
}

func createServiceDescriptor(fd *FileDescriptor, sd protoreflect.ServiceDescriptor, sdp *descriptorpb.ServiceDescriptorProto, symbols map[string]Descriptor, path []int32) *ServiceDescriptor {
	ret := &ServiceDescriptor{
		wrapped:        sd,
		proto:          sdp,
		file:           fd,
		sourceInfoPath: append([]int32(nil), path...), // defensive copy
	}
	path = append(path, internal.Service_methodsTag)
	for i := 0; i < sd.Methods().Len(); i++ {
		src := sd.Methods().Get(i)
		srcProto := sdp.GetMethod()[src.Index()]
		md := createMethodDescriptor(fd, ret, src, srcProto, append(path, int32(i)))
		symbols[string(src.FullName())] = md
		ret.methods = append(ret.methods, md)
	}
	return ret
}

func (sd *ServiceDescriptor) resolve(cache descriptorCache) error {
	for _, md := range sd.methods {
		if err := md.resolve(cache); err != nil {
			return err
		}
	}
	return nil
}

// GetName returns the simple (unqualified) name of the service.
func (sd *ServiceDescriptor) GetName() string {
	return string(sd.wrapped.Name())
}

// GetFullyQualifiedName returns the fully qualified name of the service. This
// includes the package name (if there is one).
func (sd *ServiceDescriptor) GetFullyQualifiedName() string {
	return string(sd.wrapped.FullName())
}

// GetParent returns the descriptor for the file in which this service is
// defined. Most usages will prefer to use GetFile, which has a concrete return
// type. This more generic method is present to satisfy the Descriptor interface.
func (sd *ServiceDescriptor) GetParent() Descriptor {
	return sd.file
}

// GetFile returns the descriptor for the file in which this service is defined.
func (sd *ServiceDescriptor) GetFile() *FileDescriptor {
	return sd.file
}

// GetOptions returns the service's options. Most usages will be more interested
// in GetServiceOptions, which has a concrete return type. This generic version
// is present to satisfy the Descriptor interface.
func (sd *ServiceDescriptor) GetOptions() proto.Message {
	return sd.proto.GetOptions()
}

// GetServiceOptions returns the service's options.
func (sd *ServiceDescriptor) GetServiceOptions() *descriptorpb.ServiceOptions {
	return sd.proto.GetOptions()
}

// GetSourceInfo returns source info for the service, if present in the
// descriptor. Not all descriptors will contain source info. If non-nil, the
// returned info contains information about the location in the file where the
// service was defined and also contains comments associated with the service
// definition.
func (sd *ServiceDescriptor) GetSourceInfo() *descriptorpb.SourceCodeInfo_Location {
	return sd.file.sourceInfo.Get(sd.sourceInfoPath)
}

// AsProto returns the underlying descriptor proto. Most usages will be more
// interested in AsServiceDescriptorProto, which has a concrete return type.
// This generic version is present to satisfy the Descriptor interface.
func (sd *ServiceDescriptor) AsProto() proto.Message {
	return sd.proto
}

// AsServiceDescriptorProto returns the underlying descriptor proto.
func (sd *ServiceDescriptor) AsServiceDescriptorProto() *descriptorpb.ServiceDescriptorProto {
	return sd.proto
}

// String returns the underlying descriptor proto, in compact text format.
func (sd *ServiceDescriptor) String() string {
	return sd.proto.String()
}

// GetMethods returns all of the RPC methods for this service.
func (sd *ServiceDescriptor) GetMethods() []*MethodDescriptor {
	return sd.methods
}

// FindMethodByName finds the method with the given name. If no such method exists
// then nil is returned.
func (sd *ServiceDescriptor) FindMethodByName(name string) *MethodDescriptor {
	fqn := fmt.Sprintf("%s.%s", sd.GetFullyQualifiedName(), name)
	if md, ok := sd.file.symbols[fqn].(*MethodDescriptor); ok {
		return md
	} else {
		return nil
	}
}

// MethodDescriptor describes an RPC method declared in a proto file.
type MethodDescriptor struct {
	wrapped        protoreflect.MethodDescriptor
	proto          *descriptorpb.MethodDescriptorProto
	parent         *ServiceDescriptor
	file           *FileDescriptor
	inType         *MessageDescriptor
	outType        *MessageDescriptor
	sourceInfoPath []int32
}

// Unwrap returns the underlying protoreflect.Descriptor. Most usages will be more
// interested in UnwrapMethod, which has a more specific return type. This generic
// version is present to satisfy the DescriptorWrapper interface.
func (md *MethodDescriptor) Unwrap() protoreflect.Descriptor {
	return md.wrapped
}

// UnwrapMethod returns the underlying protoreflect.MethodDescriptor.
func (md *MethodDescriptor) UnwrapMethod() protoreflect.MethodDescriptor {
	return md.wrapped
}

func createMethodDescriptor(fd *FileDescriptor, parent *ServiceDescriptor, md protoreflect.MethodDescriptor, mdp *descriptorpb.MethodDescriptorProto, path []int32) *MethodDescriptor {
	// request and response types get resolved later
	return &MethodDescriptor{
		wrapped:        md,
		proto:          mdp,
		parent:         parent,
		file:           fd,
		sourceInfoPath: append([]int32(nil), path...), // defensive copy
	}
}

func (md *MethodDescriptor) resolve(cache descriptorCache) error {
	if desc, err := resolve(md.file, md.wrapped.Input(), cache); err != nil {
		return err
	} else {
		msgType, ok := desc.(*MessageDescriptor)
		if !ok {
			return fmt.Errorf("method %v has request type %q which should be a message but is %s", md.GetFullyQualifiedName(), md.proto.GetInputType(), descriptorType(desc))
		}
		md.inType = msgType
	}
	if desc, err := resolve(md.file, md.wrapped.Output(), cache); err != nil {
		return err
	} else {
		msgType, ok := desc.(*MessageDescriptor)
		if !ok {
			return fmt.Errorf("method %v has response type %q which should be a message but is %s", md.GetFullyQualifiedName(), md.proto.GetOutputType(), descriptorType(desc))
		}
		md.outType = msgType
	}
	return nil
}

// GetName returns the name of the method.
func (md *MethodDescriptor) GetName() string {
	return string(md.wrapped.Name())
}

// GetFullyQualifiedName returns the fully qualified name of the method. Unlike
// GetName, this includes fully qualified name of the enclosing service.
func (md *MethodDescriptor) GetFullyQualifiedName() string {
	return string(md.wrapped.FullName())
}

// GetParent returns the descriptor for the service in which this method is
// defined. Most usages will prefer to use GetService, which has a concrete
// return type. This more generic method is present to satisfy the Descriptor
// interface.
func (md *MethodDescriptor) GetParent() Descriptor {
	return md.parent
}

// GetService returns the RPC service in which this method is declared.
func (md *MethodDescriptor) GetService() *ServiceDescriptor {
	return md.parent
}

// GetFile returns the descriptor for the file in which this method is defined.
func (md *MethodDescriptor) GetFile() *FileDescriptor {
	return md.file
}

// GetOptions returns the method's options. Most usages will be more interested
// in GetMethodOptions, which has a concrete return type. This generic version
// is present to satisfy the Descriptor interface.
func (md *MethodDescriptor) GetOptions() proto.Message {
	return md.proto.GetOptions()
}

// GetMethodOptions returns the method's options.
func (md *MethodDescriptor) GetMethodOptions() *descriptorpb.MethodOptions {
	return md.proto.GetOptions()
}

// GetSourceInfo returns source info for the method, if present in the
// descriptor. Not all descriptors will contain source info. If non-nil, the
// returned info contains information about the location in the file where the
// method was defined and also contains comments associated with the method
// definition.
func (md *MethodDescriptor) GetSourceInfo() *descriptorpb.SourceCodeInfo_Location {
	return md.file.sourceInfo.Get(md.sourceInfoPath)
}

// AsProto returns the underlying descriptor proto. Most usages will be more
// interested in AsMethodDescriptorProto, which has a concrete return type. This
// generic version is present to satisfy the Descriptor interface.
func (md *MethodDescriptor) AsProto() proto.Message {
	return md.proto
}

// AsMethodDescriptorProto returns the underlying descriptor proto.
func (md *MethodDescriptor) AsMethodDescriptorProto() *descriptorpb.MethodDescriptorProto {
	return md.proto
}

// String returns the underlying descriptor proto, in compact text format.
func (md *MethodDescriptor) String() string {
	return md.proto.String()
}

// IsServerStreaming returns true if this is a server-streaming method.
func (md *MethodDescriptor) IsServerStreaming() bool {
	return md.wrapped.IsStreamingServer()
}

// IsClientStreaming returns true if this is a client-streaming method.
func (md *MethodDescriptor) IsClientStreaming() bool {
	return md.wrapped.IsStreamingClient()
}

// GetInputType returns the input type, or request type, of the RPC method.
func (md *MethodDescriptor) GetInputType() *MessageDescriptor {
	return md.inType
}

// GetOutputType returns the output type, or response type, of the RPC method.
func (md *MethodDescriptor) GetOutputType() *MessageDescriptor {
	return md.outType
}

// OneOfDescriptor describes a one-of field set declared in a protocol buffer message.
type OneOfDescriptor struct {
	wrapped        protoreflect.OneofDescriptor
	proto          *descriptorpb.OneofDescriptorProto
	parent         *MessageDescriptor
	file           *FileDescriptor
	choices        []*FieldDescriptor
	sourceInfoPath []int32
}

// Unwrap returns the underlying protoreflect.Descriptor. Most usages will be more
// interested in UnwrapOneOf, which has a more specific return type. This generic
// version is present to satisfy the DescriptorWrapper interface.
func (od *OneOfDescriptor) Unwrap() protoreflect.Descriptor {
	return od.wrapped
}

// UnwrapOneOf returns the underlying protoreflect.OneofDescriptor.
func (od *OneOfDescriptor) UnwrapOneOf() protoreflect.OneofDescriptor {
	return od.wrapped
}

func createOneOfDescriptor(fd *FileDescriptor, parent *MessageDescriptor, index int, od protoreflect.OneofDescriptor, odp *descriptorpb.OneofDescriptorProto, path []int32) *OneOfDescriptor {
	ret := &OneOfDescriptor{
		wrapped:        od,
		proto:          odp,
		parent:         parent,
		file:           fd,
		sourceInfoPath: append([]int32(nil), path...), // defensive copy
	}
	for _, f := range parent.fields {
		oi := f.proto.OneofIndex
		if oi != nil && *oi == int32(index) {
			f.oneOf = ret
			ret.choices = append(ret.choices, f)
		}
	}
	return ret
}

// GetName returns the name of the one-of.
func (od *OneOfDescriptor) GetName() string {
	return string(od.wrapped.Name())
}

// GetFullyQualifiedName returns the fully qualified name of the one-of. Unlike
// GetName, this includes fully qualified name of the enclosing message.
func (od *OneOfDescriptor) GetFullyQualifiedName() string {
	return string(od.wrapped.FullName())
}

// GetParent returns the descriptor for the message in which this one-of is
// defined. Most usages will prefer to use GetOwner, which has a concrete
// return type. This more generic method is present to satisfy the Descriptor
// interface.
func (od *OneOfDescriptor) GetParent() Descriptor {
	return od.parent
}

// GetOwner returns the message to which this one-of field set belongs.
func (od *OneOfDescriptor) GetOwner() *MessageDescriptor {
	return od.parent
}

// GetFile returns the descriptor for the file in which this one-fof is defined.
func (od *OneOfDescriptor) GetFile() *FileDescriptor {
	return od.file
}

// GetOptions returns the one-of's options. Most usages will be more interested
// in GetOneOfOptions, which has a concrete return type. This generic version
// is present to satisfy the Descriptor interface.
func (od *OneOfDescriptor) GetOptions() proto.Message {
	return od.proto.GetOptions()
}

// GetOneOfOptions returns the one-of's options.
func (od *OneOfDescriptor) GetOneOfOptions() *descriptorpb.OneofOptions {
	return od.proto.GetOptions()
}

// GetSourceInfo returns source info for the one-of, if present in the
// descriptor. Not all descriptors will contain source info. If non-nil, the
// returned info contains information about the location in the file where the
// one-of was defined and also contains comments associated with the one-of
// definition.
func (od *OneOfDescriptor) GetSourceInfo() *descriptorpb.SourceCodeInfo_Location {
	return od.file.sourceInfo.Get(od.sourceInfoPath)
}

// AsProto returns the underlying descriptor proto. Most usages will be more
// interested in AsOneofDescriptorProto, which has a concrete return type. This
// generic version is present to satisfy the Descriptor interface.
func (od *OneOfDescriptor) AsProto() proto.Message {
	return od.proto
}

// AsOneofDescriptorProto returns the underlying descriptor proto.
func (od *OneOfDescriptor) AsOneofDescriptorProto() *descriptorpb.OneofDescriptorProto {
	return od.proto
}

// String returns the underlying descriptor proto, in compact text format.
func (od *OneOfDescriptor) String() string {
	return od.proto.String()
}

// GetChoices returns the fields that are part of the one-of field set. At most one of
// these fields may be set for a given message.
func (od *OneOfDescriptor) GetChoices() []*FieldDescriptor {
	return od.choices
}

func (od *OneOfDescriptor) IsSynthetic() bool {
	return od.wrapped.IsSynthetic()
}

func resolve(fd *FileDescriptor, src protoreflect.Descriptor, cache descriptorCache) (Descriptor, error) {
	d := cache.get(src)
	if d != nil {
		return d, nil
	}

	fqn := string(src.FullName())

	d = fd.FindSymbol(fqn)
	if d != nil {
		return d, nil
	}

	for _, dep := range fd.deps {
		d := dep.FindSymbol(fqn)
		if d != nil {
			return d, nil
		}
	}

	return nil, fmt.Errorf("file %q included an unresolvable reference to %q", fd.proto.GetName(), fqn)
}
