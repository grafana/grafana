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

package mysql_db

import (
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

var errPrimaryKeyUnknownEntry = errors.NewKind("the primary key for the `%s` table was given an unknown entry")
var errPrimaryKeyUnknownSchema = errors.NewKind("the primary key for the `%s` table was given a row belonging to an unknown schema")

type mysqlTable struct {
	db   *MySQLDb
	name string
	sch  sql.Schema
}

var _ sql.Table = (*mysqlTable)(nil)

// newEmptyMySQLTable returns a new MySQL Table that does not contain any row data. Useful when you only need the
// schema of a table to exist, and don't need any data in it.
func newEmptyMySQLTable(name string, sch sql.Schema, db *MySQLDb) *mysqlTable {
	return &mysqlTable{
		name: name,
		db:   db,
		sch:  sch,
	}
}

// Name implements the interface sql.Table.
func (t *mysqlTable) Name() string {
	return t.name
}

// String implements the interface sql.Table.
func (t *mysqlTable) String() string {
	return t.name
}

// Schema implements the interface sql.Table.
func (t *mysqlTable) Schema() sql.Schema {
	return t.sch.Copy()
}

// Collation implements the interface sql.Table.
func (t *mysqlTable) Collation() sql.CollationID {
	return sql.Collation_utf8mb3_bin
}

// Partitions implements the interface sql.Table.
func (t *mysqlTable) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	return sql.PartitionsToPartitionIter(dummyPartition{}), nil
}

// PartitionRows implements the interface sql.Table.
func (t *mysqlTable) PartitionRows(ctx *sql.Context, partition sql.Partition) (sql.RowIter, error) {
	return sql.RowsToRowIter(nil), nil
}
