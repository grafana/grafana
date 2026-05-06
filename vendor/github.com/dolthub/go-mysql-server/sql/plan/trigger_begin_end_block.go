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

// TriggerBeginEndBlock represents a BEGIN/END block specific to TRIGGER execution, which has special considerations
// regarding logic execution through the RowIter function.
type TriggerBeginEndBlock struct {
	*BeginEndBlock
}

var _ sql.Node = (*TriggerBeginEndBlock)(nil)
var _ sql.DebugStringer = (*TriggerBeginEndBlock)(nil)
var _ sql.CollationCoercible = (*TriggerBeginEndBlock)(nil)
var _ RepresentsLabeledBlock = (*TriggerBeginEndBlock)(nil)
var _ RepresentsScope = (*TriggerBeginEndBlock)(nil)

// NewTriggerBeginEndBlock creates a new *TriggerBeginEndBlock node.
func NewTriggerBeginEndBlock(block *BeginEndBlock) *TriggerBeginEndBlock {
	return &TriggerBeginEndBlock{
		BeginEndBlock: block,
	}
}

// WithChildren implements the sql.Node interface.
func (b *TriggerBeginEndBlock) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NewTriggerBeginEndBlock(NewBeginEndBlock(b.BeginEndBlock.Label, NewBlock(children))), nil
}

// WithParamReference implements the interface expression.ProcedureReferencable.
func (b *TriggerBeginEndBlock) WithParamReference(pRef *expression.ProcedureReference) sql.Node {
	nb := *b
	nb.BeginEndBlock = b.BeginEndBlock.WithParamReference(pRef).(*BeginEndBlock)
	return &nb
}
