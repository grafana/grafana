// Copyright 2021 Dolthub, Inc.
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

import (
	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

type ShowCharset struct {
	CharacterSetTable sql.Node
}

var _ sql.Node = (*ShowCharset)(nil)
var _ sql.CollationCoercible = (*ShowCharset)(nil)

// NewShowCharset returns a new ShowCharset reference.
func NewShowCharset() *ShowCharset {
	return &ShowCharset{}
}

// Resolved implements sql.Node interface. The function always returns true.
func (sc *ShowCharset) Resolved() bool {
	return true
}

// WithChildren implements the Node interface.
func (sc *ShowCharset) WithChildren(children ...sql.Node) (sql.Node, error) {
	expected := len(sc.Children())
	if len(children) != expected {
		return nil, sql.ErrInvalidChildrenNumber.New(sc, len(children), expected)
	}

	return sc, nil
}

func (sc *ShowCharset) IsReadOnly() bool {
	return true
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowCharset) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (sc *ShowCharset) String() string {
	return "SHOW CHARSET"
}

// Note how this Schema differs in order from the information_schema.character_sets table.
func (sc *ShowCharset) Schema() sql.Schema {
	return sql.Schema{
		{Name: "Charset", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Description", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 2048), Default: nil, Nullable: false},
		{Name: "Default collation", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Maxlen", Type: types.Uint64, Default: nil, Nullable: false},
	}
}

func (sc *ShowCharset) Children() []sql.Node {
	if sc.CharacterSetTable == nil {
		return nil
	}
	return []sql.Node{sc.CharacterSetTable}
}

func (sc *ShowCharset) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	//TODO: use the information_schema table instead, currently bypassing it to show currently-implemented charsets
	//ri, err := sc.CharacterSetTable.RowIter(ctx, row)
	//if err != nil {
	//	return nil, err
	//}
	//return &showCharsetIter{originalIter: ri}, nil

	var rows []sql.Row
	iter := sql.NewCharacterSetsIterator()
	for charset, ok := iter.Next(); ok; charset, ok = iter.Next() {
		if charset.Encoder != nil && charset.BinaryCollation.Sorter() != nil && charset.DefaultCollation.Sorter() != nil {
			rows = append(rows, sql.Row{
				charset.Name,
				charset.Description,
				charset.DefaultCollation.String(),
				uint64(charset.MaxLength),
			})
		}
	}
	return sql.RowsToRowIter(rows...), nil
}

type showCharsetIter struct {
	originalIter sql.RowIter
}

func (sci *showCharsetIter) Next(ctx *sql.Context) (sql.Row, error) {
	row, err := sci.originalIter.Next(ctx)
	if err != nil {
		return nil, err
	}

	// switch the ordering (see notes on Schema())
	defaultCollationName := row[1]

	row[1] = row[2]
	row[2] = defaultCollationName

	return row, nil
}

func (sci *showCharsetIter) Close(ctx *sql.Context) error {
	return sci.originalIter.Close(ctx)
}
