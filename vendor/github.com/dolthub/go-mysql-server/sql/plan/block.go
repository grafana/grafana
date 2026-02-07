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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// Block represents a collection of statements that should be executed in sequence.
type Block struct {
	Pref       *expression.ProcedureReference
	statements []sql.Node
	rowIterSch sql.Schema
}

// RepresentsBlock is an interface that defines whether a node contains a Block node, or contains multiple child
// statements similar to a block node. As a rule of thumb, if a parent node depends upon a child node, either explicitly
// or implicitly, then it does not represent a Block.
type RepresentsBlock interface {
	sql.Node
	implementsRepresentsBlock()
}

// RepresentsLabeledBlock is an interface that defines whether a node represents a Block node, while also carrying a
// label that may be referenced by statements within the block (such as LEAVE, ITERATE, etc.). Some statements that use
// labels only look for labels on statements that loop (such as LOOP and REPEAT), so there's an additional function
// to check whether this also represents a loop.
type RepresentsLabeledBlock interface {
	RepresentsBlock
	GetBlockLabel(ctx *sql.Context) string
	RepresentsLoop() bool
}

// RepresentsScope is an interface that defines whether a node represents a new scope. Scopes define boundaries that
// are used for variable resolution and control flow modification (via condition handling, etc.).
type RepresentsScope interface {
	RepresentsBlock
	implementsRepresentsScope()
}

var _ sql.Node = (*Block)(nil)
var _ sql.DebugStringer = (*Block)(nil)
var _ sql.CollationCoercible = (*Block)(nil)
var _ RepresentsBlock = (*Block)(nil)

// NewBlock creates a new *Block node.
func NewBlock(statements []sql.Node) *Block {
	return &Block{statements: statements}
}

// Resolved implements the sql.Node interface.
func (b *Block) Resolved() bool {
	for _, s := range b.statements {
		if !s.Resolved() {
			return false
		}
	}
	return true
}

func (b *Block) IsReadOnly() bool {
	for _, n := range b.statements {
		if !n.IsReadOnly() {
			return false
		}
	}
	return true
}

// String implements the sql.Node interface.
func (b *Block) String() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("BLOCK")
	var children []string
	for _, s := range b.statements {
		children = append(children, s.String())
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// DebugString implements the sql.DebugStringer interface.
func (b *Block) DebugString() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("BLOCK")
	var children []string
	for _, s := range b.statements {
		children = append(children, sql.DebugString(s))
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// Schema implements the sql.Node interface.
func (b *Block) Schema() sql.Schema {
	return b.rowIterSch
}

func (b *Block) SetSchema(sch sql.Schema) {
	b.rowIterSch = sch
}

// Children implements the sql.Node interface.
func (b *Block) Children() []sql.Node {
	return b.statements
}

// WithChildren implements the sql.Node interface.
func (b *Block) WithChildren(children ...sql.Node) (sql.Node, error) {
	nb := *b
	nb.statements = children
	return &nb, nil
}

// WithParamReference implements the expression.ProcedureReferencable interface
func (b *Block) WithParamReference(pRef *expression.ProcedureReference) sql.Node {
	nb := *b
	nb.Pref = pRef
	return &nb
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (b *Block) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	// The last SELECT used in the block takes priority
	for i := len(b.statements) - 1; i >= 0; i-- {
		if NodeRepresentsSelect(b.statements[i]) {
			return sql.GetCoercibility(ctx, b.statements[i])
		}
	}
	// If the block is empty then we return an ignorable coercibility
	if len(b.statements) == 0 {
		return sql.Collation_binary, 7
	}
	// If none of the above applies, we return the coercibility of the last statement in the block
	return sql.GetCoercibility(ctx, b.statements[len(b.statements)-1])
}

// implementsRepresentsBlock implements the RepresentsBlock interface.
func (b *Block) implementsRepresentsBlock() {}
