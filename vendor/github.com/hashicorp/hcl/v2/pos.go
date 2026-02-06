// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

import "fmt"

// Pos represents a single position in a source file, by addressing the
// start byte of a unicode character encoded in UTF-8.
//
// Pos is generally used only in the context of a Range, which then defines
// which source file the position is within.
type Pos struct {
	// Line is the source code line where this position points. Lines are
	// counted starting at 1 and incremented for each newline character
	// encountered.
	Line int

	// Column is the source code column where this position points, in
	// unicode characters, with counting starting at 1.
	//
	// Column counts characters as they appear visually, so for example a
	// latin letter with a combining diacritic mark counts as one character.
	// This is intended for rendering visual markers against source code in
	// contexts where these diacritics would be rendered in a single character
	// cell. Technically speaking, Column is counting grapheme clusters as
	// used in unicode normalization.
	Column int

	// Byte is the byte offset into the file where the indicated character
	// begins. This is a zero-based offset to the first byte of the first
	// UTF-8 codepoint sequence in the character, and thus gives a position
	// that can be resolved _without_ awareness of Unicode characters.
	Byte int
}

// InitialPos is a suitable position to use to mark the start of a file.
var InitialPos = Pos{Byte: 0, Line: 1, Column: 1}

// Range represents a span of characters between two positions in a source
// file.
//
// This struct is usually used by value in types that represent AST nodes,
// but by pointer in types that refer to the positions of other objects,
// such as in diagnostics.
type Range struct {
	// Filename is the name of the file into which this range's positions
	// point.
	Filename string

	// Start and End represent the bounds of this range. Start is inclusive
	// and End is exclusive.
	Start, End Pos
}

// RangeBetween returns a new range that spans from the beginning of the
// start range to the end of the end range.
//
// The result is meaningless if the two ranges do not belong to the same
// source file or if the end range appears before the start range.
func RangeBetween(start, end Range) Range {
	return Range{
		Filename: start.Filename,
		Start:    start.Start,
		End:      end.End,
	}
}

// RangeOver returns a new range that covers both of the given ranges and
// possibly additional content between them if the two ranges do not overlap.
//
// If either range is empty then it is ignored. The result is empty if both
// given ranges are empty.
//
// The result is meaningless if the two ranges to not belong to the same
// source file.
func RangeOver(a, b Range) Range {
	if a.Empty() {
		return b
	}
	if b.Empty() {
		return a
	}

	var start, end Pos
	if a.Start.Byte < b.Start.Byte {
		start = a.Start
	} else {
		start = b.Start
	}
	if a.End.Byte > b.End.Byte {
		end = a.End
	} else {
		end = b.End
	}
	return Range{
		Filename: a.Filename,
		Start:    start,
		End:      end,
	}
}

// ContainsPos returns true if and only if the given position is contained within
// the receiving range.
//
// In the unlikely case that the line/column information disagree with the byte
// offset information in the given position or receiving range, the byte
// offsets are given priority.
func (r Range) ContainsPos(pos Pos) bool {
	return r.ContainsOffset(pos.Byte)
}

// ContainsOffset returns true if and only if the given byte offset is within
// the receiving Range.
func (r Range) ContainsOffset(offset int) bool {
	return offset >= r.Start.Byte && offset < r.End.Byte
}

// Ptr returns a pointer to a copy of the receiver. This is a convenience when
// ranges in places where pointers are required, such as in Diagnostic, but
// the range in question is returned from a method. Go would otherwise not
// allow one to take the address of a function call.
func (r Range) Ptr() *Range {
	return &r
}

// String returns a compact string representation of the receiver.
// Callers should generally prefer to present a range more visually,
// e.g. via markers directly on the relevant portion of source code.
func (r Range) String() string {
	if r.Start.Line == r.End.Line {
		return fmt.Sprintf(
			"%s:%d,%d-%d",
			r.Filename,
			r.Start.Line, r.Start.Column,
			r.End.Column,
		)
	} else {
		return fmt.Sprintf(
			"%s:%d,%d-%d,%d",
			r.Filename,
			r.Start.Line, r.Start.Column,
			r.End.Line, r.End.Column,
		)
	}
}

func (r Range) Empty() bool {
	return r.Start.Byte == r.End.Byte
}

// CanSliceBytes returns true if SliceBytes could return an accurate
// sub-slice of the given slice.
//
// This effectively tests whether the start and end offsets of the range
// are within the bounds of the slice, and thus whether SliceBytes can be
// trusted to produce an accurate start and end position within that slice.
func (r Range) CanSliceBytes(b []byte) bool {
	switch {
	case r.Start.Byte < 0 || r.Start.Byte > len(b):
		return false
	case r.End.Byte < 0 || r.End.Byte > len(b):
		return false
	case r.End.Byte < r.Start.Byte:
		return false
	default:
		return true
	}
}

// SliceBytes returns a sub-slice of the given slice that is covered by the
// receiving range, assuming that the given slice is the source code of the
// file indicated by r.Filename.
//
// If the receiver refers to any byte offsets that are outside of the slice
// then the result is constrained to the overlapping portion only, to avoid
// a panic. Use CanSliceBytes to determine if the result is guaranteed to
// be an accurate span of the requested range.
func (r Range) SliceBytes(b []byte) []byte {
	start := r.Start.Byte
	end := r.End.Byte
	if start < 0 {
		start = 0
	} else if start > len(b) {
		start = len(b)
	}
	if end < 0 {
		end = 0
	} else if end > len(b) {
		end = len(b)
	}
	if end < start {
		end = start
	}
	return b[start:end]
}

// Overlaps returns true if the receiver and the other given range share any
// characters in common.
func (r Range) Overlaps(other Range) bool {
	switch {
	case r.Filename != other.Filename:
		// If the ranges are in different files then they can't possibly overlap
		return false
	case r.Empty() || other.Empty():
		// Empty ranges can never overlap
		return false
	case r.ContainsOffset(other.Start.Byte) || r.ContainsOffset(other.End.Byte):
		return true
	case other.ContainsOffset(r.Start.Byte) || other.ContainsOffset(r.End.Byte):
		return true
	default:
		return false
	}
}

// Overlap finds a range that is either identical to or a sub-range of both
// the receiver and the other given range. It returns an empty range
// within the receiver if there is no overlap between the two ranges.
//
// A non-empty result is either identical to or a subset of the receiver.
func (r Range) Overlap(other Range) Range {
	if !r.Overlaps(other) {
		// Start == End indicates an empty range
		return Range{
			Filename: r.Filename,
			Start:    r.Start,
			End:      r.Start,
		}
	}

	var start, end Pos
	if r.Start.Byte > other.Start.Byte {
		start = r.Start
	} else {
		start = other.Start
	}
	if r.End.Byte < other.End.Byte {
		end = r.End
	} else {
		end = other.End
	}

	return Range{
		Filename: r.Filename,
		Start:    start,
		End:      end,
	}
}

// PartitionAround finds the portion of the given range that overlaps with
// the reciever and returns three ranges: the portion of the reciever that
// precedes the overlap, the overlap itself, and then the portion of the
// reciever that comes after the overlap.
//
// If the two ranges do not overlap then all three returned ranges are empty.
//
// If the given range aligns with or extends beyond either extent of the
// reciever then the corresponding outer range will be empty.
func (r Range) PartitionAround(other Range) (before, overlap, after Range) {
	overlap = r.Overlap(other)
	if overlap.Empty() {
		return overlap, overlap, overlap
	}

	before = Range{
		Filename: r.Filename,
		Start:    r.Start,
		End:      overlap.Start,
	}
	after = Range{
		Filename: r.Filename,
		Start:    overlap.End,
		End:      r.End,
	}

	return before, overlap, after
}
