// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

import (
	"bufio"
	"bytes"

	"github.com/apparentlymart/go-textseg/v15/textseg"
)

// RangeScanner is a helper that will scan over a buffer using a bufio.SplitFunc
// and visit a source range for each token matched.
//
// For example, this can be used with bufio.ScanLines to find the source range
// for each line in the file, skipping over the actual newline characters, which
// may be useful when printing source code snippets as part of diagnostic
// messages.
//
// The line and column information in the returned ranges is produced by
// counting newline characters and grapheme clusters respectively, which
// mimics the behavior we expect from a parser when producing ranges.
type RangeScanner struct {
	filename string
	b        []byte
	cb       bufio.SplitFunc

	pos Pos    // position of next byte to process in b
	cur Range  // latest range
	tok []byte // slice of b that is covered by cur
	err error  // error from last scan, if any
}

// NewRangeScanner creates a new RangeScanner for the given buffer, producing
// ranges for the given filename.
//
// Since ranges have grapheme-cluster granularity rather than byte granularity,
// the scanner will produce incorrect results if the given SplitFunc creates
// tokens between grapheme cluster boundaries. In particular, it is incorrect
// to use RangeScanner with bufio.ScanRunes because it will produce tokens
// around individual UTF-8 sequences, which will split any multi-sequence
// grapheme clusters.
func NewRangeScanner(b []byte, filename string, cb bufio.SplitFunc) *RangeScanner {
	return NewRangeScannerFragment(b, filename, InitialPos, cb)
}

// NewRangeScannerFragment is like NewRangeScanner but the ranges it produces
// will be offset by the given starting position, which is appropriate for
// sub-slices of a file, whereas NewRangeScanner assumes it is scanning an
// entire file.
func NewRangeScannerFragment(b []byte, filename string, start Pos, cb bufio.SplitFunc) *RangeScanner {
	return &RangeScanner{
		filename: filename,
		b:        b,
		cb:       cb,
		pos:      start,
	}
}

func (sc *RangeScanner) Scan() bool {
	if sc.pos.Byte >= len(sc.b) || sc.err != nil {
		// All done
		return false
	}

	// Since we're operating on an in-memory buffer, we always pass the whole
	// remainder of the buffer to our SplitFunc and set isEOF to let it know
	// that it has the whole thing.
	advance, token, err := sc.cb(sc.b[sc.pos.Byte:], true)

	// Since we are setting isEOF to true this should never happen, but
	// if it does we will just abort and assume the SplitFunc is misbehaving.
	if advance == 0 && token == nil && err == nil {
		return false
	}

	if err != nil {
		sc.err = err
		sc.cur = Range{
			Filename: sc.filename,
			Start:    sc.pos,
			End:      sc.pos,
		}
		sc.tok = nil
		return false
	}

	sc.tok = token
	start := sc.pos
	end := sc.pos
	new := sc.pos

	// adv is similar to token but it also includes any subsequent characters
	// we're being asked to skip over by the SplitFunc.
	// adv is a slice covering any additional bytes we are skipping over, based
	// on what the SplitFunc told us to do with advance.
	adv := sc.b[sc.pos.Byte : sc.pos.Byte+advance]

	// We now need to scan over our token to count the grapheme clusters
	// so we can correctly advance Column, and count the newlines so we
	// can correctly advance Line.
	advR := bytes.NewReader(adv)
	gsc := bufio.NewScanner(advR)
	advanced := 0
	gsc.Split(textseg.ScanGraphemeClusters)
	for gsc.Scan() {
		gr := gsc.Bytes()
		new.Byte += len(gr)
		new.Column++

		// We rely here on the fact that \r\n is considered a grapheme cluster
		// and so we don't need to worry about miscounting additional lines
		// on files with Windows-style line endings.
		if len(gr) != 0 && (gr[0] == '\r' || gr[0] == '\n') {
			new.Column = 1
			new.Line++
		}

		if advanced < len(token) {
			// If we've not yet found the end of our token then we'll
			// also push our "end" marker along.
			// (if advance > len(token) then we'll stop moving "end" early
			// so that the caller only sees the range covered by token.)
			end = new
		}
		advanced += len(gr)
	}

	sc.cur = Range{
		Filename: sc.filename,
		Start:    start,
		End:      end,
	}
	sc.pos = new
	return true
}

// Range returns a range that covers the latest token obtained after a call
// to Scan returns true.
func (sc *RangeScanner) Range() Range {
	return sc.cur
}

// Bytes returns the slice of the input buffer that is covered by the range
// that would be returned by Range.
func (sc *RangeScanner) Bytes() []byte {
	return sc.tok
}

// Err can be called after Scan returns false to determine if the latest read
// resulted in an error, and obtain that error if so.
func (sc *RangeScanner) Err() error {
	return sc.err
}
