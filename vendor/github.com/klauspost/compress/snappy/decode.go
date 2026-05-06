// Copyright 2011 The Snappy-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package snappy

import (
	"io"

	"github.com/klauspost/compress/s2"
)

var (
	// ErrCorrupt reports that the input is invalid.
	ErrCorrupt = s2.ErrCorrupt
	// ErrTooLarge reports that the uncompressed length is too large.
	ErrTooLarge = s2.ErrTooLarge
	// ErrUnsupported reports that the input isn't supported.
	ErrUnsupported = s2.ErrUnsupported
)

const (
	// maxBlockSize is the maximum size of the input to encodeBlock. It is not
	// part of the wire format per se, but some parts of the encoder assume
	// that an offset fits into a uint16.
	//
	// Also, for the framing format (Writer type instead of Encode function),
	// https://github.com/google/snappy/blob/master/framing_format.txt says
	// that "the uncompressed data in a chunk must be no longer than 65536
	// bytes".
	maxBlockSize = 65536
)

// DecodedLen returns the length of the decoded block.
func DecodedLen(src []byte) (int, error) {
	return s2.DecodedLen(src)
}

// Decode returns the decoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire decoded block.
// Otherwise, a newly allocated slice will be returned.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
//
// Decode handles the Snappy block format, not the Snappy stream format.
func Decode(dst, src []byte) ([]byte, error) {
	return s2.Decode(dst, src)
}

// NewReader returns a new Reader that decompresses from r, using the framing
// format described at
// https://github.com/google/snappy/blob/master/framing_format.txt
func NewReader(r io.Reader) *Reader {
	return s2.NewReader(r, s2.ReaderMaxBlockSize(maxBlockSize))
}

// Reader is an io.Reader that can read Snappy-compressed bytes.
//
// Reader handles the Snappy stream format, not the Snappy block format.
type Reader = s2.Reader
