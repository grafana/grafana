// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclwrite

import (
	"bytes"

	"github.com/hashicorp/hcl/v2"
)

// NewFile creates a new file object that is empty and ready to have constructs
// added t it.
func NewFile() *File {
	body := &Body{
		inTree: newInTree(),
		items:  newNodeSet(),
	}
	file := &File{
		inTree: newInTree(),
	}
	file.body = file.inTree.children.Append(body)
	return file
}

// ParseConfig interprets the given source bytes into a *hclwrite.File. The
// resulting AST can be used to perform surgical edits on the source code
// before turning it back into bytes again.
func ParseConfig(src []byte, filename string, start hcl.Pos) (*File, hcl.Diagnostics) {
	return parse(src, filename, start)
}

// Format takes source code and performs simple whitespace changes to transform
// it to a canonical layout style.
//
// Format skips constructing an AST and works directly with tokens, so it
// is less expensive than formatting via the AST for situations where no other
// changes will be made. It also ignores syntax errors and can thus be applied
// to partial source code, although the result in that case may not be
// desirable.
func Format(src []byte) []byte {
	tokens := lexConfig(src)
	format(tokens)
	buf := &bytes.Buffer{}
	tokens.WriteTo(buf)
	return buf.Bytes()
}
