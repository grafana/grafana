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

package protoutil

import (
	"fmt"

	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"

	"github.com/bufbuild/protocompile/internal/editions"
)

// GetFeatureDefault gets the default value for the given feature and the given
// edition. The given feature must represent a field of the google.protobuf.FeatureSet
// message and must not be an extension.
//
// If the given field is from a dynamically built descriptor (i.e. it's containing
// message descriptor is different from the linked-in descriptor for
// [*descriptorpb.FeatureSet]), the returned value may be a dynamic value. In such
// cases, the value may not be directly usable using [protoreflect.Message.Set] with
// an instance of [*descriptorpb.FeatureSet] and must instead be used with a
// [*dynamicpb.Message].
//
// To get the default value of a custom feature, use [GetCustomFeatureDefault]
// instead.
func GetFeatureDefault(edition descriptorpb.Edition, feature protoreflect.FieldDescriptor) (protoreflect.Value, error) {
	if feature.ContainingMessage().FullName() != editions.FeatureSetDescriptor.FullName() {
		return protoreflect.Value{}, fmt.Errorf("feature %s is a field of %s but should be a field of %s",
			feature.Name(), feature.ContainingMessage().FullName(), editions.FeatureSetDescriptor.FullName())
	}
	var msgType protoreflect.MessageType
	if feature.ContainingMessage() == editions.FeatureSetDescriptor {
		msgType = editions.FeatureSetType
	} else {
		msgType = dynamicpb.NewMessageType(feature.ContainingMessage())
	}
	return editions.GetFeatureDefault(edition, msgType, feature)
}

// GetCustomFeatureDefault gets the default value for the given custom feature
// and given edition. A custom feature is a field whose containing message is the
// type of an extension field of google.protobuf.FeatureSet. The given extension
// describes that extension field and message type. The given feature must be a
// field of that extension's message type.
func GetCustomFeatureDefault(edition descriptorpb.Edition, extension protoreflect.ExtensionType, feature protoreflect.FieldDescriptor) (protoreflect.Value, error) {
	extDesc := extension.TypeDescriptor()
	if extDesc.ContainingMessage().FullName() != editions.FeatureSetDescriptor.FullName() {
		return protoreflect.Value{}, fmt.Errorf("extension %s does not extend %s", extDesc.FullName(), editions.FeatureSetDescriptor.FullName())
	}
	if extDesc.Message() == nil {
		return protoreflect.Value{}, fmt.Errorf("extensions of %s should be messages; %s is instead %s",
			editions.FeatureSetDescriptor.FullName(), extDesc.FullName(), extDesc.Kind().String())
	}
	if feature.IsExtension() {
		return protoreflect.Value{}, fmt.Errorf("feature %s is an extension, but feature extension %s may not itself have extensions",
			feature.FullName(), extDesc.FullName())
	}
	if feature.ContainingMessage().FullName() != extDesc.Message().FullName() {
		return protoreflect.Value{}, fmt.Errorf("feature %s is a field of %s but should be a field of %s",
			feature.Name(), feature.ContainingMessage().FullName(), extDesc.Message().FullName())
	}
	if feature.ContainingMessage() != extDesc.Message() {
		return protoreflect.Value{}, fmt.Errorf("feature %s has a different message descriptor from the given extension type for %s",
			feature.Name(), extDesc.Message().FullName())
	}
	return editions.GetFeatureDefault(edition, extension.Zero().Message().Type(), feature)
}

// ResolveFeature resolves a feature for the given descriptor.
//
// If the given element is in a proto2 or proto3 syntax file, this skips
// resolution and just returns the relevant default (since such files are not
// allowed to override features). If neither the given element nor any of its
// ancestors override the given feature, the relevant default is returned.
//
// This has the same caveat as GetFeatureDefault if the given feature is from a
// dynamically built descriptor.
func ResolveFeature(element protoreflect.Descriptor, feature protoreflect.FieldDescriptor) (protoreflect.Value, error) {
	edition := editions.GetEdition(element)
	defaultVal, err := GetFeatureDefault(edition, feature)
	if err != nil {
		return protoreflect.Value{}, err
	}
	return resolveFeature(edition, defaultVal, element, feature)
}

// ResolveCustomFeature resolves a custom feature for the given extension and
// field descriptor.
//
// The given extension must be an extension of google.protobuf.FeatureSet that
// represents a non-repeated message value. The given feature is a field in
// that extension's message type.
//
// If the given element is in a proto2 or proto3 syntax file, this skips
// resolution and just returns the relevant default (since such files are not
// allowed to override features). If neither the given element nor any of its
// ancestors override the given feature, the relevant default is returned.
func ResolveCustomFeature(element protoreflect.Descriptor, extension protoreflect.ExtensionType, feature protoreflect.FieldDescriptor) (protoreflect.Value, error) {
	edition := editions.GetEdition(element)
	defaultVal, err := GetCustomFeatureDefault(edition, extension, feature)
	if err != nil {
		return protoreflect.Value{}, err
	}
	return resolveFeature(edition, defaultVal, element, extension.TypeDescriptor(), feature)
}

func resolveFeature(
	edition descriptorpb.Edition,
	defaultVal protoreflect.Value,
	element protoreflect.Descriptor,
	fields ...protoreflect.FieldDescriptor,
) (protoreflect.Value, error) {
	if edition == descriptorpb.Edition_EDITION_PROTO2 || edition == descriptorpb.Edition_EDITION_PROTO3 {
		// these syntax levels can't specify features, so we can short-circuit the search
		// through the descriptor hierarchy for feature overrides
		return defaultVal, nil
	}
	val, err := editions.ResolveFeature(element, fields...)
	if err != nil {
		return protoreflect.Value{}, err
	}
	if val.IsValid() {
		return val, nil
	}
	return defaultVal, nil
}
