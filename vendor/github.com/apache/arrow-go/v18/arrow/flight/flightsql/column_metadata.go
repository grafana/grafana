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

package flightsql

import (
	"strconv"

	"github.com/apache/arrow-go/v18/arrow"
)

const (
	boolTrueStr  = "1"
	boolFalseStr = "0"
)

func boolToStr(v bool) string {
	if v {
		return boolTrueStr
	}
	return boolFalseStr
}

func strToBool(v string) bool {
	return v == boolTrueStr
}

// Metadata Key Constants
const (
	CatalogNameKey     = "ARROW:FLIGHT:SQL:CATALOG_NAME"
	SchemaNameKey      = "ARROW:FLIGHT:SQL:SCHEMA_NAME"
	TableNameKey       = "ARROW:FLIGHT:SQL:TABLE_NAME"
	TypeNameKey        = "ARROW:FLIGHT:SQL:TYPE_NAME"
	PrecisionKey       = "ARROW:FLIGHT:SQL:PRECISION"
	ScaleKey           = "ARROW:FLIGHT:SQL:SCALE"
	IsAutoIncrementKey = "ARROW:FLIGHT:SQL:IS_AUTO_INCREMENT"
	IsCaseSensitiveKey = "ARROW:FLIGHT:SQL:IS_CASE_SENSITIVE"
	IsReadOnlyKey      = "ARROW:FLIGHT:SQL:IS_READ_ONLY"
	IsSearchableKey    = "ARROW:FLIGHT:SQL:IS_SEARCHABLE"
	RemarksKey         = "ARROW:FLIGHT:SQL:REMARKS"
)

// ColumnMetadata is a helper object for managing and querying the
// standard SQL Column metadata using the expected Metadata Keys.
// It can be created by just Wrapping an existing *arrow.Metadata.
//
// Each of the methods return a value and a boolean indicating if it
// was set in the metadata or not.
type ColumnMetadata struct {
	Data *arrow.Metadata
}

func (c *ColumnMetadata) findStrVal(key string) (string, bool) {
	idx := c.Data.FindKey(key)
	if idx == -1 {
		return "", false
	}
	return c.Data.Values()[idx], true
}

func (c *ColumnMetadata) findBoolVal(key string) (bool, bool) {
	idx := c.Data.FindKey(key)
	if idx == -1 {
		return false, false
	}
	return strToBool(c.Data.Values()[idx]), true
}

func (c *ColumnMetadata) findInt32Val(key string) (int32, bool) {
	idx := c.Data.FindKey(key)
	if idx == -1 {
		return 0, false
	}
	v, err := strconv.ParseInt(c.Data.Values()[idx], 10, 32)
	if err != nil {
		return 0, false
	}
	return int32(v), true
}

func (c *ColumnMetadata) CatalogName() (string, bool) {
	return c.findStrVal(CatalogNameKey)
}

func (c *ColumnMetadata) SchemaName() (string, bool) {
	return c.findStrVal(SchemaNameKey)
}

func (c *ColumnMetadata) TableName() (string, bool) {
	return c.findStrVal(TableNameKey)
}

func (c *ColumnMetadata) TypeName() (string, bool) {
	return c.findStrVal(TypeNameKey)
}

func (c *ColumnMetadata) Precision() (int32, bool) {
	return c.findInt32Val(PrecisionKey)
}

func (c *ColumnMetadata) Scale() (int32, bool) {
	return c.findInt32Val(ScaleKey)
}

func (c *ColumnMetadata) IsAutoIncrement() (bool, bool) {
	return c.findBoolVal(IsAutoIncrementKey)
}

func (c *ColumnMetadata) IsCaseSensitive() (bool, bool) {
	return c.findBoolVal(IsCaseSensitiveKey)
}

func (c *ColumnMetadata) IsReadOnly() (bool, bool) {
	return c.findBoolVal(IsReadOnlyKey)
}

func (c *ColumnMetadata) IsSearchable() (bool, bool) {
	return c.findBoolVal(IsSearchableKey)
}

func (c *ColumnMetadata) Remarks() (string, bool) {
	return c.findStrVal(RemarksKey)
}

// ColumnMetadataBuilder is a convenience builder for constructing
// sql column metadata using the expected standard metadata keys.
// All methods return the builder itself so it can be chained
// to easily construct a final metadata object.
type ColumnMetadataBuilder struct {
	keys, vals []string
}

func NewColumnMetadataBuilder() *ColumnMetadataBuilder {
	return &ColumnMetadataBuilder{make([]string, 0), make([]string, 0)}
}

func (c *ColumnMetadataBuilder) Clear() {
	c.keys = c.keys[:0]
	c.vals = c.vals[:0]
}

func (c *ColumnMetadataBuilder) Build() ColumnMetadata {
	md := c.Metadata()
	return ColumnMetadata{&md}
}

func (c *ColumnMetadataBuilder) Metadata() arrow.Metadata {
	return arrow.NewMetadata(c.keys, c.vals)
}

func (c *ColumnMetadataBuilder) CatalogName(name string) *ColumnMetadataBuilder {
	c.keys = append(c.keys, CatalogNameKey)
	c.vals = append(c.vals, name)
	return c
}

func (c *ColumnMetadataBuilder) SchemaName(name string) *ColumnMetadataBuilder {
	c.keys = append(c.keys, SchemaNameKey)
	c.vals = append(c.vals, name)
	return c
}

func (c *ColumnMetadataBuilder) TableName(name string) *ColumnMetadataBuilder {
	c.keys = append(c.keys, TableNameKey)
	c.vals = append(c.vals, name)
	return c
}

func (c *ColumnMetadataBuilder) TypeName(name string) *ColumnMetadataBuilder {
	c.keys = append(c.keys, TypeNameKey)
	c.vals = append(c.vals, name)
	return c
}

func (c *ColumnMetadataBuilder) Precision(prec int32) *ColumnMetadataBuilder {
	c.keys = append(c.keys, PrecisionKey)
	c.vals = append(c.vals, strconv.Itoa(int(prec)))
	return c
}

func (c *ColumnMetadataBuilder) Scale(prec int32) *ColumnMetadataBuilder {
	c.keys = append(c.keys, ScaleKey)
	c.vals = append(c.vals, strconv.Itoa(int(prec)))
	return c
}

func (c *ColumnMetadataBuilder) IsAutoIncrement(v bool) *ColumnMetadataBuilder {
	c.keys = append(c.keys, IsAutoIncrementKey)
	c.vals = append(c.vals, boolToStr(v))
	return c
}

func (c *ColumnMetadataBuilder) IsCaseSensitive(v bool) *ColumnMetadataBuilder {
	c.keys = append(c.keys, IsCaseSensitiveKey)
	c.vals = append(c.vals, boolToStr(v))
	return c
}

func (c *ColumnMetadataBuilder) IsReadOnly(v bool) *ColumnMetadataBuilder {
	c.keys = append(c.keys, IsReadOnlyKey)
	c.vals = append(c.vals, boolToStr(v))
	return c
}

func (c *ColumnMetadataBuilder) IsSearchable(v bool) *ColumnMetadataBuilder {
	c.keys = append(c.keys, IsSearchableKey)
	c.vals = append(c.vals, boolToStr(v))
	return c
}

func (c *ColumnMetadataBuilder) Remarks(remarks string) *ColumnMetadataBuilder {
	c.keys = append(c.keys, RemarksKey)
	c.vals = append(c.vals, remarks)
	return c
}
