// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pqarrow

import (
	"fmt"
	"reflect"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

// variantArray is an experimental extension type, but is not yet fully supported.
type variantArray struct {
	array.ExtensionArrayBase
}

// variantExtensionType is experimental extension type that supports
// semi-structured objects that can be composed of primitives, arrays, and
// objects which can be queried by path.
//
// Unshredded variant representation:
//
//	optional group variant_name (VARIANT) {
//	  required binary metadata;
//	  required binary value;
//	}
//
// To read more about variant encoding, see the variant encoding spec at
// https://github.com/apache/parquet-format/blob/master/VariantEncoding.md
//
// To read more about variant shredding, see the variant shredding spec at
// https://github.com/apache/parquet-format/blob/master/VariantShredding.md
type variantExtensionType struct {
	arrow.ExtensionBase

	// TODO: add shredded_value
	metadata arrow.Field
	value    arrow.Field
}

func (*variantExtensionType) ParquetLogicalType() schema.LogicalType {
	return schema.VariantLogicalType{}
}

func isBinaryField(f arrow.Field) bool {
	return f.Type.ID() == arrow.BINARY || f.Type.ID() == arrow.LARGE_BINARY
}

func isSupportedVariantStorage(dt arrow.DataType) bool {
	// for now we only support unshredded variants. unshredded vairant storage
	// type should be a struct with a binary metadata and binary value.
	//
	// In shredded variants, the binary value field can be replaced
	// with one or more of the following: object, array, typed_value, and variant_value.
	s, ok := dt.(*arrow.StructType)
	if !ok {
		return false
	}

	if s.NumFields() != 2 {
		return false
	}

	// ordering of metadata and value fields does not matter, as we will
	// assign these to the variant extension type's members.
	// here we just need to check that both are present.
	metadataField, ok := s.FieldByName("metadata")
	if !ok {
		return false
	}

	valueField, ok := s.FieldByName("value")
	if !ok {
		return false
	}

	// both must be non-nullable binary types for unshredded variants for now
	return isBinaryField(metadataField) && isBinaryField(valueField) &&
		!metadataField.Nullable && !valueField.Nullable
}

// NOTE: this is still experimental, a future change will add shredding support.
func newVariantType(storageType arrow.DataType) (*variantExtensionType, error) {
	if !isSupportedVariantStorage(storageType) {
		return nil, fmt.Errorf("%w: invalid storage type for unshredded variant: %s",
			arrow.ErrInvalid, storageType.String())
	}

	var (
		mdField, valField arrow.Field
	)

	// shredded variants will eventually need to handle an optional shredded_value
	// as well as value being optional
	dt := storageType.(*arrow.StructType)
	if dt.Field(0).Name == "metadata" {
		mdField = dt.Field(0)
		valField = dt.Field(1)
	} else {
		mdField = dt.Field(1)
		valField = dt.Field(0)
	}

	return &variantExtensionType{
		ExtensionBase: arrow.ExtensionBase{Storage: storageType},
		metadata:      mdField,
		value:         valField,
	}, nil
}

func (v *variantExtensionType) Metadata() arrow.Field { return v.metadata }
func (v *variantExtensionType) Value() arrow.Field    { return v.value }

func (*variantExtensionType) ArrayType() reflect.Type {
	return reflect.TypeOf(variantArray{})
}

func (*variantExtensionType) ExtensionName() string {
	return "parquet.variant"
}

func (v *variantExtensionType) String() string {
	return fmt.Sprintf("extension<%s>", v.ExtensionName())
}

func (v *variantExtensionType) ExtensionEquals(other arrow.ExtensionType) bool {
	return v.ExtensionName() == other.ExtensionName() &&
		arrow.TypeEqual(v.Storage, other.StorageType())
}

func (*variantExtensionType) Serialize() string { return "" }
func (*variantExtensionType) Deserialize(storageType arrow.DataType, _ string) (arrow.ExtensionType, error) {
	return newVariantType(storageType)
}
