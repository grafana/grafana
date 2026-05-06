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

package plan

import "github.com/dolthub/go-mysql-server/sql"

// DummyResolvedDB is a transient database useful only for instances where a database is not available but required.
// No tables are persisted, nor will be returned.
type DummyResolvedDB struct {
	name string
}

var _ sql.Database = (*DummyResolvedDB)(nil)
var _ sql.TableCreator = (*DummyResolvedDB)(nil)
var _ sql.TableDropper = (*DummyResolvedDB)(nil)
var _ sql.TableRenamer = (*DummyResolvedDB)(nil)

// NewDummyResolvedDB creates a new dummy database with the given name.
func NewDummyResolvedDB(name string) *DummyResolvedDB {
	return &DummyResolvedDB{
		name: name,
	}
}

func (d *DummyResolvedDB) Name() string { return d.name }

func (d *DummyResolvedDB) Tables() map[string]sql.Table { return nil }

func (d *DummyResolvedDB) GetTableInsensitive(ctx *sql.Context, tblName string) (sql.Table, bool, error) {
	return nil, false, nil
}

func (d *DummyResolvedDB) GetTableNames(ctx *sql.Context) ([]string, error) { return nil, nil }

func (d *DummyResolvedDB) AddTable(name string, t sql.Table) {}

func (d *DummyResolvedDB) CreateTable(ctx *sql.Context, name string, schema sql.PrimaryKeySchema, collation sql.CollationID, comment string) error {
	return nil
}

func (d *DummyResolvedDB) DropTable(ctx *sql.Context, name string) error { return nil }

func (d *DummyResolvedDB) RenameTable(ctx *sql.Context, oldName, newName string) error { return nil }
