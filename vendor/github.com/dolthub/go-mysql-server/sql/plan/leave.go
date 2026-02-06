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

// Leave represents the LEAVE statement, which instructs a loop to end. Equivalent to "break" in Go.
type Leave struct {
	Label string
}

var _ sql.Node = (*Leave)(nil)
var _ sql.CollationCoercible = (*Leave)(nil)

// NewLeave returns a new *Leave node.
func NewLeave(label string) *Leave {
	return &Leave{
		Label: label,
	}
}

// Resolved implements the interface sql.Node.
func (l *Leave) Resolved() bool {
	return true
}

// String implements the interface sql.Node.
func (l *Leave) String() string {
	return fmt.Sprintf("LEAVE %s", l.Label)
}

// Schema implements the interface sql.Node.
func (l *Leave) Schema() sql.Schema {
	return nil
}

func (l *Leave) IsReadOnly() bool {
	return true
}

// Children implements the interface sql.Node.
func (l *Leave) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (l *Leave) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(l, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Leave) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
