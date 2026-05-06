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

package sqlparser

import (
	"strings"

	"github.com/dolthub/vitess/go/sqltypes"
)

// This file contains types that are 'Encodable'.

// Encodable defines the interface for types that can
// be custom-encoded into SQL.
type Encodable interface {
	EncodeSQL(buf *strings.Builder)
}

// InsertValues is a custom SQL encoder for the values of
// an insert statement.
type InsertValues [][]sqltypes.Value

// EncodeSQL performs the SQL encoding for InsertValues.
func (iv InsertValues) EncodeSQL(buf *strings.Builder) {
	for i, rows := range iv {
		if i != 0 {
			buf.WriteString(", ")
		}
		buf.WriteByte('(')
		for j, bv := range rows {
			if j != 0 {
				buf.WriteString(", ")
			}
			bv.EncodeSQL(buf)
		}
		buf.WriteByte(')')
	}
}

// TupleEqualityList is for generating equality constraints
// for tables that have composite primary keys.
type TupleEqualityList struct {
	Columns []ColIdent
	Rows    [][]sqltypes.Value
}

// EncodeSQL generates the where clause constraints for the tuple
// equality.
func (tpl *TupleEqualityList) EncodeSQL(buf *strings.Builder) {
	if len(tpl.Columns) == 1 {
		tpl.encodeAsIn(buf)
		return
	}
	tpl.encodeAsEquality(buf)
}

func (tpl *TupleEqualityList) encodeAsIn(buf *strings.Builder) {
	Append(buf, tpl.Columns[0])
	buf.WriteString(" in (")
	for i, r := range tpl.Rows {
		if i != 0 {
			buf.WriteString(", ")
		}
		r[0].EncodeSQL(buf)
	}
	buf.WriteByte(')')
}

func (tpl *TupleEqualityList) encodeAsEquality(buf *strings.Builder) {
	for i, r := range tpl.Rows {
		if i != 0 {
			buf.WriteString(" or ")
		}
		buf.WriteString("(")
		for j, c := range tpl.Columns {
			if j != 0 {
				buf.WriteString(" and ")
			}
			Append(buf, c)
			buf.WriteString(" = ")
			r[j].EncodeSQL(buf)
		}
		buf.WriteByte(')')
	}
}
