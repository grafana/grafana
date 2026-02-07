// Copyright 2011 The Snappy-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package snappy

import (
	"io"

	"github.com/klauspost/compress/s2"
)

// Encode returns the encoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire encoded block.
// Otherwise, a newly allocated slice will be returned.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
//
// Encode handles the Snappy block format, not the Snappy stream format.
func Encode(dst, src []byte) []byte {
	return s2.EncodeSnappyBetter(dst, src)
}

// MaxEncodedLen returns the maximum length of a snappy block, given its
// uncompressed length.
//
// It will return a negative value if srcLen is too large to encode.
func MaxEncodedLen(srcLen int) int {
	return s2.MaxEncodedLen(srcLen)
}

// NewWriter returns a new Writer that compresses to w.
//
// The Writer returned does not buffer writes. There is no need to Flush or
// Close such a Writer.
//
// Deprecated: the Writer returned is not suitable for many small writes, only
// for few large writes. Use NewBufferedWriter instead, which is efficient
// regardless of the frequency and shape of the writes, and remember to Close
// that Writer when done.
func NewWriter(w io.Writer) *Writer {
	return s2.NewWriter(w, s2.WriterSnappyCompat(), s2.WriterBetterCompression(), s2.WriterFlushOnWrite(), s2.WriterConcurrency(1))
}

// NewBufferedWriter returns a new Writer that compresses to w, using the
// framing format described at
// https://github.com/google/snappy/blob/master/framing_format.txt
//
// The Writer returned buffers writes. Users must call Close to guarantee all
// data has been forwarded to the underlying io.Writer. They may also call
// Flush zero or more times before calling Close.
func NewBufferedWriter(w io.Writer) *Writer {
	return s2.NewWriter(w, s2.WriterSnappyCompat(), s2.WriterBetterCompression())
}

// Writer is an io.Writer that can write Snappy-compressed bytes.
//
// Writer handles the Snappy stream format, not the Snappy block format.
type Writer = s2.Writer
