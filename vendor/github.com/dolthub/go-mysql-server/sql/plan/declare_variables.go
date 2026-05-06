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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// DeclareVariables represents the DECLARE statement for local variables.
type DeclareVariables struct {
	Type       sql.Type
	DefaultVal *sql.ColumnDefaultValue
	Pref       *expression.ProcedureReference
	Names      []string
}

var _ sql.Node = (*DeclareVariables)(nil)
var _ sql.CollationCoercible = (*DeclareVariables)(nil)
var _ expression.ProcedureReferencable = (*DeclareVariables)(nil)

// NewDeclareVariables returns a new *DeclareVariables node.
func NewDeclareVariables(names []string, typ sql.Type, defaultVal *sql.ColumnDefaultValue) *DeclareVariables {
	return &DeclareVariables{
		Names:      names,
		Type:       typ,
		DefaultVal: defaultVal,
	}
}

// Resolved implements the interface sql.Node.
func (d *DeclareVariables) Resolved() bool {
	return true
}

func (d *DeclareVariables) IsReadOnly() bool {
	return true
}

// String implements the interface sql.Node.
func (d *DeclareVariables) String() string {
	return fmt.Sprintf("DECLARE %s %s", strings.Join(d.Names, ", "), d.Type.String())
}

// Schema implements the interface sql.Node.
func (d *DeclareVariables) Schema() sql.Schema {
	return nil
}

// Children implements the interface sql.Node.
func (d *DeclareVariables) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (d *DeclareVariables) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(d, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DeclareVariables) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// WithParamReference implements the interface expression.ProcedureReferencable.
func (d *DeclareVariables) WithParamReference(pRef *expression.ProcedureReference) sql.Node {
	nd := *d
	nd.Pref = pRef
	return &nd
}
