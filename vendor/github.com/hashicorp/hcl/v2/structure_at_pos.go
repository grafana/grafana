// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

// -----------------------------------------------------------------------------
// The methods in this file all have the general pattern of making a best-effort
// to find one or more constructs that contain a given source position.
//
// These all operate by delegating to an optional method of the same name and
// signature on the file's root body, allowing each syntax to potentially
// provide its own implementations of these. For syntaxes that don't implement
// them, the result is always nil.
// -----------------------------------------------------------------------------

// BlocksAtPos attempts to find all of the blocks that contain the given
// position, ordered so that the outermost block is first and the innermost
// block is last. This is a best-effort method that may not be able to produce
// a complete result for all positions or for all HCL syntaxes.
//
// If the returned slice is non-empty, the first element is guaranteed to
// represent the same block as would be the result of OutermostBlockAtPos and
// the last element the result of InnermostBlockAtPos. However, the
// implementation may return two different objects describing the same block,
// so comparison by pointer identity is not possible.
//
// The result is nil if no blocks at all contain the given position.
func (f *File) BlocksAtPos(pos Pos) []*Block {
	// The root body of the file must implement this interface in order
	// to support BlocksAtPos.
	type Interface interface {
		BlocksAtPos(pos Pos) []*Block
	}

	impl, ok := f.Body.(Interface)
	if !ok {
		return nil
	}
	return impl.BlocksAtPos(pos)
}

// OutermostBlockAtPos attempts to find a top-level block in the receiving file
// that contains the given position. This is a best-effort method that may not
// be able to produce a result for all positions or for all HCL syntaxes.
//
// The result is nil if no single block could be selected for any reason.
func (f *File) OutermostBlockAtPos(pos Pos) *Block {
	// The root body of the file must implement this interface in order
	// to support OutermostBlockAtPos.
	type Interface interface {
		OutermostBlockAtPos(pos Pos) *Block
	}

	impl, ok := f.Body.(Interface)
	if !ok {
		return nil
	}
	return impl.OutermostBlockAtPos(pos)
}

// InnermostBlockAtPos attempts to find the most deeply-nested block in the
// receiving file that contains the given position. This is a best-effort
// method that may not be able to produce a result for all positions or for
// all HCL syntaxes.
//
// The result is nil if no single block could be selected for any reason.
func (f *File) InnermostBlockAtPos(pos Pos) *Block {
	// The root body of the file must implement this interface in order
	// to support InnermostBlockAtPos.
	type Interface interface {
		InnermostBlockAtPos(pos Pos) *Block
	}

	impl, ok := f.Body.(Interface)
	if !ok {
		return nil
	}
	return impl.InnermostBlockAtPos(pos)
}

// OutermostExprAtPos attempts to find an expression in the receiving file
// that contains the given position. This is a best-effort method that may not
// be able to produce a result for all positions or for all HCL syntaxes.
//
// Since expressions are often nested inside one another, this method returns
// the outermost "root" expression that is not contained by any other.
//
// The result is nil if no single expression could be selected for any reason.
func (f *File) OutermostExprAtPos(pos Pos) Expression {
	// The root body of the file must implement this interface in order
	// to support OutermostExprAtPos.
	type Interface interface {
		OutermostExprAtPos(pos Pos) Expression
	}

	impl, ok := f.Body.(Interface)
	if !ok {
		return nil
	}
	return impl.OutermostExprAtPos(pos)
}

// AttributeAtPos attempts to find an attribute definition in the receiving
// file that contains the given position. This is a best-effort method that may
// not be able to produce a result for all positions or for all HCL syntaxes.
//
// The result is nil if no single attribute could be selected for any reason.
func (f *File) AttributeAtPos(pos Pos) *Attribute {
	// The root body of the file must implement this interface in order
	// to support OutermostExprAtPos.
	type Interface interface {
		AttributeAtPos(pos Pos) *Attribute
	}

	impl, ok := f.Body.(Interface)
	if !ok {
		return nil
	}
	return impl.AttributeAtPos(pos)
}
