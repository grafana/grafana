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

// Package schema_ref contains the expected reference Schemas to be used
// by FlightSQL servers and clients.
package schema_ref

import "github.com/apache/arrow-go/v18/arrow"

var (
	Catalogs = arrow.NewSchema(
		[]arrow.Field{{Name: "catalog_name", Type: arrow.BinaryTypes.String}}, nil)
	DBSchemas = arrow.NewSchema([]arrow.Field{
		{Name: "catalog_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "db_schema_name", Type: arrow.BinaryTypes.String},
	}, nil)
	Tables = arrow.NewSchema([]arrow.Field{
		{Name: "catalog_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "db_schema_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "table_name", Type: arrow.BinaryTypes.String},
		{Name: "table_type", Type: arrow.BinaryTypes.String},
	}, nil)
	TablesWithIncludedSchema = arrow.NewSchema([]arrow.Field{
		{Name: "catalog_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "db_schema_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "table_name", Type: arrow.BinaryTypes.String},
		{Name: "table_type", Type: arrow.BinaryTypes.String},
		{Name: "table_schema", Type: arrow.BinaryTypes.Binary},
	}, nil)
	TableTypes = arrow.NewSchema([]arrow.Field{
		{Name: "table_type", Type: arrow.BinaryTypes.String},
	}, nil)
	PrimaryKeys = arrow.NewSchema([]arrow.Field{
		{Name: "catalog_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "db_schema_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "table_name", Type: arrow.BinaryTypes.String},
		{Name: "column_name", Type: arrow.BinaryTypes.String},
		{Name: "key_sequence", Type: arrow.PrimitiveTypes.Int32},
		{Name: "key_name", Type: arrow.BinaryTypes.String, Nullable: true},
	}, nil)
	ImportedExportedKeysAndCrossReference = arrow.NewSchema([]arrow.Field{
		{Name: "pk_catalog_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "pk_db_schema_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "pk_table_name", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "pk_column_name", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "fk_catalog_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "fk_db_schema_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "fk_table_name", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "fk_column_name", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "key_sequence", Type: arrow.PrimitiveTypes.Int32, Nullable: false},
		{Name: "fk_key_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "pk_key_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "update_rule", Type: arrow.PrimitiveTypes.Uint8, Nullable: false},
		{Name: "delete_rule", Type: arrow.PrimitiveTypes.Uint8, Nullable: false},
	}, nil)
	ImportedKeys   = ImportedExportedKeysAndCrossReference
	ExportedKeys   = ImportedExportedKeysAndCrossReference
	CrossReference = ImportedExportedKeysAndCrossReference
	SqlInfo        = arrow.NewSchema([]arrow.Field{
		{Name: "info_name", Type: arrow.PrimitiveTypes.Uint32},
		{Name: "value", Type: arrow.DenseUnionOf([]arrow.Field{
			{Name: "string_value", Type: arrow.BinaryTypes.String},
			{Name: "bool_value", Type: arrow.FixedWidthTypes.Boolean},
			{Name: "bigint_value", Type: arrow.PrimitiveTypes.Int64},
			{Name: "int32_bitmask", Type: arrow.PrimitiveTypes.Int32},
			{Name: "string_list", Type: arrow.ListOf(arrow.BinaryTypes.String)},
			{Name: "int32_to_int32_list_map",
				Type: arrow.MapOf(arrow.PrimitiveTypes.Int32,
					arrow.ListOf(arrow.PrimitiveTypes.Int32))},
		}, []arrow.UnionTypeCode{0, 1, 2, 3, 4, 5})},
	}, nil)
	XdbcTypeInfo = arrow.NewSchema([]arrow.Field{
		{Name: "type_name", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "data_type", Type: arrow.PrimitiveTypes.Int32, Nullable: false},
		{Name: "column_size", Type: arrow.PrimitiveTypes.Int32, Nullable: true},
		{Name: "literal_prefix", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "literal_suffix", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "create_params", Type: arrow.ListOfField(arrow.Field{Name: "item", Type: arrow.BinaryTypes.String, Nullable: false}), Nullable: true},
		{Name: "nullable", Type: arrow.PrimitiveTypes.Int32, Nullable: false},
		{Name: "case_sensitive", Type: arrow.FixedWidthTypes.Boolean, Nullable: false},
		{Name: "searchable", Type: arrow.PrimitiveTypes.Int32, Nullable: false},
		{Name: "unsigned_attribute", Type: arrow.FixedWidthTypes.Boolean, Nullable: true},
		{Name: "fixed_prec_scale", Type: arrow.FixedWidthTypes.Boolean, Nullable: false},
		{Name: "auto_increment", Type: arrow.FixedWidthTypes.Boolean, Nullable: true},
		{Name: "local_type_name", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "minimum_scale", Type: arrow.PrimitiveTypes.Int32, Nullable: true},
		{Name: "maximum_scale", Type: arrow.PrimitiveTypes.Int32, Nullable: true},
		{Name: "sql_data_type", Type: arrow.PrimitiveTypes.Int32, Nullable: false},
		{Name: "datetime_subcode", Type: arrow.PrimitiveTypes.Int32, Nullable: true},
		{Name: "num_prec_radix", Type: arrow.PrimitiveTypes.Int32, Nullable: true},
		{Name: "interval_precision", Type: arrow.PrimitiveTypes.Int32, Nullable: true},
	}, nil)
)
