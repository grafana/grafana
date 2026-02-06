// Copyright 2023 Dolthub, Inc.
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

// Repeat represents the REPEAT statement, which loops over a set of statements until the condition is true.
type Repeat struct {
	*Loop
}

var _ sql.Node = (*Repeat)(nil)
var _ sql.DebugStringer = (*Repeat)(nil)
var _ sql.Expressioner = (*Repeat)(nil)
var _ sql.CollationCoercible = (*Repeat)(nil)
var _ RepresentsLabeledBlock = (*Repeat)(nil)

// NewRepeat returns a new *Repeat node.
func NewRepeat(label string, condition sql.Expression, block *Block) *Repeat {
	return &Repeat{
		&Loop{
			Label:          label,
			Condition:      expression.NewNot(condition), // Repeat stops when the condition is true, so we apply NOT to match loop's failure case
			OnceBeforeEval: true,
			Block:          block,
		},
	}
}

// String implements the interface sql.Node.
func (r *Repeat) String() string {
	label := ""
	if len(r.Label) > 0 {
		label = r.Label + ": "
	}
	p := sql.NewTreePrinter()
	_ = p.WriteNode("%s: REPEAT(%s)", label, r.Condition.String())
	var children []string
	for _, s := range r.statements {
		children = append(children, s.String())
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// DebugString implements the interface sql.DebugStringer.
func (r *Repeat) DebugString() string {
	label := ""
	if len(r.Label) > 0 {
		label = r.Label + ": "
	}
	p := sql.NewTreePrinter()
	_ = p.WriteNode("%s: REPEAT(%s)", label, sql.DebugString(r.Condition))
	var children []string
	for _, s := range r.statements {
		children = append(children, sql.DebugString(s))
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// WithChildren implements the interface sql.Node.
func (r *Repeat) WithChildren(children ...sql.Node) (sql.Node, error) {
	return &Repeat{
		&Loop{
			Label:          r.Loop.Label,
			Condition:      r.Loop.Condition,
			OnceBeforeEval: true,
			Block:          NewBlock(children),
		},
	}, nil
}

// WithExpressions implements the interface sql.Node.
func (r *Repeat) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(exprs), 1)
	}

	return &Repeat{
		&Loop{
			Label:          r.Loop.Label,
			Condition:      exprs[0],
			OnceBeforeEval: true,
			Block:          r.Loop.Block,
		},
	}, nil
}
