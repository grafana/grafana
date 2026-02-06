// Copyright 2022 Dolthub, Inc.
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

package information_schema

import (
	"github.com/dolthub/vitess/go/sqltypes"

	. "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// newMySQLSchemataTable returns a InformationSchemaTable for MySQL.
func newMySQLSchemataTable() *InformationSchemaTable {
	return &InformationSchemaTable{
		TableName:   SchemataTableName,
		TableSchema: schemataSchema,
		Reader:      schemataRowIter,
	}
}

// NewSchemataTable is used by Doltgres to inject its correct schema and row
// iter. In Dolt, this just returns the current schemata table implementation.
var NewSchemataTable = newMySQLSchemataTable

// schemataSchema is the schema for the information_schema.SCHEMATA table.
var schemataSchema = Schema{
	{Name: "CATALOG_NAME", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: SchemataTableName},
	{Name: "SCHEMA_NAME", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: SchemataTableName},
	{Name: "DEFAULT_CHARACTER_SET_NAME", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: SchemataTableName},
	{Name: "DEFAULT_COLLATION_NAME", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: SchemataTableName},
	{Name: "SQL_PATH", Type: types.MustCreateBinary(sqltypes.Binary, 0), Default: nil, Nullable: true, Source: SchemataTableName},
	{Name: "DEFAULT_ENCRYPTION", Type: types.MustCreateEnumType([]string{"NO", "YES"}, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: SchemataTableName},
}

// schemataRowIter implements the sql.RowIter for the information_schema.SCHEMATA table.
func schemataRowIter(ctx *Context, c Catalog) (RowIter, error) {
	dbs, err := AllDatabasesWithNames(ctx, c, false)
	if err != nil {
		return nil, err
	}

	var rows []Row

	for _, db := range dbs {
		collation := plan.GetDatabaseCollation(ctx, db.Database)
		rows = append(rows, Row{
			db.CatalogName,                    // catalog_name
			db.SchemaName,                     // schema_name
			collation.CharacterSet().String(), // default_character_set_name
			collation.String(),                // default_collation_name
			nil,                               // sql_path
			"NO",                              // default_encryption
		})
	}

	return RowsToRowIter(rows...), nil
}
