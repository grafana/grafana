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

// Open represents the OPEN statement, which opens a cursor.
type Open struct {
	Pref *expression.ProcedureReference
	Name string
}

var _ sql.Node = (*Open)(nil)
var _ sql.CollationCoercible = (*Open)(nil)
var _ expression.ProcedureReferencable = (*Open)(nil)

// NewOpen returns a new *Open node.
func NewOpen(name string) *Open {
	return &Open{
		Name: name,
	}
}

// Resolved implements the interface sql.Node.
func (o *Open) Resolved() bool {
	return true
}

func (o *Open) IsReadOnly() bool {
	return true
}

// String implements the interface sql.Node.
func (o *Open) String() string {
	return fmt.Sprintf("OPEN %s", o.Name)
}

// Schema implements the interface sql.Node.
func (o *Open) Schema() sql.Schema {
	return nil
}

// Children implements the interface sql.Node.
func (o *Open) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (o *Open) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(o, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Open) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// WithParamReference implements the interface expression.ProcedureReferencable.
func (o *Open) WithParamReference(pRef *expression.ProcedureReference) sql.Node {
	no := *o
	no.Pref = pRef
	return &no
}
