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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Loop represents the LOOP statement, which loops over a set of statements.
type Loop struct {
	Condition sql.Expression // We continue looping until the condition returns false
	*Block
	Label          string
	OnceBeforeEval bool // Whether to run through the statements first before evaluating the condition
}

var _ sql.Node = (*Loop)(nil)
var _ sql.DebugStringer = (*Loop)(nil)
var _ sql.Expressioner = (*Loop)(nil)
var _ sql.CollationCoercible = (*Loop)(nil)
var _ RepresentsLabeledBlock = (*Loop)(nil)

// NewLoop returns a new *Loop node.
func NewLoop(label string, block *Block) *Loop {
	return &Loop{
		Label:          label,
		Condition:      expression.NewLiteral(true, types.Boolean),
		OnceBeforeEval: true,
		Block:          block,
	}
}

// String implements the interface sql.Node.
func (l *Loop) String() string {
	label := ""
	if len(l.Label) > 0 {
		label = l.Label + ": "
	}
	p := sql.NewTreePrinter()
	_ = p.WriteNode("%s", label+"LOOP")
	var children []string
	for _, s := range l.statements {
		children = append(children, s.String())
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// DebugString implements the interface sql.DebugStringer.
func (l *Loop) DebugString() string {
	label := ""
	if len(l.Label) > 0 {
		label = l.Label + ": "
	}
	p := sql.NewTreePrinter()
	_ = p.WriteNode("%s", label+": LOOP")
	var children []string
	for _, s := range l.statements {
		children = append(children, sql.DebugString(s))
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// Resolved implements the interface sql.Node.
func (l *Loop) Resolved() bool {
	return l.Condition.Resolved() && l.Block.Resolved()
}

// WithChildren implements the interface sql.Node.
func (l *Loop) WithChildren(children ...sql.Node) (sql.Node, error) {
	newBlock, err := l.Block.WithChildren(children...)
	if err != nil {
		return nil, err
	}
	return &Loop{
		Label:          l.Label,
		Condition:      l.Condition,
		OnceBeforeEval: l.OnceBeforeEval,
		Block:          newBlock.(*Block),
	}, nil
}

// Expressions implements the interface sql.Node.
func (l *Loop) Expressions() []sql.Expression {
	return []sql.Expression{l.Condition}
}

// WithExpressions implements the interface sql.Node.
func (l *Loop) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(exprs), 1)
	}

	return &Loop{
		Label:          l.Label,
		Condition:      exprs[0],
		OnceBeforeEval: l.OnceBeforeEval,
		Block:          l.Block,
	}, nil
}

// WithParamReference implements the expression.ProcedureReferencable interface
func (l *Loop) WithParamReference(pRef *expression.ProcedureReference) sql.Node {
	nl := *l
	newBlock := *nl.Block
	newBlock.Pref = pRef
	nl.Block = &newBlock
	return &nl
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (l *Loop) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return l.Block.CollationCoercibility(ctx)
}

// GetBlockLabel implements the interface RepresentsLabeledBlock.
func (l *Loop) GetBlockLabel(ctx *sql.Context) string {
	return l.Label
}

// RepresentsLoop implements the interface RepresentsLabeledBlock.
func (l *Loop) RepresentsLoop() bool {
	return true
}
