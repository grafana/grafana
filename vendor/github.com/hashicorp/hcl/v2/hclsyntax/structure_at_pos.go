// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"github.com/hashicorp/hcl/v2"
)

// -----------------------------------------------------------------------------
// The methods in this file are all optional extension methods that serve to
// implement the methods of the same name on *hcl.File when its root body
// is provided by this package.
// -----------------------------------------------------------------------------

// BlocksAtPos implements the method of the same name for an *hcl.File that
// is backed by a *Body.
func (b *Body) BlocksAtPos(pos hcl.Pos) []*hcl.Block {
	list, _ := b.blocksAtPos(pos, true)
	return list
}

// InnermostBlockAtPos implements the method of the same name for an *hcl.File
// that is backed by a *Body.
func (b *Body) InnermostBlockAtPos(pos hcl.Pos) *hcl.Block {
	_, innermost := b.blocksAtPos(pos, false)
	return innermost.AsHCLBlock()
}

// OutermostBlockAtPos implements the method of the same name for an *hcl.File
// that is backed by a *Body.
func (b *Body) OutermostBlockAtPos(pos hcl.Pos) *hcl.Block {
	return b.outermostBlockAtPos(pos).AsHCLBlock()
}

// blocksAtPos is the internal engine of both BlocksAtPos and
// InnermostBlockAtPos, which both need to do the same logic but return a
// differently-shaped result.
//
// list is nil if makeList is false, avoiding an allocation. Innermost is
// always set, and if the returned list is non-nil it will always match the
// final element from that list.
func (b *Body) blocksAtPos(pos hcl.Pos, makeList bool) (list []*hcl.Block, innermost *Block) {
	current := b

Blocks:
	for current != nil {
		for _, block := range current.Blocks {
			wholeRange := hcl.RangeBetween(block.TypeRange, block.CloseBraceRange)
			if wholeRange.ContainsPos(pos) {
				innermost = block
				if makeList {
					list = append(list, innermost.AsHCLBlock())
				}
				current = block.Body
				continue Blocks
			}
		}

		// If we fall out here then none of the current body's nested blocks
		// contain the position we are looking for, and so we're done.
		break
	}

	return
}

// outermostBlockAtPos is the internal version of OutermostBlockAtPos that
// returns a hclsyntax.Block rather than an hcl.Block, allowing for further
// analysis if necessary.
func (b *Body) outermostBlockAtPos(pos hcl.Pos) *Block {
	// This is similar to blocksAtPos, but simpler because we know it only
	// ever needs to search the first level of nested blocks.

	for _, block := range b.Blocks {
		wholeRange := hcl.RangeBetween(block.TypeRange, block.CloseBraceRange)
		if wholeRange.ContainsPos(pos) {
			return block
		}
	}

	return nil
}

// AttributeAtPos implements the method of the same name for an *hcl.File
// that is backed by a *Body.
func (b *Body) AttributeAtPos(pos hcl.Pos) *hcl.Attribute {
	return b.attributeAtPos(pos).AsHCLAttribute()
}

// attributeAtPos is the internal version of AttributeAtPos that returns a
// hclsyntax.Block rather than an hcl.Block, allowing for further analysis if
// necessary.
func (b *Body) attributeAtPos(pos hcl.Pos) *Attribute {
	searchBody := b
	_, block := b.blocksAtPos(pos, false)
	if block != nil {
		searchBody = block.Body
	}

	for _, attr := range searchBody.Attributes {
		if attr.SrcRange.ContainsPos(pos) {
			return attr
		}
	}

	return nil
}

// OutermostExprAtPos implements the method of the same name for an *hcl.File
// that is backed by a *Body.
func (b *Body) OutermostExprAtPos(pos hcl.Pos) hcl.Expression {
	attr := b.attributeAtPos(pos)
	if attr == nil {
		return nil
	}
	if !attr.Expr.Range().ContainsPos(pos) {
		return nil
	}
	return attr.Expr
}
