// Copyright 2020-2021 Dolthub, Inc.
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

package memory

import (
	"github.com/dolthub/go-mysql-server/sql"
)

const IndexDriverId = "MemoryIndexDriver"

// TestIndexDriver is a non-performant index driver meant to aid in verification of engine correctness. It can not
// create or delete indexes, but will use the index types defined in this package to alter how queries are executed,
// retrieving values from the indexes rather than from the tables directly.
type TestIndexDriver struct {
	indexes map[string][]sql.DriverIndex
	db      string
}

// NewIndexDriver returns a new index driver for database and the indexes given, keyed by the table name.
func NewIndexDriver(db string, indexes map[string][]sql.DriverIndex) *TestIndexDriver {
	return &TestIndexDriver{db: db, indexes: indexes}
}

func (d *TestIndexDriver) ID() string {
	return IndexDriverId
}

func (d *TestIndexDriver) LoadAll(ctx *sql.Context, db, table string) ([]sql.DriverIndex, error) {
	if d.db != db {
		return nil, nil
	}
	return d.indexes[table], nil
}

func (d *TestIndexDriver) Save(*sql.Context, sql.DriverIndex, sql.PartitionIndexKeyValueIter) error {
	panic("not implemented")
}

func (d *TestIndexDriver) Delete(sql.DriverIndex, sql.PartitionIter) error {
	panic("not implemented")
}

func (d *TestIndexDriver) Create(db, table, id string, expressions []sql.Expression, config map[string]string) (sql.DriverIndex, error) {
	panic("not implemented")
}
