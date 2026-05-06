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

	"github.com/dolthub/go-mysql-server/sql"
)

// Iterate represents the ITERATE statement, which instructs a loop to continue to the next iteration. Equivalent to
// "continue" in Go.
type Iterate struct {
	Label string
}

var _ sql.Node = (*Iterate)(nil)
var _ sql.CollationCoercible = (*Iterate)(nil)

// NewIterate returns a new *Iterate node.
func NewIterate(label string) *Iterate {
	return &Iterate{
		Label: label,
	}
}

// Resolved implements the interface sql.Node.
func (i *Iterate) Resolved() bool {
	return true
}

func (i *Iterate) IsReadOnly() bool {
	return true
}

// String implements the interface sql.Node.
func (i *Iterate) String() string {
	return fmt.Sprintf("ITERATE %s", i.Label)
}

// Schema implements the interface sql.Node.
func (i *Iterate) Schema() sql.Schema {
	return nil
}

// Children implements the interface sql.Node.
func (i *Iterate) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (i *Iterate) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(i, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Iterate) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
