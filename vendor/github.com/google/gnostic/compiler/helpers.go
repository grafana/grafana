// Copyright 2017 Google LLC. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package compiler

import (
	"github.com/google/gnostic-models/compiler"
)

// compiler helper functions, usually called from generated code

// UnpackMap gets a *yaml.Node if possible.
var UnpackMap = compiler.UnpackMap

// SortedKeysForMap returns the sorted keys of a yamlv2.MapSlice.
var SortedKeysForMap = compiler.SortedKeysForMap

// MapHasKey returns true if a yamlv2.MapSlice contains a specified key.
var MapHasKey = compiler.MapHasKey

// MapValueForKey gets the value of a map value for a specified key.
var MapValueForKey = compiler.MapValueForKey

// ConvertInterfaceArrayToStringArray converts an array of interfaces to an array of strings, if possible.
var ConvertInterfaceArrayToStringArray = compiler.ConvertInterfaceArrayToStringArray

// SequenceNodeForNode returns a node if it is a SequenceNode.
var SequenceNodeForNode = compiler.SequenceNodeForNode

// BoolForScalarNode returns the bool value of a node.
var BoolForScalarNode = compiler.BoolForScalarNode

// IntForScalarNode returns the integer value of a node.
var IntForScalarNode = compiler.IntForScalarNode

// FloatForScalarNode returns the float value of a node.
var FloatForScalarNode = compiler.FloatForScalarNode

// StringForScalarNode returns the string value of a node.
var StringForScalarNode = compiler.StringForScalarNode

// StringArrayForSequenceNode converts a sequence node to an array of strings, if possible.
var StringArrayForSequenceNode = compiler.StringArrayForSequenceNode

// MissingKeysInMap identifies which keys from a list of required keys are not in a map.
var MissingKeysInMap = compiler.MissingKeysInMap

// InvalidKeysInMap returns keys in a map that don't match a list of allowed keys and patterns.
var InvalidKeysInMap = compiler.InvalidKeysInMap

// NewNullNode creates a new Null node.
var NewNullNode = compiler.NewNullNode

// NewMappingNode creates a new Mapping node.
var NewMappingNode = compiler.NewMappingNode

// NewSequenceNode creates a new Sequence node.
var NewSequenceNode = compiler.NewSequenceNode

// NewScalarNodeForString creates a new node to hold a string.
var NewScalarNodeForString = compiler.NewScalarNodeForString

// NewSequenceNodeForStringArray creates a new node to hold an array of strings.
var NewSequenceNodeForStringArray = compiler.NewSequenceNodeForStringArray

// NewScalarNodeForBool creates a new node to hold a bool.
var NewScalarNodeForBool = compiler.NewScalarNodeForBool

// NewScalarNodeForFloat creates a new node to hold a float.
var NewScalarNodeForFloat = compiler.NewScalarNodeForFloat

// NewScalarNodeForInt creates a new node to hold an integer.
var NewScalarNodeForInt = compiler.NewScalarNodeForInt

// PluralProperties returns the string "properties" pluralized.
var PluralProperties = compiler.PluralProperties

// StringArrayContainsValue returns true if a string array contains a specified value.
var StringArrayContainsValue = compiler.StringArrayContainsValue

// StringArrayContainsValues returns true if a string array contains all of a list of specified values.
var StringArrayContainsValues = compiler.StringArrayContainsValues

// StringValue returns the string value of an item.
var StringValue = compiler.StringValue

// Description returns a human-readable represention of an item.
var Description = compiler.Description

// Display returns a description of a node for use in error messages.
var Display = compiler.Display

// Marshal creates a yaml version of a structure in our preferred style
var Marshal = compiler.Marshal
