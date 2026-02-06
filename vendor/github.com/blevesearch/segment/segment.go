//  Copyright (c) 2015 Couchbase, Inc.
//  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
//  except in compliance with the License. You may obtain a copy of the License at
//    http://www.apache.org/licenses/LICENSE-2.0
//  Unless required by applicable law or agreed to in writing, software distributed under the
//  License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
//  either express or implied. See the License for the specific language governing permissions
//  and limitations under the License.

package segment

import (
	"errors"
	"io"
)

// Autogenerate the following:
// 1. Ragel rules from subset of Unicode script properties
// 2. Ragel rules from Unicode word segmentation properties
// 3. Ragel machine for word segmentation
// 4. Test tables from Unicode
//
// Requires:
// 1. Ruby (to generate ragel rules from unicode spec)
// 2. Ragel (only v6.9 tested)
// 3. sed (to rewrite build tags)
//
//go:generate ragel/unicode2ragel.rb -u http://www.unicode.org/Public/8.0.0/ucd/Scripts.txt -m SCRIPTS -p Hangul,Han,Hiragana -o ragel/uscript.rl
//go:generate ragel/unicode2ragel.rb -u http://www.unicode.org/Public/8.0.0/ucd/auxiliary/WordBreakProperty.txt -m WB -p Double_Quote,Single_Quote,Hebrew_Letter,CR,LF,Newline,Extend,Format,Katakana,ALetter,MidLetter,MidNum,MidNumLet,Numeric,ExtendNumLet,Regional_Indicator -o ragel/uwb.rl
//go:generate ragel -T1 -Z segment_words.rl -o segment_words.go
//go:generate sed -i "" -e "s/BUILDTAGS/!prod/" segment_words.go
//go:generate sed -i "" -e "s/RAGELFLAGS/-T1/" segment_words.go
//go:generate ragel -G2 -Z segment_words.rl -o segment_words_prod.go
//go:generate sed -i "" -e "s/BUILDTAGS/prod/" segment_words_prod.go
//go:generate sed -i "" -e "s/RAGELFLAGS/-G2/" segment_words_prod.go
//go:generate go run maketesttables.go -output tables_test.go

// NewWordSegmenter returns a new Segmenter to read from r.
func NewWordSegmenter(r io.Reader) *Segmenter {
	return NewSegmenter(r)
}

// NewWordSegmenterDirect returns a new Segmenter to work directly with buf.
func NewWordSegmenterDirect(buf []byte) *Segmenter {
	return NewSegmenterDirect(buf)
}

func SplitWords(data []byte, atEOF bool) (int, []byte, error) {
	advance, token, _, err := SegmentWords(data, atEOF)
	return advance, token, err
}

func SegmentWords(data []byte, atEOF bool) (int, []byte, int, error) {
	vals := make([][]byte, 0, 1)
	types := make([]int, 0, 1)
	tokens, types, advance, err := segmentWords(data, 1, atEOF, vals, types)
	if len(tokens) > 0 {
		return advance, tokens[0], types[0], err
	}
	return advance, nil, 0, err
}

func SegmentWordsDirect(data []byte, val [][]byte, types []int) ([][]byte, []int, int, error) {
	return segmentWords(data, -1, true, val, types)
}

// *** Core Segmenter

const maxConsecutiveEmptyReads = 100

// NewSegmenter returns a new Segmenter to read from r.
// Defaults to segment using SegmentWords
func NewSegmenter(r io.Reader) *Segmenter {
	return &Segmenter{
		r:            r,
		segment:      SegmentWords,
		maxTokenSize: MaxScanTokenSize,
		buf:          make([]byte, 4096), // Plausible starting size; needn't be large.
	}
}

// NewSegmenterDirect returns a new Segmenter to work directly with buf.
// Defaults to segment using SegmentWords
func NewSegmenterDirect(buf []byte) *Segmenter {
	return &Segmenter{
		segment:      SegmentWords,
		maxTokenSize: MaxScanTokenSize,
		buf:          buf,
		start:        0,
		end:          len(buf),
		err:          io.EOF,
	}
}

// Segmenter provides a convenient interface for reading data such as
// a file of newline-delimited lines of text. Successive calls to
// the Segment method will step through the 'tokens' of a file, skipping
// the bytes between the tokens. The specification of a token is
// defined by a split function of type SplitFunc; the default split
// function breaks the input into lines with line termination stripped. Split
// functions are defined in this package for scanning a file into
// lines, bytes, UTF-8-encoded runes, and space-delimited words. The
// client may instead provide a custom split function.
//
// Segmenting stops unrecoverably at EOF, the first I/O error, or a token too
// large to fit in the buffer. When a scan stops, the reader may have
// advanced arbitrarily far past the last token. Programs that need more
// control over error handling or large tokens, or must run sequential scans
// on a reader, should use bufio.Reader instead.
//
type Segmenter struct {
	r            io.Reader   // The reader provided by the client.
	segment      SegmentFunc // The function to split the tokens.
	maxTokenSize int         // Maximum size of a token; modified by tests.
	token        []byte      // Last token returned by split.
	buf          []byte      // Buffer used as argument to split.
	start        int         // First non-processed byte in buf.
	end          int         // End of data in buf.
	typ          int         // The token type
	err          error       // Sticky error.
}

// SegmentFunc is the signature of the segmenting function used to tokenize the
// input. The arguments are an initial substring of the remaining unprocessed
// data and a flag, atEOF, that reports whether the Reader has no more data
// to give. The return values are the number of bytes to advance the input
// and the next token to return to the user, plus an error, if any. If the
// data does not yet hold a complete token, for instance if it has no newline
// while scanning lines, SegmentFunc can return (0, nil, nil) to signal the
// Segmenter to read more data into the slice and try again with a longer slice
// starting at the same point in the input.
//
// If the returned error is non-nil, segmenting stops and the error
// is returned to the client.
//
// The function is never called with an empty data slice unless atEOF
// is true. If atEOF is true, however, data may be non-empty and,
// as always, holds unprocessed text.
type SegmentFunc func(data []byte, atEOF bool) (advance int, token []byte, segmentType int, err error)

// Errors returned by Segmenter.
var (
	ErrTooLong         = errors.New("bufio.Segmenter: token too long")
	ErrNegativeAdvance = errors.New("bufio.Segmenter: SplitFunc returns negative advance count")
	ErrAdvanceTooFar   = errors.New("bufio.Segmenter: SplitFunc returns advance count beyond input")
)

const (
	// Maximum size used to buffer a token. The actual maximum token size
	// may be smaller as the buffer may need to include, for instance, a newline.
	MaxScanTokenSize = 64 * 1024
)

// Err returns the first non-EOF error that was encountered by the Segmenter.
func (s *Segmenter) Err() error {
	if s.err == io.EOF {
		return nil
	}
	return s.err
}

func (s *Segmenter) Type() int {
	return s.typ
}

// Bytes returns the most recent token generated by a call to Segment.
// The underlying array may point to data that will be overwritten
// by a subsequent call to Segment. It does no allocation.
func (s *Segmenter) Bytes() []byte {
	return s.token
}

// Text returns the most recent token generated by a call to Segment
// as a newly allocated string holding its bytes.
func (s *Segmenter) Text() string {
	return string(s.token)
}

// Segment advances the Segmenter to the next token, which will then be
// available through the Bytes or Text method. It returns false when the
// scan stops, either by reaching the end of the input or an error.
// After Segment returns false, the Err method will return any error that
// occurred during scanning, except that if it was io.EOF, Err
// will return nil.
func (s *Segmenter) Segment() bool {
	// Loop until we have a token.
	for {
		// See if we can get a token with what we already have.
		if s.end > s.start {
			advance, token, typ, err := s.segment(s.buf[s.start:s.end], s.err != nil)
			if err != nil {
				s.setErr(err)
				return false
			}
			s.typ = typ
			if !s.advance(advance) {
				return false
			}
			s.token = token
			if token != nil {
				return true
			}
		}
		// We cannot generate a token with what we are holding.
		// If we've already hit EOF or an I/O error, we are done.
		if s.err != nil {
			// Shut it down.
			s.start = 0
			s.end = 0
			return false
		}
		// Must read more data.
		// First, shift data to beginning of buffer if there's lots of empty space
		// or space is needed.
		if s.start > 0 && (s.end == len(s.buf) || s.start > len(s.buf)/2) {
			copy(s.buf, s.buf[s.start:s.end])
			s.end -= s.start
			s.start = 0
		}
		// Is the buffer full? If so, resize.
		if s.end == len(s.buf) {
			if len(s.buf) >= s.maxTokenSize {
				s.setErr(ErrTooLong)
				return false
			}
			newSize := len(s.buf) * 2
			if newSize > s.maxTokenSize {
				newSize = s.maxTokenSize
			}
			newBuf := make([]byte, newSize)
			copy(newBuf, s.buf[s.start:s.end])
			s.buf = newBuf
			s.end -= s.start
			s.start = 0
			continue
		}
		// Finally we can read some input. Make sure we don't get stuck with
		// a misbehaving Reader. Officially we don't need to do this, but let's
		// be extra careful: Segmenter is for safe, simple jobs.
		for loop := 0; ; {
			n, err := s.r.Read(s.buf[s.end:len(s.buf)])
			s.end += n
			if err != nil {
				s.setErr(err)
				break
			}
			if n > 0 {
				break
			}
			loop++
			if loop > maxConsecutiveEmptyReads {
				s.setErr(io.ErrNoProgress)
				break
			}
		}
	}
}

// advance consumes n bytes of the buffer. It reports whether the advance was legal.
func (s *Segmenter) advance(n int) bool {
	if n < 0 {
		s.setErr(ErrNegativeAdvance)
		return false
	}
	if n > s.end-s.start {
		s.setErr(ErrAdvanceTooFar)
		return false
	}
	s.start += n
	return true
}

// setErr records the first error encountered.
func (s *Segmenter) setErr(err error) {
	if s.err == nil || s.err == io.EOF {
		s.err = err
	}
}

// SetSegmenter sets the segment function for the Segmenter. If called, it must be
// called before Segment.
func (s *Segmenter) SetSegmenter(segmenter SegmentFunc) {
	s.segment = segmenter
}
