// Copyright 2024 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package types

import (
	"encoding/hex"
	"errors"

	"github.com/dolthub/go-mysql-server/sql"
)

// ExtendedTypeSerializer is the function signature for the extended type serializer.
type ExtendedTypeSerializer func(extendedType sql.ExtendedType) ([]byte, error)

// ExtendedTypeDeserializer is the function signature for the extended type deserializer.
type ExtendedTypeDeserializer func(serializedType []byte) (sql.ExtendedType, error)

// extendedTypeDeserializer refers to the function that will handle deserialization of extended types.
var extendedTypeDeserializer ExtendedTypeDeserializer = func(serializedType []byte) (sql.ExtendedType, error) {
	return nil, errors.New("placeholder extended type deserializer")
}

// extendedTypeSerializer refers to the function that will handle serialization of extended types.
var extendedTypeSerializer ExtendedTypeSerializer = func(extendedType sql.ExtendedType) ([]byte, error) {
	return nil, errors.New("placeholder extended type serializer")
}

// SetExtendedTypeSerializers sets the handlers that are able to serialize and deserialize extended types.
// It is recommended to set these from within an init function within the calling package.
func SetExtendedTypeSerializers(serializer ExtendedTypeSerializer, deserializer ExtendedTypeDeserializer) {
	extendedTypeSerializer = serializer
	extendedTypeDeserializer = deserializer
}

// SerializeType serializes the given extended type into a byte slice.
func SerializeType(typ sql.ExtendedType) ([]byte, error) {
	return extendedTypeSerializer(typ)
}

// SerializeTypeToString serializes the given extended type into a hex-encoded string.
func SerializeTypeToString(typ sql.ExtendedType) (string, error) {
	serializedType, err := extendedTypeSerializer(typ)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(serializedType), nil
}

// DeserializeType deserializes a byte slice representing a serialized extended type.
func DeserializeType(typ []byte) (sql.ExtendedType, error) {
	return extendedTypeDeserializer(typ)
}

// DeserializeTypeFromString deserializes a hex-encoded string representing a serialized extended type.
func DeserializeTypeFromString(typ string) (sql.ExtendedType, error) {
	serializedType, err := hex.DecodeString(typ)
	if err != nil {
		return nil, err
	}
	return extendedTypeDeserializer(serializedType)
}

// IsExtendedType returns whether the given sql.Type is an ExtendedType.
func IsExtendedType(typ sql.Type) bool {
	_, ok := typ.(sql.ExtendedType)
	return ok
}
