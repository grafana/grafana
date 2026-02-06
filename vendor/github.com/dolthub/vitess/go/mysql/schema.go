/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mysql

import (
	"fmt"

	"github.com/dolthub/vitess/go/sqltypes"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

// This file provides a few utility variables and methods, mostly for tests.
// The assumptions made about the types of fields and data returned
// by MySQl are validated in schema_test.go. This way all tests
// can use these variables and methods to simulate a MySQL server
// (using fakesqldb/ package for instance) and still be guaranteed correct
// data.

// DescribeTableFields contains the fields returned by a
// 'describe <table>' command. They are validated by the testDescribeTable
// test.
// Column lengths returned seem to differ between versions. So, we
// don't compare them.
var DescribeTableFields = []*querypb.Field{
	{
		Name:         "Field",
		Type:         querypb.Type_VARCHAR,
		Table:        "COLUMNS",
		OrgTable:     "COLUMNS",
		Database:     "information_schema",
		OrgName:      "COLUMN_NAME",
		ColumnLength: 0,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "Type",
		Type:         querypb.Type_TEXT,
		Table:        "COLUMNS",
		OrgTable:     "COLUMNS",
		Database:     "information_schema",
		OrgName:      "COLUMN_TYPE",
		ColumnLength: 0,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG | querypb.MySqlFlag_BLOB_FLAG),
	},
	{
		Name:         "Null",
		Type:         querypb.Type_VARCHAR,
		Table:        "COLUMNS",
		OrgTable:     "COLUMNS",
		Database:     "information_schema",
		OrgName:      "IS_NULLABLE",
		ColumnLength: 0,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "Key",
		Type:         querypb.Type_VARCHAR,
		Table:        "COLUMNS",
		OrgTable:     "COLUMNS",
		Database:     "information_schema",
		OrgName:      "COLUMN_KEY",
		ColumnLength: 0,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "Default",
		Type:         querypb.Type_TEXT,
		Table:        "COLUMNS",
		OrgTable:     "COLUMNS",
		Database:     "information_schema",
		OrgName:      "COLUMN_DEFAULT",
		ColumnLength: 0,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_BLOB_FLAG),
	},
	{
		Name:         "Extra",
		Type:         querypb.Type_VARCHAR,
		Table:        "COLUMNS",
		OrgTable:     "COLUMNS",
		Database:     "information_schema",
		OrgName:      "EXTRA",
		ColumnLength: 0,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
}

// DescribeTableRow returns a row for a 'describe table' command.
// 'name' is the name of the field.
// 'type' is the type of the field. Something like:
//   'int(11)' for 'int'
//   'int(10) unsigned' for 'int unsigned'
//   'bigint(20)' for 'bigint'
//   'bigint(20) unsigned' for 'bigint unsigned'
//   'varchar(128)'
// 'null' is true if the field can be NULL.
// 'key' is either:
//    - 'PRI' if part of the primary key. If not:
//    - 'UNI' if part of a unique index. If not:
//    - 'MUL' if part of a non-unique index. If not:
//    - empty if part of no key / index.
// 'def' is the default value for the field. Empty if NULL default.
func DescribeTableRow(name string, typ string, null bool, key string, def string) []sqltypes.Value {
	nullStr := "NO"
	if null {
		nullStr = "YES"
	}
	defCell := sqltypes.NULL
	if def != "" {
		defCell = sqltypes.MakeTrusted(sqltypes.Text, []byte(def))
	}
	return []sqltypes.Value{
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(name)),
		sqltypes.MakeTrusted(sqltypes.Text, []byte(typ)),
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(nullStr)),
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(key)),
		defCell,
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte("")), //extra
	}
}

// ShowIndexFromTableFields contains the fields returned by a 'show
// index from <table>' command. They are validated by the
// testShowIndexFromTable test.
var ShowIndexFromTableFields = []*querypb.Field{
	{
		Name:         "Table",
		Type:         querypb.Type_VARCHAR,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "TABLE_NAME",
		ColumnLength: 192,
		Charset:      CharacterSetUtf8,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "Non_unique",
		Type:         querypb.Type_INT64,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "NON_UNIQUE",
		ColumnLength: 1,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG | querypb.MySqlFlag_NUM_FLAG),
	},
	{
		Name:         "Key_name",
		Type:         querypb.Type_VARCHAR,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "INDEX_NAME",
		ColumnLength: 192,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "Seq_in_index",
		Type:         querypb.Type_INT64,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "SEQ_IN_INDEX",
		ColumnLength: 2,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG | querypb.MySqlFlag_NUM_FLAG),
	},
	{
		Name:         "Column_name",
		Type:         querypb.Type_VARCHAR,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "COLUMN_NAME",
		ColumnLength: 192,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "Collation",
		Type:         querypb.Type_VARCHAR,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "COLLATION",
		ColumnLength: 3,
		Charset:      33,
	},
	{
		Name:         "Cardinality",
		Type:         querypb.Type_INT64,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "CARDINALITY",
		ColumnLength: 21,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_NUM_FLAG),
	},
	{
		Name:         "Sub_part",
		Type:         querypb.Type_INT64,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "SUB_PART",
		ColumnLength: 3,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_NUM_FLAG),
	},
	{
		Name:         "Packed",
		Type:         querypb.Type_VARCHAR,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "PACKED",
		ColumnLength: 30,
		Charset:      33,
	},
	{
		Name:         "Null",
		Type:         querypb.Type_VARCHAR,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "NULLABLE",
		ColumnLength: 9,
		Charset:      33,
		Flags:        1,
	},
	{
		Name:         "Index_type",
		Type:         querypb.Type_VARCHAR,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "INDEX_TYPE",
		ColumnLength: 48,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "Comment",
		Type:         querypb.Type_VARCHAR,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "COMMENT",
		ColumnLength: 48,
		Charset:      33,
	},
	{
		Name:         "Index_comment",
		Type:         querypb.Type_VARCHAR,
		Table:        "STATISTICS",
		OrgTable:     "STATISTICS",
		Database:     "information_schema",
		OrgName:      "INDEX_COMMENT",
		ColumnLength: 3072,
		Charset:      33,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
}

// ShowIndexFromTableRow returns the fields from a 'show index from table'
// command.
// 'table' is the table name.
// 'unique' is true for unique indexes, false for non-unique indexes.
// 'keyName' is 'PRIMARY' for PKs, otherwise the name of the index.
// 'seqInIndex' is starting at 1 for first key in index.
// 'columnName' is the name of the column this index applies to.
// 'nullable' is true if this column can be null.
func ShowIndexFromTableRow(table string, unique bool, keyName string, seqInIndex int, columnName string, nullable bool) []sqltypes.Value {
	nonUnique := "1"
	if unique {
		nonUnique = "0"
	}
	nullableStr := ""
	if nullable {
		nullableStr = "YES"
	}
	return []sqltypes.Value{
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(table)),
		sqltypes.MakeTrusted(sqltypes.Int64, []byte(nonUnique)),
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(keyName)),
		sqltypes.MakeTrusted(sqltypes.Int64, []byte(fmt.Sprintf("%v", seqInIndex))),
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(columnName)),
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte("A")), // Collation
		sqltypes.MakeTrusted(sqltypes.Int64, []byte("0")),   // Cardinality
		sqltypes.NULL, // Sub_part
		sqltypes.NULL, // Packed
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(nullableStr)),
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte("BTREE")), // Index_type
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte("")),      // Comment
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte("")),      // Index_comment
	}
}

// BaseShowTables is the base query used in further methods.
const BaseShowTables = "SELECT table_name, table_type, unix_timestamp(create_time), table_comment, table_rows, data_length, index_length, data_free, max_data_length FROM information_schema.tables WHERE table_schema = database()"

// BaseShowTablesForTable specializes BaseShowTables for a single table.
func BaseShowTablesForTable(table string) string {
	return fmt.Sprintf("%s and table_name = '%s'", BaseShowTables, table)
}

// BaseShowTablesFields contains the fields returned by a BaseShowTables or a BaseShowTablesForTable command.
// They are validated by the
// testBaseShowTables test.
var BaseShowTablesFields = []*querypb.Field{
	{
		Name:         "table_name",
		Type:         querypb.Type_VARCHAR,
		Table:        "tables",
		OrgTable:     "TABLES",
		Database:     "information_schema",
		OrgName:      "TABLE_NAME",
		ColumnLength: 192,
		Charset:      CharacterSetUtf8,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "table_type",
		Type:         querypb.Type_VARCHAR,
		Table:        "tables",
		OrgTable:     "TABLES",
		Database:     "information_schema",
		OrgName:      "TABLE_TYPE",
		ColumnLength: 192,
		Charset:      CharacterSetUtf8,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "unix_timestamp(create_time)",
		Type:         querypb.Type_INT64,
		ColumnLength: 11,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_BINARY_FLAG | querypb.MySqlFlag_NUM_FLAG),
	},
	{
		Name:         "table_comment",
		Type:         querypb.Type_VARCHAR,
		Table:        "tables",
		OrgTable:     "TABLES",
		Database:     "information_schema",
		OrgName:      "TABLE_COMMENT",
		ColumnLength: 6144,
		Charset:      CharacterSetUtf8,
		Flags:        uint32(querypb.MySqlFlag_NOT_NULL_FLAG),
	},
	{
		Name:         "table_rows",
		Type:         querypb.Type_UINT64,
		Table:        "tables",
		OrgTable:     "TABLES",
		Database:     "information_schema",
		OrgName:      "TABLE_ROWS",
		ColumnLength: 21,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_UNSIGNED_FLAG | querypb.MySqlFlag_NUM_FLAG),
	},
	{
		Name:         "data_length",
		Type:         querypb.Type_UINT64,
		Table:        "tables",
		OrgTable:     "TABLES",
		Database:     "information_schema",
		OrgName:      "DATA_LENGTH",
		ColumnLength: 21,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_UNSIGNED_FLAG | querypb.MySqlFlag_NUM_FLAG),
	},
	{
		Name:         "index_length",
		Type:         querypb.Type_UINT64,
		Table:        "tables",
		OrgTable:     "TABLES",
		Database:     "information_schema",
		OrgName:      "INDEX_LENGTH",
		ColumnLength: 21,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_UNSIGNED_FLAG | querypb.MySqlFlag_NUM_FLAG),
	},
	{
		Name:         "data_free",
		Type:         querypb.Type_UINT64,
		Table:        "tables",
		OrgTable:     "TABLES",
		Database:     "information_schema",
		OrgName:      "DATA_FREE",
		ColumnLength: 21,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_UNSIGNED_FLAG | querypb.MySqlFlag_NUM_FLAG),
	},
	{
		Name:         "max_data_length",
		Type:         querypb.Type_UINT64,
		Table:        "tables",
		OrgTable:     "TABLES",
		Database:     "information_schema",
		OrgName:      "MAX_DATA_LENGTH",
		ColumnLength: 21,
		Charset:      CharacterSetBinary,
		Flags:        uint32(querypb.MySqlFlag_UNSIGNED_FLAG | querypb.MySqlFlag_NUM_FLAG),
	},
}

// BaseShowTablesRow returns the fields from a BaseShowTables or
// BaseShowTablesForTable command.
func BaseShowTablesRow(tableName string, isView bool, comment string) []sqltypes.Value {
	tableType := "BASE TABLE"
	if isView {
		tableType = "VIEW"
	}
	return []sqltypes.Value{
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(tableName)),
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(tableType)),
		sqltypes.MakeTrusted(sqltypes.Int64, []byte("1427325875")), // unix_timestamp(create_time)
		sqltypes.MakeTrusted(sqltypes.VarChar, []byte(comment)),
		sqltypes.MakeTrusted(sqltypes.Uint64, []byte("0")), // table_rows
		sqltypes.MakeTrusted(sqltypes.Uint64, []byte("0")), // data_length
		sqltypes.MakeTrusted(sqltypes.Uint64, []byte("0")), // index_length
		sqltypes.MakeTrusted(sqltypes.Uint64, []byte("0")), // data_free
		sqltypes.MakeTrusted(sqltypes.Uint64, []byte("0")), // max_data_length
	}
}
