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

// transactionNode implements all the no-op methods of sql.Node
type transactionNode struct{}

func (transactionNode) Children() []sql.Node {
	return nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*transactionNode) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Resolved implements the sql.Node interface.
func (transactionNode) Resolved() bool {
	return true
}

func (transactionNode) IsReadOnly() bool {
	return true
}

// Schema implements the sql.Node interface.
func (transactionNode) Schema() sql.Schema {
	return nil
}

// StartTransaction explicitly starts a transaction. Transactions also start before any statement execution that
// doesn't have a transaction. Starting a transaction implicitly commits any in-progress one.
type StartTransaction struct {
	transactionNode
	TransChar sql.TransactionCharacteristic
}

var _ sql.Node = (*StartTransaction)(nil)
var _ sql.CollationCoercible = (*StartTransaction)(nil)

// NewStartTransaction creates a new StartTransaction node.
func NewStartTransaction(transactionChar sql.TransactionCharacteristic) *StartTransaction {
	return &StartTransaction{
		TransChar: transactionChar,
	}
}

func (s *StartTransaction) String() string {
	return "Start Transaction"
}

// WithChildren implements the Node interface.
func (s *StartTransaction) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 0)
	}

	return s, nil
}

// Commit commits the changes performed in a transaction. For sessions that don't implement sql.TransactionSession,
// this operation is a no-op.
type Commit struct {
	transactionNode
}

var _ sql.Node = (*Commit)(nil)
var _ sql.CollationCoercible = (*Commit)(nil)

// NewCommit creates a new Commit node.
func NewCommit() *Commit {
	return &Commit{}
}

func (*Commit) String() string { return "COMMIT" }

// WithChildren implements the Node interface.
func (c *Commit) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 0)
	}

	return c, nil
}

// Rollback undoes the changes performed in the current transaction. For compatibility, sessions that don't implement
// sql.TransactionSession treat this as a no-op.
type Rollback struct {
	transactionNode
}

var _ sql.Node = (*Rollback)(nil)
var _ sql.CollationCoercible = (*Rollback)(nil)

// NewRollback creates a new Rollback node.
func NewRollback() *Rollback {
	return &Rollback{}
}

func (*Rollback) String() string { return "ROLLBACK" }

// WithChildren implements the Node interface.
func (r *Rollback) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), 0)
	}

	return r, nil
}

// CreateSavepoint creates a savepoint with the given name. For sessions that don't implement sql.TransactionSession,
// this is a no-op.
type CreateSavepoint struct {
	transactionNode
	Name string
}

var _ sql.Node = (*CreateSavepoint)(nil)
var _ sql.CollationCoercible = (*CreateSavepoint)(nil)

// NewCreateSavepoint creates a new CreateSavepoint node.
func NewCreateSavepoint(name string) *CreateSavepoint {
	return &CreateSavepoint{Name: name}
}

func (c *CreateSavepoint) String() string { return fmt.Sprintf("SAVEPOINT %s", c.Name) }

// WithChildren implements the Node interface.
func (c *CreateSavepoint) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 0)
	}

	return c, nil
}

// RollbackSavepoint rolls back the current transaction to the given savepoint. For sessions that don't implement
// sql.TransactionSession, this is a no-op.
type RollbackSavepoint struct {
	transactionNode
	Name string
}

var _ sql.Node = (*RollbackSavepoint)(nil)
var _ sql.CollationCoercible = (*RollbackSavepoint)(nil)

// NewRollbackSavepoint creates a new RollbackSavepoint node.
func NewRollbackSavepoint(name string) *RollbackSavepoint {
	return &RollbackSavepoint{
		Name: name,
	}
}

func (r *RollbackSavepoint) String() string { return fmt.Sprintf("ROLLBACK TO SAVEPOINT %s", r.Name) }

// WithChildren implements the Node interface.
func (r *RollbackSavepoint) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), 0)
	}

	return r, nil
}

// ReleaseSavepoint releases the given savepoint. For sessions that don't implement sql.TransactionSession, this is a
// no-op.
type ReleaseSavepoint struct {
	transactionNode
	Name string
}

var _ sql.Node = (*ReleaseSavepoint)(nil)
var _ sql.CollationCoercible = (*ReleaseSavepoint)(nil)

// NewReleaseSavepoint creates a new ReleaseSavepoint node.
func NewReleaseSavepoint(name string) *ReleaseSavepoint {
	return &ReleaseSavepoint{
		Name: name,
	}
}

func (r *ReleaseSavepoint) String() string { return fmt.Sprintf("RELEASE SAVEPOINT %s", r.Name) }

// WithChildren implements the Node interface.
func (r *ReleaseSavepoint) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), 0)
	}

	return r, nil
}
