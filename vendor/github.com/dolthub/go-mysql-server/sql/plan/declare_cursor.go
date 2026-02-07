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

package plan

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql/expression"

	"github.com/dolthub/go-mysql-server/sql"
)

// DeclareCursor represents the DECLARE ... CURSOR statement.
type DeclareCursor struct {
	Select sql.Node
	Pref   *expression.ProcedureReference
	Name   string
}

var _ sql.Node = (*DeclareCursor)(nil)
var _ sql.CollationCoercible = (*DeclareCursor)(nil)
var _ sql.DebugStringer = (*DeclareCursor)(nil)
var _ expression.ProcedureReferencable = (*DeclareCursor)(nil)

// NewDeclareCursor returns a new *DeclareCursor node.
func NewDeclareCursor(name string, selectStatement sql.Node) *DeclareCursor {
	return &DeclareCursor{
		Name:   name,
		Select: selectStatement,
	}
}

// Resolved implements the interface sql.Node.
func (d *DeclareCursor) Resolved() bool {
	return d.Select.Resolved()
}

func (d *DeclareCursor) IsReadOnly() bool {
	return d.Select.IsReadOnly()
}

// String implements the interface sql.Node.
func (d *DeclareCursor) String() string {
	return fmt.Sprintf("DECLARE %s CURSOR FOR %s", d.Name, d.Select.String())
}

// DebugString implements the interface sql.DebugStringer.
func (d *DeclareCursor) DebugString() string {
	return fmt.Sprintf("DECLARE %s CURSOR FOR %s", d.Name, sql.DebugString(d.Select))
}

// Schema implements the interface sql.Node.
func (d *DeclareCursor) Schema() sql.Schema {
	return d.Select.Schema()
}

// Children implements the interface sql.Node.
func (d *DeclareCursor) Children() []sql.Node {
	return []sql.Node{d.Select}
}

// WithChildren implements the interface sql.Node.
func (d *DeclareCursor) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}

	nd := *d
	nd.Select = children[0]
	return &nd, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DeclareCursor) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// WithParamReference implements the interface expression.ProcedureReferencable.
func (d *DeclareCursor) WithParamReference(pRef *expression.ProcedureReference) sql.Node {
	nd := *d
	nd.Pref = pRef
	return &nd
}
