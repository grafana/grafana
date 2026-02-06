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

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
)

// TableLock is a read or write lock on a table.
type TableLock struct {
	Table sql.Node
	// Write if it's true, read if it's false.
	Write bool
}

// LockTables will lock tables for the session in which it's executed.
type LockTables struct {
	Catalog sql.Catalog
	Locks   []*TableLock
}

var _ sql.Node = (*LockTables)(nil)
var _ sql.CollationCoercible = (*LockTables)(nil)

// NewLockTables creates a new LockTables node.
func NewLockTables(locks []*TableLock) *LockTables {
	return &LockTables{Locks: locks}
}

// Children implements the sql.Node interface.
func (t *LockTables) Children() []sql.Node {
	var children = make([]sql.Node, len(t.Locks))
	for i, l := range t.Locks {
		children[i] = l.Table
	}
	return children
}

// MySQL allows these against read-only servers.
func (t *LockTables) IsReadOnly() bool {
	return true
}

// Resolved implements the sql.Node interface.
func (t *LockTables) Resolved() bool {
	for _, l := range t.Locks {
		if !l.Table.Resolved() {
			return false
		}
	}
	return true
}

// Schema implements the sql.Node interface.
func (t *LockTables) Schema() sql.Schema { return nil }

func (t *LockTables) String() string {
	var children = make([]string, len(t.Locks))
	for i, l := range t.Locks {
		if l.Write {
			children[i] = fmt.Sprintf("[WRITE] %s", l.Table.String())
		} else {
			children[i] = fmt.Sprintf("[READ] %s", l.Table.String())
		}
	}

	p := sql.NewTreePrinter()
	_ = p.WriteNode("LockTables")
	_ = p.WriteChildren(children...)
	return p.String()
}

// WithChildren implements the Node interface.
func (t *LockTables) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != len(t.Locks) {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), len(t.Locks))
	}

	var locks = make([]*TableLock, len(t.Locks))
	for i, n := range children {
		locks[i] = &TableLock{
			Table: n,
			Write: t.Locks[i].Write,
		}
	}

	return &LockTables{t.Catalog, locks}, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*LockTables) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// UnlockTables will release all locks for the current session.
type UnlockTables struct {
	Catalog sql.Catalog
}

var _ sql.Node = (*UnlockTables)(nil)
var _ sql.CollationCoercible = (*UnlockTables)(nil)

// NewUnlockTables returns a new UnlockTables node.
func NewUnlockTables() *UnlockTables {
	return new(UnlockTables)
}

// Children implements the sql.Node interface.
func (t *UnlockTables) Children() []sql.Node { return nil }

// Resolved implements the sql.Node interface.
func (t *UnlockTables) Resolved() bool { return true }

// MySQL allows these against read-only servers.
func (t *UnlockTables) IsReadOnly() bool { return true }

// Schema implements the sql.Node interface.
func (t *UnlockTables) Schema() sql.Schema { return nil }

// RowIter implements the sql.Node interface.
func (t *UnlockTables) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.UnlockTables")
	defer span.End()

	if err := t.Catalog.UnlockTables(ctx, ctx.ID()); err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(), nil
}

func (t *UnlockTables) String() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("UnlockTables")
	return p.String()
}

// WithChildren implements the Node interface.
func (t *UnlockTables) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 0)
	}

	return t, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*UnlockTables) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
