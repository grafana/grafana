// Copyright 2019 The Prometheus Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package wal

import (
	"encoding/binary"
	"hash/crc32"
	"io"

	"github.com/golang/snappy"
	"github.com/pkg/errors"
)

// Reader reads WAL records from an io.Reader.
type Reader struct {
	rdr       io.Reader
	err       error
	rec       []byte
	snappyBuf []byte
	buf       [pageSize]byte
	total     int64   // Total bytes processed.
	curRecTyp recType // Used for checking that the last record is not torn.
}

// NewReader returns a new reader.
func NewReader(r io.Reader) *Reader {
	return &Reader{rdr: r}
}

// Next advances the reader to the next records and returns true if it exists.
// It must not be called again after it returned false.
func (r *Reader) Next() bool {
	err := r.next()
	if errors.Cause(err) == io.EOF {
		// The last WAL segment record shouldn't be torn(should be full or last).
		// The last record would be torn after a crash just before
		// the last record part could be persisted to disk.
		if r.curRecTyp == recFirst || r.curRecTyp == recMiddle {
			r.err = errors.New("last record is torn")
		}
		return false
	}
	r.err = err
	return r.err == nil
}

func (r *Reader) next() (err error) {
	// We have to use r.buf since allocating byte arrays here fails escape
	// analysis and ends up on the heap, even though it seemingly should not.
	hdr := r.buf[:recordHeaderSize]
	buf := r.buf[recordHeaderSize:]

	r.rec = r.rec[:0]
	r.snappyBuf = r.snappyBuf[:0]

	i := 0
	for {
		if _, err = io.ReadFull(r.rdr, hdr[:1]); err != nil {
			return errors.Wrap(err, "read first header byte")
		}
		r.total++
		r.curRecTyp = recTypeFromHeader(hdr[0])
		compressed := hdr[0]&snappyMask != 0

		// Gobble up zero bytes.
		if r.curRecTyp == recPageTerm {
			// recPageTerm is a single byte that indicates the rest of the page is padded.
			// If it's the first byte in a page, buf is too small and
			// needs to be resized to fit pageSize-1 bytes.
			buf = r.buf[1:]

			// We are pedantic and check whether the zeros are actually up
			// to a page boundary.
			// It's not strictly necessary but may catch sketchy state early.
			k := pageSize - (r.total % pageSize)
			if k == pageSize {
				continue // Initial 0 byte was last page byte.
			}
			n, err := io.ReadFull(r.rdr, buf[:k])
			if err != nil {
				return errors.Wrap(err, "read remaining zeros")
			}
			r.total += int64(n)

			for _, c := range buf[:k] {
				if c != 0 {
					return errors.New("unexpected non-zero byte in padded page")
				}
			}
			continue
		}
		n, err := io.ReadFull(r.rdr, hdr[1:])
		if err != nil {
			return errors.Wrap(err, "read remaining header")
		}
		r.total += int64(n)

		var (
			length = binary.BigEndian.Uint16(hdr[1:])
			crc    = binary.BigEndian.Uint32(hdr[3:])
		)

		if length > pageSize-recordHeaderSize {
			return errors.Errorf("invalid record size %d", length)
		}
		n, err = io.ReadFull(r.rdr, buf[:length])
		if err != nil {
			return err
		}
		r.total += int64(n)

		if n != int(length) {
			return errors.Errorf("invalid size: expected %d, got %d", length, n)
		}
		if c := crc32.Checksum(buf[:length], castagnoliTable); c != crc {
			return errors.Errorf("unexpected checksum %x, expected %x", c, crc)
		}

		if compressed {
			r.snappyBuf = append(r.snappyBuf, buf[:length]...)
		} else {
			r.rec = append(r.rec, buf[:length]...)
		}

		if err := validateRecord(r.curRecTyp, i); err != nil {
			return err
		}
		if r.curRecTyp == recLast || r.curRecTyp == recFull {
			if compressed && len(r.snappyBuf) > 0 {
				// The snappy library uses `len` to calculate if we need a new buffer.
				// In order to allocate as few buffers as possible make the length
				// equal to the capacity.
				r.rec = r.rec[:cap(r.rec)]
				r.rec, err = snappy.Decode(r.rec, r.snappyBuf)
				return err
			}
			return nil
		}

		// Only increment i for non-zero records since we use it
		// to determine valid content record sequences.
		i++
	}
}

// Err returns the last encountered error wrapped in a corruption error.
// If the reader does not allow to infer a segment index and offset, a total
// offset in the reader stream will be provided.
func (r *Reader) Err() error {
	if r.err == nil {
		return nil
	}
	if b, ok := r.rdr.(*segmentBufReader); ok {
		return &CorruptionErr{
			Err:     r.err,
			Dir:     b.segs[b.cur].Dir(),
			Segment: b.segs[b.cur].Index(),
			Offset:  int64(b.off),
		}
	}
	return &CorruptionErr{
		Err:     r.err,
		Segment: -1,
		Offset:  r.total,
	}
}

// Record returns the current record. The returned byte slice is only
// valid until the next call to Next.
func (r *Reader) Record() []byte {
	return r.rec
}

// Segment returns the current segment being read.
func (r *Reader) Segment() int {
	if b, ok := r.rdr.(*segmentBufReader); ok {
		return b.segs[b.cur].Index()
	}
	return -1
}

// Offset returns the current position of the segment being read.
func (r *Reader) Offset() int64 {
	if b, ok := r.rdr.(*segmentBufReader); ok {
		return int64(b.off)
	}
	return r.total
}
