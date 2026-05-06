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

// BeginEndBlock represents a BEGIN/END block.
type BeginEndBlock struct {
	*Block
	Label string
}

// NewBeginEndBlock creates a new *BeginEndBlock node.
func NewBeginEndBlock(label string, block *Block) *BeginEndBlock {
	return &BeginEndBlock{
		Block: block,
		Label: label,
	}
}

var _ sql.Node = (*BeginEndBlock)(nil)
var _ sql.CollationCoercible = (*BeginEndBlock)(nil)
var _ sql.DebugStringer = (*BeginEndBlock)(nil)
var _ expression.ProcedureReferencable = (*BeginEndBlock)(nil)
var _ RepresentsLabeledBlock = (*BeginEndBlock)(nil)
var _ RepresentsScope = (*BeginEndBlock)(nil)

// String implements the interface sql.Node.
func (b *BeginEndBlock) String() string {
	label := ""
	if len(b.Label) > 0 {
		label = b.Label + ": "
	}
	p := sql.NewTreePrinter()
	_ = p.WriteNode("%s", label+"BEGIN .. END")
	var children []string
	for _, s := range b.statements {
		children = append(children, s.String())
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// DebugString implements the interface sql.DebugStringer.
func (b *BeginEndBlock) DebugString() string {
	label := ""
	if len(b.Label) > 0 {
		label = b.Label + ": "
	}
	p := sql.NewTreePrinter()
	_ = p.WriteNode("%s", label+"BEGIN .. END")
	var children []string
	for _, s := range b.statements {
		children = append(children, sql.DebugString(s))
	}
	_ = p.WriteChildren(children...)
	return p.String()
}

// WithChildren implements the interface sql.Node.
func (b *BeginEndBlock) WithChildren(children ...sql.Node) (sql.Node, error) {
	newBeginEndBlock := *b
	newBlock := *b.Block
	newBlock.statements = children
	newBeginEndBlock.Block = &newBlock
	return &newBeginEndBlock, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (b *BeginEndBlock) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return b.Block.CollationCoercibility(ctx)
}

// WithParamReference implements the interface expression.ProcedureReferencable.
func (b *BeginEndBlock) WithParamReference(pRef *expression.ProcedureReference) sql.Node {
	nb := *b
	newBlock := *nb.Block
	newBlock.Pref = pRef
	nb.Block = &newBlock
	return &nb
}

// implementsRepresentsScope implements the interface RepresentsScope.
func (b *BeginEndBlock) implementsRepresentsScope() {}

// GetBlockLabel implements the interface RepresentsLabeledBlock.
func (b *BeginEndBlock) GetBlockLabel(ctx *sql.Context) string {
	return b.Label
}

// RepresentsLoop implements the interface RepresentsLabeledBlock.
func (b *BeginEndBlock) RepresentsLoop() bool {
	return false
}
