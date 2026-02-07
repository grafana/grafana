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

// NothingImpl is a node that will return no rows.
var NothingImpl Nothing

type Nothing struct{}

var _ sql.Node = Nothing{}
var _ sql.CollationCoercible = Nothing{}

func (Nothing) String() string       { return "NOTHING" }
func (Nothing) Resolved() bool       { return true }
func (Nothing) IsReadOnly() bool     { return true }
func (Nothing) Schema() sql.Schema   { return nil }
func (Nothing) Children() []sql.Node { return nil }
func (Nothing) RowIter(*sql.Context, sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(), nil
}

// WithChildren implements the Node interface.
func (n Nothing) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}

	return NothingImpl, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (Nothing) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
