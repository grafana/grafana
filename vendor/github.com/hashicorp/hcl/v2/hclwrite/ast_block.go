// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclwrite

import (
	"github.com/hashicorp/hcl/v2/hclsyntax"
	"github.com/zclconf/go-cty/cty"
)

type Block struct {
	inTree

	leadComments *node
	typeName     *node
	labels       *node
	open         *node
	body         *node
	close        *node
}

func newBlock() *Block {
	return &Block{
		inTree: newInTree(),
	}
}

// NewBlock constructs a new, empty block with the given type name and labels.
func NewBlock(typeName string, labels []string) *Block {
	block := newBlock()
	block.init(typeName, labels)
	return block
}

func (b *Block) init(typeName string, labels []string) {
	nameTok := newIdentToken(typeName)
	nameObj := newIdentifier(nameTok)
	b.leadComments = b.children.Append(newComments(nil))
	b.typeName = b.children.Append(nameObj)
	labelsObj := newBlockLabels(labels)
	b.labels = b.children.Append(labelsObj)
	b.open = b.children.AppendUnstructuredTokens(Tokens{
		{
			Type:  hclsyntax.TokenOBrace,
			Bytes: []byte{'{'},
		},
		{
			Type:  hclsyntax.TokenNewline,
			Bytes: []byte{'\n'},
		},
	})
	body := newBody() // initially totally empty; caller can append to it subsequently
	b.body = b.children.Append(body)
	b.close = b.children.AppendUnstructuredTokens(Tokens{
		{
			Type:  hclsyntax.TokenCBrace,
			Bytes: []byte{'}'},
		},
		{
			Type:  hclsyntax.TokenNewline,
			Bytes: []byte{'\n'},
		},
	})
}

// Body returns the body that represents the content of the receiving block.
//
// Appending to or otherwise modifying this body will make changes to the
// tokens that are generated between the blocks open and close braces.
func (b *Block) Body() *Body {
	return b.body.content.(*Body)
}

// Type returns the type name of the block.
func (b *Block) Type() string {
	typeNameObj := b.typeName.content.(*identifier)
	return string(typeNameObj.token.Bytes)
}

// SetType updates the type name of the block to a given name.
func (b *Block) SetType(typeName string) {
	nameTok := newIdentToken(typeName)
	nameObj := newIdentifier(nameTok)
	b.typeName.ReplaceWith(nameObj)
}

// Labels returns the labels of the block.
func (b *Block) Labels() []string {
	return b.labelsObj().Current()
}

// SetLabels updates the labels of the block to given labels.
// Since we cannot assume that old and new labels are equal in length,
// remove old labels and insert new ones before TokenOBrace.
func (b *Block) SetLabels(labels []string) {
	b.labelsObj().Replace(labels)
}

// labelsObj returns the internal node content representation of the block
// labels. This is not part of the public API because we're intentionally
// exposing only a limited API to get/set labels on the block itself in a
// manner similar to the main hcl.Block type, but our block accessors all
// use this to get the underlying node content to work with.
func (b *Block) labelsObj() *blockLabels {
	return b.labels.content.(*blockLabels)
}

type blockLabels struct {
	inTree

	items nodeSet
}

func newBlockLabels(labels []string) *blockLabels {
	ret := &blockLabels{
		inTree: newInTree(),
		items:  newNodeSet(),
	}

	ret.Replace(labels)
	return ret
}

func (bl *blockLabels) Replace(newLabels []string) {
	bl.inTree.children.Clear()
	bl.items.Clear()

	for _, label := range newLabels {
		labelToks := TokensForValue(cty.StringVal(label))
		// Force a new label to use the quoted form, which is the idiomatic
		// form. The unquoted form is supported in HCL 2 only for compatibility
		// with historical use in HCL 1.
		labelObj := newQuoted(labelToks)
		labelNode := bl.children.Append(labelObj)
		bl.items.Add(labelNode)
	}
}

func (bl *blockLabels) Current() []string {
	labelNames := make([]string, 0, len(bl.items))
	list := bl.items.List()

	for _, label := range list {
		switch labelObj := label.content.(type) {
		case *identifier:
			if labelObj.token.Type == hclsyntax.TokenIdent {
				labelString := string(labelObj.token.Bytes)
				labelNames = append(labelNames, labelString)
			}

		case *quoted:
			tokens := labelObj.tokens
			if len(tokens) == 3 &&
				tokens[0].Type == hclsyntax.TokenOQuote &&
				tokens[1].Type == hclsyntax.TokenQuotedLit &&
				tokens[2].Type == hclsyntax.TokenCQuote {
				// Note that TokenQuotedLit may contain escape sequences.
				labelString, diags := hclsyntax.ParseStringLiteralToken(tokens[1].asHCLSyntax())

				// If parsing the string literal returns error diagnostics
				// then we can just assume the label doesn't match, because it's invalid in some way.
				if !diags.HasErrors() {
					labelNames = append(labelNames, labelString)
				}
			} else if len(tokens) == 2 &&
				tokens[0].Type == hclsyntax.TokenOQuote &&
				tokens[1].Type == hclsyntax.TokenCQuote {
				// An open quote followed immediately by a closing quote is a
				// valid but unusual blank string label.
				labelNames = append(labelNames, "")
			}

		default:
			// If neither of the previous cases are true (should be impossible)
			// then we can just ignore it, because it's invalid too.
		}
	}

	return labelNames
}
