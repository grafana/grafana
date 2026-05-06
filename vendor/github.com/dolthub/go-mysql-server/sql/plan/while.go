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
)

// While represents the WHILE statement, which loops over a set of statements while the condition is true.
type While struct {
	*Loop
}

var _ sql.Node = (*While)(nil)
var _ sql.DebugStringer = (*While)(nil)
var _ sql.Expressioner = (*While)(nil)
var _ sql.CollationCoercible = (*While)(nil)
var _ RepresentsLabeledBlock = (*While)(nil)

// NewWhile returns a new *While node.
func NewWhile(label string, condition sql.Expression, block *Block) *While {
	return &While{
		&Loop{
			Label:          label,
			Condition:      condition,
			OnceBeforeEval: false,
			Block:          block,
		},
	}
}

// String implements the interface sql.Node.
func (w *While) String() string {
	label := ""
	if len(w.Label) > 0 {
		label = w.Label + ": "
	}
	p := sql.NewTreePrinter()
	_ = p.WriteNode("%s: WHILE(%s)", label, w.Condition.String())
	var children []string
	for _, s := range w.statements {
		children = append(children, s.String())
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// DebugString implements the interface sql.DebugStringer.
func (w *While) DebugString() string {
	label := ""
	if len(w.Label) > 0 {
		label = w.Label + ": "
	}
	p := sql.NewTreePrinter()
	_ = p.WriteNode("%s: WHILE(%s)", label, sql.DebugString(w.Condition))
	var children []string
	for _, s := range w.statements {
		children = append(children, sql.DebugString(s))
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// WithChildren implements the interface sql.Node.
func (w *While) WithChildren(children ...sql.Node) (sql.Node, error) {
	return &While{
		&Loop{
			Label:          w.Loop.Label,
			Condition:      w.Loop.Condition,
			OnceBeforeEval: false,
			Block:          NewBlock(children),
		},
	}, nil
}

// WithExpressions implements the interface sql.Node.
func (w *While) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(w, len(exprs), 1)
	}

	return &While{
		&Loop{
			Label:          w.Loop.Label,
			Condition:      exprs[0],
			OnceBeforeEval: false,
			Block:          w.Loop.Block,
		},
	}, nil
}
