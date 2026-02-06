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
	"errors"

	"github.com/dolthub/vitess/go/sqltypes"

	. "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// newMySQLTablesTable returns a InformationSchemaTable for MySQL.
func newMySQLTablesTable() *InformationSchemaTable {
	return &InformationSchemaTable{
		TableName:   TablesTableName,
		TableSchema: tablesSchema,
		Reader:      tablesRowIter,
	}
}

// NewTablesTable is used by Doltgres to inject its correct schema and row
// iter. In Dolt, this just returns the current tables table implementation.
var NewTablesTable = newMySQLTablesTable

// tablesSchema is the schema for the information_schema.TABLES table.
var tablesSchema = Schema{
	{Name: "TABLE_CATALOG", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "TABLE_SCHEMA", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "TABLE_NAME", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "TABLE_TYPE", Type: types.MustCreateEnumType([]string{"BASE TABLE", "VIEW", "SYSTEM VIEW"}, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: TablesTableName},
	{Name: "ENGINE", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "VERSION", Type: types.Int32, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "ROW_FORMAT", Type: types.MustCreateEnumType([]string{"Fixed", "Dynamic", "Compressed", "Redundant", "Compact", "Paged"}, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "TABLE_ROWS", Type: types.Uint64, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "AVG_ROW_LENGTH", Type: types.Uint64, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "DATA_LENGTH", Type: types.Uint64, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "MAX_DATA_LENGTH", Type: types.Uint64, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "INDEX_LENGTH", Type: types.Uint64, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "DATA_FREE", Type: types.Uint64, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "AUTO_INCREMENT", Type: types.Uint64, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "CREATE_TIME", Type: types.Timestamp, Default: nil, Nullable: false, Source: TablesTableName},
	{Name: "UPDATE_TIME", Type: types.Datetime, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "CHECK_TIME", Type: types.Datetime, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "TABLE_COLLATION", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "CHECKSUM", Type: types.Int64, Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "CREATE_OPTIONS", Type: types.MustCreateString(sqltypes.VarChar, 256, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: TablesTableName},
	{Name: "TABLE_COMMENT", Type: types.Text, Default: nil, Nullable: true, Source: TablesTableName},
}

// tablesRowIter implements the sql.RowIter for the information_schema.TABLES table.
func tablesRowIter(ctx *Context, cat Catalog) (RowIter, error) {
	var rows []Row
	var (
		tableType      uint16
		tableRows      uint64
		avgRowLength   uint64
		dataLength     uint64
		engine         interface{}
		rowFormat      interface{}
		tableCollation interface{}
		autoInc        interface{}
	)

	databases, err := AllDatabasesWithNames(ctx, cat, true)
	if err != nil {
		return nil, err
	}

	for _, db := range databases {
		if db.Database.Name() == InformationSchemaDatabaseName {
			tableType = 3 // SYSTEM_VIEW
		} else {
			tableType = 1 // BASE_TABLE
			engine = "InnoDB"
			rowFormat = "Dynamic"
		}

		y2k, _, _ := types.Timestamp.Convert(ctx, "2000-01-01 00:00:00")
		err := DBTableIter(ctx, db.Database, func(t Table) (cont bool, err error) {
			tableCollation = t.Collation().String()
			comment := ""
			if db.Database.Name() != InformationSchemaDatabaseName {
				if st, ok := t.(StatisticsTable); ok {
					tableRows, _, err = st.RowCount(ctx)
					if err != nil {
						return false, err
					}

					// TODO: correct values for avg_row_length, data_length, max_data_length are missing (current values varies on gms vs Dolt)
					//  index_length and data_free columns are not supported yet
					//  the data length values differ from MySQL
					// MySQL uses default page size (16384B) as data length, and it adds another page size, if table data fills the current page block.
					// https://stackoverflow.com/questions/34211377/average-row-length-higher-than-possible has good explanation.
					dataLength, err = st.DataLength(ctx)
					if err != nil {
						return false, err
					}

					if tableRows > uint64(0) {
						avgRowLength = dataLength / tableRows
					}
				}

				if ai, ok := t.(AutoIncrementTable); ok {
					autoInc, err = ai.PeekNextAutoIncrementValue(ctx)
					if !errors.Is(err, ErrNoAutoIncrementCol) && err != nil {
						return false, err
					}

					// table with no auto incremented column is qualified as AutoIncrementTable, and the nextAutoInc value is 0
					// table with auto incremented column and no rows, the nextAutoInc value is 1
					if autoInc == uint64(0) || autoInc == uint64(1) {
						autoInc = nil
					}
				}

				if commentedTable, ok := t.(CommentedTable); ok {
					comment = commentedTable.Comment()
				}
			}

			rows = append(rows, Row{
				db.CatalogName, // table_catalog
				db.SchemaName,  // table_schema
				t.Name(),       // table_name
				tableType,      // table_type
				engine,         // engine
				10,             // version (protocol, always 10)
				rowFormat,      // row_format
				tableRows,      // table_rows
				avgRowLength,   // avg_row_length
				dataLength,     // data_length
				0,              // max_data_length
				0,              // index_length
				0,              // data_free
				autoInc,        // auto_increment
				y2k,            // create_time
				y2k,            // update_time
				nil,            // check_time
				tableCollation, // table_collation
				nil,            // checksum
				"",             // create_options
				comment,        // table_comment
			})

			return true, nil
		})

		if err != nil {
			return nil, err
		}

		views, err := ViewsInDatabase(ctx, db.Database)
		if err != nil {
			return nil, err
		}

		for _, view := range views {
			rows = append(rows, Row{
				db.CatalogName, // table_catalog
				db.SchemaName,  // table_schema
				view.Name,      // table_name
				"VIEW",         // table_type
				nil,            // engine
				nil,            // version (protocol, always 10)
				nil,            // row_format
				nil,            // table_rows
				nil,            // avg_row_length
				nil,            // data_length
				nil,            // max_data_length
				nil,            // max_data_length
				nil,            // data_free
				nil,            // auto_increment
				y2k,            // create_time
				nil,            // update_time
				nil,            // check_time
				nil,            // table_collation
				nil,            // checksum
				nil,            // create_options
				"VIEW",         // table_comment
			})
		}
	}

	return RowsToRowIter(rows...), nil
}
