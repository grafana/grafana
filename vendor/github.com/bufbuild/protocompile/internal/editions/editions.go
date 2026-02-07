// Copyright 2020-2024 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package editions contains helpers related to resolving features for
// Protobuf editions. These are lower-level helpers. Higher-level helpers
// (which use this package under the hood) can be found in the exported
// protoutil package.
package editions

import (
	"fmt"
	"strings"
	"sync"

	"google.golang.org/protobuf/encoding/prototext"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

const (
	// MinSupportedEdition is the earliest edition supported by this module.
	// It should be 2023 (the first edition) for the indefinite future.
	MinSupportedEdition = descriptorpb.Edition_EDITION_2023

	// MaxSupportedEdition is the most recent edition supported by this module.
	MaxSupportedEdition = descriptorpb.Edition_EDITION_2023
)

var (
	// SupportedEditions is the exhaustive set of editions that protocompile
	// can support. We don't allow it to compile future/unknown editions, to
	// make sure we don't generate incorrect descriptors, in the event that
	// a future edition introduces a change or new feature that requires
	// new logic in the compiler.
	SupportedEditions = computeSupportedEditions(MinSupportedEdition, MaxSupportedEdition)

	// FeatureSetDescriptor is the message descriptor for the compiled-in
	// version (in the descriptorpb package) of the google.protobuf.FeatureSet
	// message type.
	FeatureSetDescriptor = (*descriptorpb.FeatureSet)(nil).ProtoReflect().Descriptor()
	// FeatureSetType is the message type for the compiled-in version (in
	// the descriptorpb package) of google.protobuf.FeatureSet.
	FeatureSetType = (*descriptorpb.FeatureSet)(nil).ProtoReflect().Type()

	editionDefaults     map[descriptorpb.Edition]*descriptorpb.FeatureSet
	editionDefaultsInit sync.Once
)

// HasFeatures is implemented by all options messages and provides a
// nil-receiver-safe way of accessing the features explicitly configured
// in those options.
type HasFeatures interface {
	GetFeatures() *descriptorpb.FeatureSet
}

var _ HasFeatures = (*descriptorpb.FileOptions)(nil)
var _ HasFeatures = (*descriptorpb.MessageOptions)(nil)
var _ HasFeatures = (*descriptorpb.FieldOptions)(nil)
var _ HasFeatures = (*descriptorpb.OneofOptions)(nil)
var _ HasFeatures = (*descriptorpb.ExtensionRangeOptions)(nil)
var _ HasFeatures = (*descriptorpb.EnumOptions)(nil)
var _ HasFeatures = (*descriptorpb.EnumValueOptions)(nil)
var _ HasFeatures = (*descriptorpb.ServiceOptions)(nil)
var _ HasFeatures = (*descriptorpb.MethodOptions)(nil)

// ResolveFeature resolves a feature for the given descriptor. This simple
// helper examines the given element and its ancestors, searching for an
// override. If there is no overridden value, it returns a zero value.
func ResolveFeature(
	element protoreflect.Descriptor,
	fields ...protoreflect.FieldDescriptor,
) (protoreflect.Value, error) {
	for {
		var features *descriptorpb.FeatureSet
		if withFeatures, ok := element.Options().(HasFeatures); ok {
			// It should not really be possible for 'ok' to ever be false...
			features = withFeatures.GetFeatures()
		}

		// TODO: adaptFeatureSet is only looking at the first field. But if we needed to
		//       support an extension field inside a custom feature, we'd really need
		//       to check all fields. That gets particularly complicated if the traversal
		//       path of fields includes list and map values. Luckily, features are not
		//       supposed to be repeated and not supposed to themselves have extensions.
		//       So this should be fine, at least for now.
		msgRef, err := adaptFeatureSet(features, fields[0])
		if err != nil {
			return protoreflect.Value{}, err
		}
		// Navigate the fields to find the value
		var val protoreflect.Value
		for i, field := range fields {
			if i > 0 {
				msgRef = val.Message()
			}
			if !msgRef.Has(field) {
				val = protoreflect.Value{}
				break
			}
			val = msgRef.Get(field)
		}
		if val.IsValid() {
			// All fields were set!
			return val, nil
		}

		parent := element.Parent()
		if parent == nil {
			// We've reached the end of the inheritance chain.
			return protoreflect.Value{}, nil
		}
		element = parent
	}
}

// HasEdition should be implemented by values that implement
// [protoreflect.FileDescriptor], to provide access to the file's
// edition when its syntax is [protoreflect.Editions].
type HasEdition interface {
	// Edition returns the numeric value of a google.protobuf.Edition enum
	// value that corresponds to the edition of this file. If the file does
	// not use editions, it should return the enum value that corresponds
	// to the syntax level, EDITION_PROTO2 or EDITION_PROTO3.
	Edition() int32
}

// GetEdition returns the edition for a given element. It returns
// EDITION_PROTO2 or EDITION_PROTO3 if the element is in a file that
// uses proto2 or proto3 syntax, respectively. It returns EDITION_UNKNOWN
// if the syntax of the given element is not recognized or if the edition
// cannot be ascertained from the element's [protoreflect.FileDescriptor].
func GetEdition(d protoreflect.Descriptor) descriptorpb.Edition {
	switch d.ParentFile().Syntax() {
	case protoreflect.Proto2:
		return descriptorpb.Edition_EDITION_PROTO2
	case protoreflect.Proto3:
		return descriptorpb.Edition_EDITION_PROTO3
	case protoreflect.Editions:
		withEdition, ok := d.ParentFile().(HasEdition)
		if !ok {
			// The parent file should always be a *result, so we should
			// never be able to actually get in here. If we somehow did
			// have another implementation of protoreflect.FileDescriptor,
			// it doesn't provide a way to get the edition, other than the
			// potentially expensive step of generating a FileDescriptorProto
			// and then querying for the edition from that. :/
			return descriptorpb.Edition_EDITION_UNKNOWN
		}
		return descriptorpb.Edition(withEdition.Edition())
	default:
		return descriptorpb.Edition_EDITION_UNKNOWN
	}
}

// GetEditionDefaults returns the default feature values for the given edition.
// It returns nil if the given edition is not known.
//
// This only populates known features, those that are fields of [*descriptorpb.FeatureSet].
// It does not populate any extension fields.
//
// The returned value must not be mutated as it references shared package state.
func GetEditionDefaults(edition descriptorpb.Edition) *descriptorpb.FeatureSet {
	editionDefaultsInit.Do(func() {
		editionDefaults = make(map[descriptorpb.Edition]*descriptorpb.FeatureSet, len(descriptorpb.Edition_name))
		// Compute default for all known editions in descriptorpb.
		for editionInt := range descriptorpb.Edition_name {
			edition := descriptorpb.Edition(editionInt)
			defaults := &descriptorpb.FeatureSet{}
			defaultsRef := defaults.ProtoReflect()
			fields := defaultsRef.Descriptor().Fields()
			// Note: we are not computing defaults for extensions. Those are not needed
			// by anything in the compiler, so we can get away with just computing
			// defaults for these static, non-extension fields.
			for i, length := 0, fields.Len(); i < length; i++ {
				field := fields.Get(i)
				val, err := GetFeatureDefault(edition, FeatureSetType, field)
				if err != nil {
					// should we fail somehow??
					continue
				}
				defaultsRef.Set(field, val)
			}
			editionDefaults[edition] = defaults
		}
	})
	return editionDefaults[edition]
}

// GetFeatureDefault computes the default value for a feature. The given container
// is the message type that contains the field. This should usually be the descriptor
// for google.protobuf.FeatureSet, but can be a different message for computing the
// default value of custom features.
//
// Note that this always re-computes the default. For known fields of FeatureSet,
// it is more efficient to query from the statically computed default messages,
// like so:
//
//	editions.GetEditionDefaults(edition).ProtoReflect().Get(feature)
func GetFeatureDefault(edition descriptorpb.Edition, container protoreflect.MessageType, feature protoreflect.FieldDescriptor) (protoreflect.Value, error) {
	opts, ok := feature.Options().(*descriptorpb.FieldOptions)
	if !ok {
		// this is most likely impossible except for contrived use cases...
		return protoreflect.Value{}, fmt.Errorf("options is %T instead of *descriptorpb.FieldOptions", feature.Options())
	}
	maxEdition := descriptorpb.Edition(-1)
	var maxVal string
	for _, def := range opts.EditionDefaults {
		if def.GetEdition() <= edition && def.GetEdition() > maxEdition {
			maxEdition = def.GetEdition()
			maxVal = def.GetValue()
		}
	}
	if maxEdition == -1 {
		// no matching default found
		return protoreflect.Value{}, fmt.Errorf("no relevant default for edition %s", edition)
	}
	// We use a typed nil so that it won't fall back to the global registry. Features
	// should not use extensions or google.protobuf.Any, so a nil *Types is fine.
	unmarshaler := prototext.UnmarshalOptions{Resolver: (*protoregistry.Types)(nil)}
	// The string value is in the text format: either a field value literal or a
	// message literal. (Repeated and map features aren't supported, so there's no
	// array or map literal syntax to worry about.)
	if feature.Kind() == protoreflect.MessageKind || feature.Kind() == protoreflect.GroupKind {
		fldVal := container.Zero().NewField(feature)
		err := unmarshaler.Unmarshal([]byte(maxVal), fldVal.Message().Interface())
		if err != nil {
			return protoreflect.Value{}, err
		}
		return fldVal, nil
	}
	// The value is the textformat for the field. But prototext doesn't provide a way
	// to unmarshal a single field value. To work around, we unmarshal into an enclosing
	// message, which means we must prefix the value with the field name.
	if feature.IsExtension() {
		maxVal = fmt.Sprintf("[%s]: %s", feature.FullName(), maxVal)
	} else {
		maxVal = fmt.Sprintf("%s: %s", feature.Name(), maxVal)
	}
	empty := container.New()
	err := unmarshaler.Unmarshal([]byte(maxVal), empty.Interface())
	if err != nil {
		return protoreflect.Value{}, err
	}
	return empty.Get(feature), nil
}

func adaptFeatureSet(msg *descriptorpb.FeatureSet, field protoreflect.FieldDescriptor) (protoreflect.Message, error) {
	msgRef := msg.ProtoReflect()
	var actualField protoreflect.FieldDescriptor
	switch {
	case field.IsExtension():
		// Extensions can be used directly with the feature set, even if
		// field.ContainingMessage() != FeatureSetDescriptor. But only if
		// the value is either not a message or is a message with the
		// right descriptor, i.e. val.Descriptor() == field.Message().
		if actualField = actualDescriptor(msgRef, field); actualField == nil || actualField == field {
			if msgRef.Has(field) || len(msgRef.GetUnknown()) == 0 {
				return msgRef, nil
			}
			// The field is not present, but the message has unrecognized values. So
			// let's try to parse the unrecognized bytes, just in case they contain
			// this extension.
			temp := &descriptorpb.FeatureSet{}
			unmarshaler := proto.UnmarshalOptions{
				AllowPartial: true,
				Resolver:     resolverForExtension{field},
			}
			if err := unmarshaler.Unmarshal(msgRef.GetUnknown(), temp); err != nil {
				return nil, fmt.Errorf("failed to parse unrecognized fields of FeatureSet: %w", err)
			}
			return temp.ProtoReflect(), nil
		}
	case field.ContainingMessage() == FeatureSetDescriptor:
		// Known field, not dynamically generated. Can directly use with the feature set.
		return msgRef, nil
	default:
		actualField = FeatureSetDescriptor.Fields().ByNumber(field.Number())
	}

	// If we get here, we have a dynamic field descriptor or an extension
	// descriptor whose message type does not match the descriptor of the
	// stored value. We need to copy its value into a dynamic message,
	// which requires marshalling/unmarshalling.
	// We only need to copy over the unrecognized bytes (if any)
	// and the same field (if present).
	data := msgRef.GetUnknown()
	if actualField != nil && msgRef.Has(actualField) {
		subset := &descriptorpb.FeatureSet{}
		subset.ProtoReflect().Set(actualField, msgRef.Get(actualField))
		var err error
		data, err = proto.MarshalOptions{AllowPartial: true}.MarshalAppend(data, subset)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal FeatureSet field %s to bytes: %w", field.Name(), err)
		}
	}
	if len(data) == 0 {
		// No relevant data to copy over, so we can just return
		// a zero value message
		return dynamicpb.NewMessageType(field.ContainingMessage()).Zero(), nil
	}

	other := dynamicpb.NewMessage(field.ContainingMessage())
	// We don't need to use a resolver for this step because we know that
	// field is not an extension. And features are not allowed to themselves
	// have extensions.
	if err := (proto.UnmarshalOptions{AllowPartial: true}).Unmarshal(data, other); err != nil {
		return nil, fmt.Errorf("failed to marshal FeatureSet field %s to bytes: %w", field.Name(), err)
	}
	return other, nil
}

type resolverForExtension struct {
	ext protoreflect.ExtensionDescriptor
}

func (r resolverForExtension) FindMessageByName(_ protoreflect.FullName) (protoreflect.MessageType, error) {
	return nil, protoregistry.NotFound
}

func (r resolverForExtension) FindMessageByURL(_ string) (protoreflect.MessageType, error) {
	return nil, protoregistry.NotFound
}

func (r resolverForExtension) FindExtensionByName(field protoreflect.FullName) (protoreflect.ExtensionType, error) {
	if field == r.ext.FullName() {
		return asExtensionType(r.ext), nil
	}
	return nil, protoregistry.NotFound
}

func (r resolverForExtension) FindExtensionByNumber(message protoreflect.FullName, field protoreflect.FieldNumber) (protoreflect.ExtensionType, error) {
	if message == r.ext.ContainingMessage().FullName() && field == r.ext.Number() {
		return asExtensionType(r.ext), nil
	}
	return nil, protoregistry.NotFound
}

func asExtensionType(ext protoreflect.ExtensionDescriptor) protoreflect.ExtensionType {
	if xtd, ok := ext.(protoreflect.ExtensionTypeDescriptor); ok {
		return xtd.Type()
	}
	return dynamicpb.NewExtensionType(ext)
}

func computeSupportedEditions(minEdition, maxEdition descriptorpb.Edition) map[string]descriptorpb.Edition {
	supportedEditions := map[string]descriptorpb.Edition{}
	for editionNum := range descriptorpb.Edition_name {
		edition := descriptorpb.Edition(editionNum)
		if edition >= minEdition && edition <= maxEdition {
			name := strings.TrimPrefix(edition.String(), "EDITION_")
			supportedEditions[name] = edition
		}
	}
	return supportedEditions
}

// actualDescriptor returns the actual field descriptor referenced by msg that
// corresponds to the given ext (i.e. same number). It returns nil if msg has
// no reference, if the actual descriptor is the same as ext, or if ext is
// otherwise safe to use as is.
func actualDescriptor(msg protoreflect.Message, ext protoreflect.ExtensionDescriptor) protoreflect.FieldDescriptor {
	if !msg.Has(ext) || ext.Message() == nil {
		// nothing to match; safe as is
		return nil
	}
	val := msg.Get(ext)
	switch {
	case ext.IsMap(): // should not actually be possible
		expectedDescriptor := ext.MapValue().Message()
		if expectedDescriptor == nil {
			return nil // nothing to match
		}
		// We know msg.Has(field) is true, from above, so there's at least one entry.
		var matches bool
		val.Map().Range(func(_ protoreflect.MapKey, val protoreflect.Value) bool {
			matches = val.Message().Descriptor() == expectedDescriptor
			return false
		})
		if matches {
			return nil
		}
	case ext.IsList():
		// We know msg.Has(field) is true, from above, so there's at least one entry.
		if val.List().Get(0).Message().Descriptor() == ext.Message() {
			return nil
		}
	case !ext.IsMap():
		if val.Message().Descriptor() == ext.Message() {
			return nil
		}
	}
	// The underlying message descriptors do not match. So we need to return
	// the actual field descriptor. Sadly, protoreflect.Message provides no way
	// to query the field descriptor in a message by number. For non-extensions,
	// one can query the associated message descriptor. But for extensions, we
	// have to do the slow thing, and range through all fields looking for it.
	var actualField protoreflect.FieldDescriptor
	msg.Range(func(fd protoreflect.FieldDescriptor, _ protoreflect.Value) bool {
		if fd.Number() == ext.Number() {
			actualField = fd
			return false
		}
		return true
	})
	return actualField
}
