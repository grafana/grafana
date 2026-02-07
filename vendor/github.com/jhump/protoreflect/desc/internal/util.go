package internal

import (
	"math"
	"unicode"
	"unicode/utf8"
)

const (
	// MaxNormalTag is the maximum allowed tag number for a field in a normal message.
	MaxNormalTag = 536870911 // 2^29 - 1

	// MaxMessageSetTag is the maximum allowed tag number of a field in a message that
	// uses the message set wire format.
	MaxMessageSetTag = math.MaxInt32 - 1

	// MaxTag is the maximum allowed tag number. (It is the same as MaxMessageSetTag
	// since that is the absolute highest allowed.)
	MaxTag = MaxMessageSetTag

	// SpecialReservedStart is the first tag in a range that is reserved and not
	// allowed for use in message definitions.
	SpecialReservedStart = 19000
	// SpecialReservedEnd is the last tag in a range that is reserved and not
	// allowed for use in message definitions.
	SpecialReservedEnd = 19999

	// NB: It would be nice to use constants from generated code instead of
	// hard-coding these here. But code-gen does not emit these as constants
	// anywhere. The only places they appear in generated code are struct tags
	// on fields of the generated descriptor protos.

	// File_packageTag is the tag number of the package element in a file
	// descriptor proto.
	File_packageTag = 2
	// File_dependencyTag is the tag number of the dependencies element in a
	// file descriptor proto.
	File_dependencyTag = 3
	// File_messagesTag is the tag number of the messages element in a file
	// descriptor proto.
	File_messagesTag = 4
	// File_enumsTag is the tag number of the enums element in a file descriptor
	// proto.
	File_enumsTag = 5
	// File_servicesTag is the tag number of the services element in a file
	// descriptor proto.
	File_servicesTag = 6
	// File_extensionsTag is the tag number of the extensions element in a file
	// descriptor proto.
	File_extensionsTag = 7
	// File_optionsTag is the tag number of the options element in a file
	// descriptor proto.
	File_optionsTag = 8
	// File_syntaxTag is the tag number of the syntax element in a file
	// descriptor proto.
	File_syntaxTag = 12
	// File_editionTag is the tag number of the edition element in a file
	// descriptor proto.
	File_editionTag = 14
	// Message_nameTag is the tag number of the name element in a message
	// descriptor proto.
	Message_nameTag = 1
	// Message_fieldsTag is the tag number of the fields element in a message
	// descriptor proto.
	Message_fieldsTag = 2
	// Message_nestedMessagesTag is the tag number of the nested messages
	// element in a message descriptor proto.
	Message_nestedMessagesTag = 3
	// Message_enumsTag is the tag number of the enums element in a message
	// descriptor proto.
	Message_enumsTag = 4
	// Message_extensionRangeTag is the tag number of the extension ranges
	// element in a message descriptor proto.
	Message_extensionRangeTag = 5
	// Message_extensionsTag is the tag number of the extensions element in a
	// message descriptor proto.
	Message_extensionsTag = 6
	// Message_optionsTag is the tag number of the options element in a message
	// descriptor proto.
	Message_optionsTag = 7
	// Message_oneOfsTag is the tag number of the one-ofs element in a message
	// descriptor proto.
	Message_oneOfsTag = 8
	// Message_reservedRangeTag is the tag number of the reserved ranges element
	// in a message descriptor proto.
	Message_reservedRangeTag = 9
	// Message_reservedNameTag is the tag number of the reserved names element
	// in a message descriptor proto.
	Message_reservedNameTag = 10
	// ExtensionRange_startTag is the tag number of the start index in an
	// extension range proto.
	ExtensionRange_startTag = 1
	// ExtensionRange_endTag is the tag number of the end index in an
	// extension range proto.
	ExtensionRange_endTag = 2
	// ExtensionRange_optionsTag is the tag number of the options element in an
	// extension range proto.
	ExtensionRange_optionsTag = 3
	// ReservedRange_startTag is the tag number of the start index in a reserved
	// range proto.
	ReservedRange_startTag = 1
	// ReservedRange_endTag is the tag number of the end index in a reserved
	// range proto.
	ReservedRange_endTag = 2
	// Field_nameTag is the tag number of the name element in a field descriptor
	// proto.
	Field_nameTag = 1
	// Field_extendeeTag is the tag number of the extendee element in a field
	// descriptor proto.
	Field_extendeeTag = 2
	// Field_numberTag is the tag number of the number element in a field
	// descriptor proto.
	Field_numberTag = 3
	// Field_labelTag is the tag number of the label element in a field
	// descriptor proto.
	Field_labelTag = 4
	// Field_typeTag is the tag number of the type element in a field descriptor
	// proto.
	Field_typeTag = 5
	// Field_typeNameTag is the tag number of the type name element in a field
	// descriptor proto.
	Field_typeNameTag = 6
	// Field_defaultTag is the tag number of the default value element in a
	// field descriptor proto.
	Field_defaultTag = 7
	// Field_optionsTag is the tag number of the options element in a field
	// descriptor proto.
	Field_optionsTag = 8
	// Field_jsonNameTag is the tag number of the JSON name element in a field
	// descriptor proto.
	Field_jsonNameTag = 10
	// Field_proto3OptionalTag is the tag number of the proto3_optional element
	// in a descriptor proto.
	Field_proto3OptionalTag = 17
	// OneOf_nameTag is the tag number of the name element in a one-of
	// descriptor proto.
	OneOf_nameTag = 1
	// OneOf_optionsTag is the tag number of the options element in a one-of
	// descriptor proto.
	OneOf_optionsTag = 2
	// Enum_nameTag is the tag number of the name element in an enum descriptor
	// proto.
	Enum_nameTag = 1
	// Enum_valuesTag is the tag number of the values element in an enum
	// descriptor proto.
	Enum_valuesTag = 2
	// Enum_optionsTag is the tag number of the options element in an enum
	// descriptor proto.
	Enum_optionsTag = 3
	// Enum_reservedRangeTag is the tag number of the reserved ranges element in
	// an enum descriptor proto.
	Enum_reservedRangeTag = 4
	// Enum_reservedNameTag is the tag number of the reserved names element in
	// an enum descriptor proto.
	Enum_reservedNameTag = 5
	// EnumVal_nameTag is the tag number of the name element in an enum value
	// descriptor proto.
	EnumVal_nameTag = 1
	// EnumVal_numberTag is the tag number of the number element in an enum
	// value descriptor proto.
	EnumVal_numberTag = 2
	// EnumVal_optionsTag is the tag number of the options element in an enum
	// value descriptor proto.
	EnumVal_optionsTag = 3
	// Service_nameTag is the tag number of the name element in a service
	// descriptor proto.
	Service_nameTag = 1
	// Service_methodsTag is the tag number of the methods element in a service
	// descriptor proto.
	Service_methodsTag = 2
	// Service_optionsTag is the tag number of the options element in a service
	// descriptor proto.
	Service_optionsTag = 3
	// Method_nameTag is the tag number of the name element in a method
	// descriptor proto.
	Method_nameTag = 1
	// Method_inputTag is the tag number of the input type element in a method
	// descriptor proto.
	Method_inputTag = 2
	// Method_outputTag is the tag number of the output type element in a method
	// descriptor proto.
	Method_outputTag = 3
	// Method_optionsTag is the tag number of the options element in a method
	// descriptor proto.
	Method_optionsTag = 4
	// Method_inputStreamTag is the tag number of the input stream flag in a
	// method descriptor proto.
	Method_inputStreamTag = 5
	// Method_outputStreamTag is the tag number of the output stream flag in a
	// method descriptor proto.
	Method_outputStreamTag = 6

	// UninterpretedOptionsTag is the tag number of the uninterpreted options
	// element. All *Options messages use the same tag for the field that stores
	// uninterpreted options.
	UninterpretedOptionsTag = 999

	// Uninterpreted_nameTag is the tag number of the name element in an
	// uninterpreted options proto.
	Uninterpreted_nameTag = 2
	// Uninterpreted_identTag is the tag number of the identifier value in an
	// uninterpreted options proto.
	Uninterpreted_identTag = 3
	// Uninterpreted_posIntTag is the tag number of the positive int value in an
	// uninterpreted options proto.
	Uninterpreted_posIntTag = 4
	// Uninterpreted_negIntTag is the tag number of the negative int value in an
	// uninterpreted options proto.
	Uninterpreted_negIntTag = 5
	// Uninterpreted_doubleTag is the tag number of the double value in an
	// uninterpreted options proto.
	Uninterpreted_doubleTag = 6
	// Uninterpreted_stringTag is the tag number of the string value in an
	// uninterpreted options proto.
	Uninterpreted_stringTag = 7
	// Uninterpreted_aggregateTag is the tag number of the aggregate value in an
	// uninterpreted options proto.
	Uninterpreted_aggregateTag = 8
	// UninterpretedName_nameTag is the tag number of the name element in an
	// uninterpreted option name proto.
	UninterpretedName_nameTag = 1
)

// JsonName returns the default JSON name for a field with the given name.
// This mirrors the algorithm in protoc:
//
//	https://github.com/protocolbuffers/protobuf/blob/v21.3/src/google/protobuf/descriptor.cc#L95
func JsonName(name string) string {
	var js []rune
	nextUpper := false
	for _, r := range name {
		if r == '_' {
			nextUpper = true
			continue
		}
		if nextUpper {
			nextUpper = false
			js = append(js, unicode.ToUpper(r))
		} else {
			js = append(js, r)
		}
	}
	return string(js)
}

// InitCap returns the given field name, but with the first letter capitalized.
func InitCap(name string) string {
	r, sz := utf8.DecodeRuneInString(name)
	return string(unicode.ToUpper(r)) + name[sz:]
}

// CreatePrefixList returns a list of package prefixes to search when resolving
// a symbol name. If the given package is blank, it returns only the empty
// string. If the given package contains only one token, e.g. "foo", it returns
// that token and the empty string, e.g. ["foo", ""]. Otherwise, it returns
// successively shorter prefixes of the package and then the empty string. For
// example, for a package named "foo.bar.baz" it will return the following list:
//
//	["foo.bar.baz", "foo.bar", "foo", ""]
func CreatePrefixList(pkg string) []string {
	if pkg == "" {
		return []string{""}
	}

	numDots := 0
	// one pass to pre-allocate the returned slice
	for i := 0; i < len(pkg); i++ {
		if pkg[i] == '.' {
			numDots++
		}
	}
	if numDots == 0 {
		return []string{pkg, ""}
	}

	prefixes := make([]string, numDots+2)
	// second pass to fill in returned slice
	for i := 0; i < len(pkg); i++ {
		if pkg[i] == '.' {
			prefixes[numDots] = pkg[:i]
			numDots--
		}
	}
	prefixes[0] = pkg

	return prefixes
}

// GetMaxTag returns the max tag number allowed, based on whether a message uses
// message set wire format or not.
func GetMaxTag(isMessageSet bool) int32 {
	if isMessageSet {
		return MaxMessageSetTag
	}
	return MaxNormalTag
}
