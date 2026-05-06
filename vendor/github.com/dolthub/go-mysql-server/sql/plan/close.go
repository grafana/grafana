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

// Close represents the CLOSE statement, which closes a cursor.
type Close struct {
	Pref *expression.ProcedureReference
	Name string
}

var _ sql.Node = (*Close)(nil)
var _ sql.CollationCoercible = (*Close)(nil)
var _ expression.ProcedureReferencable = (*Close)(nil)

// NewClose returns a new *Close node.
func NewClose(name string) *Close {
	return &Close{
		Name: name,
	}
}

// Resolved implements the interface sql.Node.
func (c *Close) Resolved() bool {
	return true
}

// String implements the interface sql.Node.
func (c *Close) String() string {
	return fmt.Sprintf("CLOSE %s", c.Name)
}

// Schema implements the interface sql.Node.
func (c *Close) Schema() sql.Schema {
	return nil
}

// Children implements the interface sql.Node.
func (c *Close) Children() []sql.Node {
	return nil
}

func (c *Close) IsReadOnly() bool {
	return true
}

// WithChildren implements the interface sql.Node.
func (c *Close) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(c, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Close) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// WithParamReference implements the interface expression.ProcedureReferencable.
func (c *Close) WithParamReference(pRef *expression.ProcedureReference) sql.Node {
	nc := *c
	nc.Pref = pRef
	return &nc
}
