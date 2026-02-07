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

package sql

import (
	"reflect"
	"strings"

	"gopkg.in/src-d/go-errors.v1"
)

var (
	// ErrUnexpectedType is thrown when a received type is not the expected
	ErrUnexpectedType = errors.NewKind("value at %d has unexpected type: %s")
)

// MaxIdentifierLength is the maximum number of characters permissible in MySQL identifiers, like column or table names
const MaxIdentifierLength = 64

// Schema is the definition of a table.
type Schema []*Column

// CheckRow checks the row conforms to the schema.
func (s Schema) CheckRow(ctx *Context, row Row) error {
	expected := len(s)
	got := len(row)
	if expected != got {
		return ErrUnexpectedRowLength.New(expected, got)
	}

	for idx, f := range s {
		v := row[idx]
		if f.Check(ctx, v) {
			continue
		}

		typ := reflect.TypeOf(v).String()
		return ErrUnexpectedType.New(idx, typ)
	}

	return nil
}

// HasVirtualColumns returns whether the schema has any virtual columns
func (s Schema) HasVirtualColumns() bool {
	for _, col := range s {
		if col.Virtual {
			return true
		}
	}
	return false
}

// PhysicalSchema returns a schema with only the physical (non-virtual) columns
func (s Schema) PhysicalSchema() Schema {
	var physical Schema
	for _, col := range s {
		if !col.Virtual {
			physical = append(physical, col)
		}
	}
	return physical
}

// Copy returns a deep copy of this schema, making a copy of all columns
func (s Schema) Copy() Schema {
	ns := make(Schema, len(s))
	for i, col := range s {
		ns[i] = col.Copy()
	}
	return ns
}

// Contains returns whether the schema contains a column with the given name.
func (s Schema) Contains(column string, source string) bool {
	return s.IndexOf(column, source) >= 0
}

// IndexOf returns the index of the given column in the schema or -1 if it's not present.
func (s Schema) IndexOf(column, source string) int {
	for i, col := range s {
		if strings.EqualFold(col.Name, column) && strings.EqualFold(col.Source, source) {
			return i
		}
	}
	return -1
}

// IndexOfColName returns the index of the given column in the schema or -1 if it's  not present. Only safe for schemas
// corresponding to a single table, where the source of the column is irrelevant.
func (s Schema) IndexOfColName(column string) int {
	column = strings.ToLower(column)
	for i, col := range s {
		if strings.ToLower(col.Name) == column {
			return i
		}
	}
	return -1
}

// Equals checks whether the given schema is equal to this one.
func (s Schema) Equals(s2 Schema) bool {
	if len(s) != len(s2) {
		return false
	}

	for i := range s {
		if !s[i].Equals(s2[i]) {
			return false
		}
	}

	return true
}

// CaseSensitiveEquals checks whether the given schema is equal to this one,
// failing for column names with different casing
func (s Schema) CaseSensitiveEquals(s2 Schema) bool {
	if len(s) != len(s2) {
		return false
	}

	for i := range s {
		if s[i].Name != s2[i].Name {
			return false
		}
		if !s[i].Equals(s2[i]) {
			return false
		}
	}

	return true
}

// HasAutoIncrement returns true if the schema has an auto increment column.
func (s Schema) HasAutoIncrement() bool {
	for _, c := range s {
		if c.AutoIncrement {
			return true
		}
	}

	return false
}

// Resolved returns true if this schema is fully resolved. Currently, the only piece of a schema that needs
// to be resolved are any column default value expressions.
func (s Schema) Resolved() bool {
	for _, c := range s {
		if c.Default != nil {
			if !c.Default.Resolved() {
				return false
			}
		}
	}

	return true
}

func IsKeyless(s Schema) bool {
	for _, c := range s {
		if c.PrimaryKey {
			return false
		}
	}

	return true
}

// PrimaryKeySchema defines table metadata for columns and primary key ordering
type PrimaryKeySchema struct {
	Schema
	PkOrdinals []int
}

// NewPrimaryKeySchema constructs a new PrimaryKeySchema. PK ordinals
// default to the in-order set read from the Schema.
func NewPrimaryKeySchema(s Schema, pkOrds ...int) PrimaryKeySchema {
	if len(pkOrds) == 0 {
		pkOrds = make([]int, 0)
		for i, c := range s {
			if c.PrimaryKey {
				pkOrds = append(pkOrds, i)
			}
		}
	}
	return PrimaryKeySchema{Schema: s, PkOrdinals: pkOrds}
}

// SchemaToPrimaryKeySchema adapts the schema given to a PrimaryKey schema using the primary keys of the table given, if
// present. The resulting PrimaryKeySchema may have an empty key set if the table has no primary keys. Matching for
// ordinals is performed by column name, with the aid of |renames| when provided.
func SchemaToPrimaryKeySchema(table Table, sch Schema, renames ...ColumnRename) PrimaryKeySchema {
	var pks []*Column
	if pkt, ok := table.(PrimaryKeyTable); ok {
		schema := pkt.PrimaryKeySchema()
		for _, ordinal := range schema.PkOrdinals {
			pks = append(pks, schema.Schema[ordinal])
		}
	} else {
		// set PkOrdinals by schema order
		return NewPrimaryKeySchema(sch)
	}

	mapping := make(map[string]string)
	for _, r := range renames {
		mapping[strings.ToLower(r.Before)] = r.After
	}

	ords := make([]int, len(pks))
	for i, pk := range pks {
		name := strings.ToLower(pk.Name)
		if n, ok := mapping[name]; ok {
			name = n
		}
		ords[i] = sch.IndexOf(name, pk.Source)
	}
	return NewPrimaryKeySchema(sch, ords...)
}

// ColumnOrder is used in ALTER TABLE statements to change the order of inserted / modified columns.
type ColumnOrder struct {
	AfterColumn string // Set to the name of the column after which this column should appear
	First       bool   // True if this column should come first
}

type ColumnRename struct {
	Before, After string
}
