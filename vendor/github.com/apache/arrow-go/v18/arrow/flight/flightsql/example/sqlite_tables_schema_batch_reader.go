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

//go:build go1.18
// +build go1.18

package example

import (
	"context"
	"database/sql"
	"strings"
	"sync/atomic"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/flight"
	"github.com/apache/arrow-go/v18/arrow/flight/flightsql"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	sqlite3 "modernc.org/sqlite/lib"
)

type SqliteTablesSchemaBatchReader struct {
	refCount atomic.Int64

	mem        memory.Allocator
	ctx        context.Context
	rdr        array.RecordReader
	stmt       *sql.Stmt
	schemaBldr *array.BinaryBuilder
	record     arrow.Record
	err        error
}

func NewSqliteTablesSchemaBatchReader(ctx context.Context, mem memory.Allocator, rdr array.RecordReader, db *sql.DB, mainQuery string) (*SqliteTablesSchemaBatchReader, error) {
	schemaQuery := `SELECT table_name, name, type, [notnull] 
					FROM pragma_table_info(table_name)
					JOIN (` + mainQuery + `) WHERE table_name = ?`

	stmt, err := db.PrepareContext(ctx, schemaQuery)
	if err != nil {
		rdr.Release()
		return nil, err
	}

	stsbr := &SqliteTablesSchemaBatchReader{
		ctx:        ctx,
		rdr:        rdr,
		stmt:       stmt,
		mem:        mem,
		schemaBldr: array.NewBinaryBuilder(mem, arrow.BinaryTypes.Binary),
	}
	stsbr.refCount.Add(1)
	return stsbr, nil
}

func (s *SqliteTablesSchemaBatchReader) Err() error { return s.err }

func (s *SqliteTablesSchemaBatchReader) Retain() { s.refCount.Add(1) }

func (s *SqliteTablesSchemaBatchReader) Release() {
	debug.Assert(s.refCount.Load() > 0, "too many releases")

	if s.refCount.Add(-1) == 0 {
		s.rdr.Release()
		s.stmt.Close()
		s.schemaBldr.Release()
		if s.record != nil {
			s.record.Release()
			s.record = nil
		}
	}
}

func (s *SqliteTablesSchemaBatchReader) Schema() *arrow.Schema {
	fields := append(s.rdr.Schema().Fields(),
		arrow.Field{Name: "table_schema", Type: arrow.BinaryTypes.Binary})
	return arrow.NewSchema(fields, nil)
}

func (s *SqliteTablesSchemaBatchReader) Record() arrow.Record { return s.record }

func getSqlTypeFromTypeName(sqltype string) int {
	if sqltype == "" {
		return sqlite3.SQLITE_NULL
	}

	sqltype = strings.ToLower(sqltype)

	if strings.HasPrefix(sqltype, "varchar") || strings.HasPrefix(sqltype, "char") {
		return sqlite3.SQLITE_TEXT
	}

	switch sqltype {
	case "int", "integer":
		return sqlite3.SQLITE_INTEGER
	case "real":
		return sqlite3.SQLITE_FLOAT
	case "blob":
		return sqlite3.SQLITE_BLOB
	case "text", "date":
		return sqlite3.SQLITE_TEXT
	default:
		return sqlite3.SQLITE_NULL
	}
}

func getPrecisionFromCol(sqltype int) int {
	switch sqltype {
	case sqlite3.SQLITE_INTEGER:
		return 10
	case sqlite3.SQLITE_FLOAT:
		return 15
	}
	return 0
}

func getColumnMetadata(bldr *flightsql.ColumnMetadataBuilder, sqltype int, table string) arrow.Metadata {
	defer bldr.Clear()

	bldr.Scale(15).IsReadOnly(false).IsAutoIncrement(false)
	if table != "" {
		bldr.TableName(table)
	}
	switch sqltype {
	case sqlite3.SQLITE_TEXT, sqlite3.SQLITE_BLOB:
	default:
		bldr.Precision(int32(getPrecisionFromCol(sqltype)))
	}

	return bldr.Metadata()
}

func (s *SqliteTablesSchemaBatchReader) Next() bool {
	if s.record != nil {
		s.record.Release()
		s.record = nil
	}

	if !s.rdr.Next() {
		return false
	}

	rec := s.rdr.Record()
	tableNameArr := rec.Column(rec.Schema().FieldIndices("table_name")[0]).(*array.String)

	bldr := flightsql.NewColumnMetadataBuilder()
	columnFields := make([]arrow.Field, 0)
	for i := 0; i < tableNameArr.Len(); i++ {
		table := tableNameArr.Value(i)
		rows, err := s.stmt.QueryContext(s.ctx, table)
		if err != nil {
			s.err = err
			return false
		}

		var tableName, name, typ string
		var nn int
		for rows.Next() {
			if err := rows.Scan(&tableName, &name, &typ, &nn); err != nil {
				rows.Close()
				s.err = err
				return false
			}

			columnFields = append(columnFields, arrow.Field{
				Name:     name,
				Type:     getArrowTypeFromString(typ),
				Nullable: nn == 0,
				Metadata: getColumnMetadata(bldr, getSqlTypeFromTypeName(typ), tableName),
			})
		}

		rows.Close()
		if rows.Err() != nil {
			s.err = rows.Err()
			return false
		}
		val := flight.SerializeSchema(arrow.NewSchema(columnFields, nil), s.mem)
		s.schemaBldr.Append(val)

		columnFields = columnFields[:0]
	}

	schemaCol := s.schemaBldr.NewArray()
	defer schemaCol.Release()

	s.record = array.NewRecord(s.Schema(), append(rec.Columns(), schemaCol), rec.NumRows())
	return true
}
