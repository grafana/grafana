// Copyright 2017 The Prometheus Authors
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

package index

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"hash"
	"hash/crc32"
	"io"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/pkg/errors"
	"github.com/prometheus/tsdb/chunks"
	"github.com/prometheus/tsdb/fileutil"
	"github.com/prometheus/tsdb/labels"
)

const (
	// MagicIndex 4 bytes at the head of an index file.
	MagicIndex = 0xBAAAD700

	indexFormatV1 = 1
	indexFormatV2 = 2

	labelNameSeperator = "\xff"
)

type indexWriterSeries struct {
	labels labels.Labels
	chunks []chunks.Meta // series file offset of chunks
	offset uint32        // index file offset of series reference
}

type indexWriterSeriesSlice []*indexWriterSeries

func (s indexWriterSeriesSlice) Len() int      { return len(s) }
func (s indexWriterSeriesSlice) Swap(i, j int) { s[i], s[j] = s[j], s[i] }

func (s indexWriterSeriesSlice) Less(i, j int) bool {
	return labels.Compare(s[i].labels, s[j].labels) < 0
}

type indexWriterStage uint8

const (
	idxStageNone indexWriterStage = iota
	idxStageSymbols
	idxStageSeries
	idxStageLabelIndex
	idxStagePostings
	idxStageDone
)

func (s indexWriterStage) String() string {
	switch s {
	case idxStageNone:
		return "none"
	case idxStageSymbols:
		return "symbols"
	case idxStageSeries:
		return "series"
	case idxStageLabelIndex:
		return "label index"
	case idxStagePostings:
		return "postings"
	case idxStageDone:
		return "done"
	}
	return "<unknown>"
}

// The table gets initialized with sync.Once but may still cause a race
// with any other use of the crc32 package anywhere. Thus we initialize it
// before.
var castagnoliTable *crc32.Table

func init() {
	castagnoliTable = crc32.MakeTable(crc32.Castagnoli)
}

// newCRC32 initializes a CRC32 hash with a preconfigured polynomial, so the
// polynomial may be easily changed in one location at a later time, if necessary.
func newCRC32() hash.Hash32 {
	return crc32.New(castagnoliTable)
}

// Writer implements the IndexWriter interface for the standard
// serialization format.
type Writer struct {
	f    *os.File
	fbuf *bufio.Writer
	pos  uint64

	toc   indexTOC
	stage indexWriterStage

	// Reusable memory.
	buf1    encbuf
	buf2    encbuf
	uint32s []uint32

	symbols       map[string]uint32 // symbol offsets
	seriesOffsets map[uint64]uint64 // offsets of series
	labelIndexes  []hashEntry       // label index offsets
	postings      []hashEntry       // postings lists offsets

	// Hold last series to validate that clients insert new series in order.
	lastSeries labels.Labels

	crc32 hash.Hash

	Version int
}

type indexTOC struct {
	symbols           uint64
	series            uint64
	labelIndices      uint64
	labelIndicesTable uint64
	postings          uint64
	postingsTable     uint64
}

// NewWriter returns a new Writer to the given filename. It serializes data in format version 2.
func NewWriter(fn string) (*Writer, error) {
	dir := filepath.Dir(fn)

	df, err := fileutil.OpenDir(dir)
	if err != nil {
		return nil, err
	}
	defer df.Close() // Close for platform windows.

	if err := os.RemoveAll(fn); err != nil {
		return nil, errors.Wrap(err, "remove any existing index at path")
	}

	f, err := os.OpenFile(fn, os.O_CREATE|os.O_WRONLY, 0666)
	if err != nil {
		return nil, err
	}
	if err := fileutil.Fsync(df); err != nil {
		return nil, errors.Wrap(err, "sync dir")
	}

	iw := &Writer{
		f:     f,
		fbuf:  bufio.NewWriterSize(f, 1<<22),
		pos:   0,
		stage: idxStageNone,

		// Reusable memory.
		buf1:    encbuf{b: make([]byte, 0, 1<<22)},
		buf2:    encbuf{b: make([]byte, 0, 1<<22)},
		uint32s: make([]uint32, 0, 1<<15),

		// Caches.
		symbols:       make(map[string]uint32, 1<<13),
		seriesOffsets: make(map[uint64]uint64, 1<<16),
		crc32:         newCRC32(),
	}
	if err := iw.writeMeta(); err != nil {
		return nil, err
	}
	return iw, nil
}

func (w *Writer) write(bufs ...[]byte) error {
	for _, b := range bufs {
		n, err := w.fbuf.Write(b)
		w.pos += uint64(n)
		if err != nil {
			return err
		}
		// For now the index file must not grow beyond 64GiB. Some of the fixed-sized
		// offset references in v1 are only 4 bytes large.
		// Once we move to compressed/varint representations in those areas, this limitation
		// can be lifted.
		if w.pos > 16*math.MaxUint32 {
			return errors.Errorf("exceeding max size of 64GiB")
		}
	}
	return nil
}

// addPadding adds zero byte padding until the file size is a multiple size.
func (w *Writer) addPadding(size int) error {
	p := w.pos % uint64(size)
	if p == 0 {
		return nil
	}
	p = uint64(size) - p
	return errors.Wrap(w.write(make([]byte, p)), "add padding")
}

// ensureStage handles transitions between write stages and ensures that IndexWriter
// methods are called in an order valid for the implementation.
func (w *Writer) ensureStage(s indexWriterStage) error {
	if w.stage == s {
		return nil
	}
	if w.stage > s {
		return errors.Errorf("invalid stage %q, currently at %q", s, w.stage)
	}

	// Mark start of sections in table of contents.
	switch s {
	case idxStageSymbols:
		w.toc.symbols = w.pos
	case idxStageSeries:
		w.toc.series = w.pos

	case idxStageLabelIndex:
		w.toc.labelIndices = w.pos

	case idxStagePostings:
		w.toc.postings = w.pos

	case idxStageDone:
		w.toc.labelIndicesTable = w.pos
		if err := w.writeOffsetTable(w.labelIndexes); err != nil {
			return err
		}
		w.toc.postingsTable = w.pos
		if err := w.writeOffsetTable(w.postings); err != nil {
			return err
		}
		if err := w.writeTOC(); err != nil {
			return err
		}
	}

	w.stage = s
	return nil
}

func (w *Writer) writeMeta() error {
	w.buf1.reset()
	w.buf1.putBE32(MagicIndex)
	w.buf1.putByte(indexFormatV2)

	return w.write(w.buf1.get())
}

// AddSeries adds the series one at a time along with its chunks.
func (w *Writer) AddSeries(ref uint64, lset labels.Labels, chunks ...chunks.Meta) error {
	if err := w.ensureStage(idxStageSeries); err != nil {
		return err
	}
	if labels.Compare(lset, w.lastSeries) <= 0 {
		return errors.Errorf("out-of-order series added with label set %q", lset)
	}

	if _, ok := w.seriesOffsets[ref]; ok {
		return errors.Errorf("series with reference %d already added", ref)
	}
	// We add padding to 16 bytes to increase the addressable space we get through 4 byte
	// series references.
	if err := w.addPadding(16); err != nil {
		return errors.Errorf("failed to write padding bytes: %v", err)
	}

	if w.pos%16 != 0 {
		return errors.Errorf("series write not 16-byte aligned at %d", w.pos)
	}
	w.seriesOffsets[ref] = w.pos / 16

	w.buf2.reset()
	w.buf2.putUvarint(len(lset))

	for _, l := range lset {
		// here we have an index for the symbol file if v2, otherwise it's an offset
		index, ok := w.symbols[l.Name]
		if !ok {
			return errors.Errorf("symbol entry for %q does not exist", l.Name)
		}
		w.buf2.putUvarint32(index)

		index, ok = w.symbols[l.Value]
		if !ok {
			return errors.Errorf("symbol entry for %q does not exist", l.Value)
		}
		w.buf2.putUvarint32(index)
	}

	w.buf2.putUvarint(len(chunks))

	if len(chunks) > 0 {
		c := chunks[0]
		w.buf2.putVarint64(c.MinTime)
		w.buf2.putUvarint64(uint64(c.MaxTime - c.MinTime))
		w.buf2.putUvarint64(c.Ref)
		t0 := c.MaxTime
		ref0 := int64(c.Ref)

		for _, c := range chunks[1:] {
			w.buf2.putUvarint64(uint64(c.MinTime - t0))
			w.buf2.putUvarint64(uint64(c.MaxTime - c.MinTime))
			t0 = c.MaxTime

			w.buf2.putVarint64(int64(c.Ref) - ref0)
			ref0 = int64(c.Ref)
		}
	}

	w.buf1.reset()
	w.buf1.putUvarint(w.buf2.len())

	w.buf2.putHash(w.crc32)

	if err := w.write(w.buf1.get(), w.buf2.get()); err != nil {
		return errors.Wrap(err, "write series data")
	}

	w.lastSeries = append(w.lastSeries[:0], lset...)

	return nil
}

func (w *Writer) AddSymbols(sym map[string]struct{}) error {
	if err := w.ensureStage(idxStageSymbols); err != nil {
		return err
	}
	// Generate sorted list of strings we will store as reference table.
	symbols := make([]string, 0, len(sym))

	for s := range sym {
		symbols = append(symbols, s)
	}
	sort.Strings(symbols)

	const headerSize = 4

	w.buf1.reset()
	w.buf2.reset()

	w.buf2.putBE32int(len(symbols))

	w.symbols = make(map[string]uint32, len(symbols))

	for index, s := range symbols {
		w.symbols[s] = uint32(index)
		w.buf2.putUvarintStr(s)
	}

	w.buf1.putBE32int(w.buf2.len())
	w.buf2.putHash(w.crc32)

	err := w.write(w.buf1.get(), w.buf2.get())
	return errors.Wrap(err, "write symbols")
}

func (w *Writer) WriteLabelIndex(names []string, values []string) error {
	if len(values)%len(names) != 0 {
		return errors.Errorf("invalid value list length %d for %d names", len(values), len(names))
	}
	if err := w.ensureStage(idxStageLabelIndex); err != nil {
		return errors.Wrap(err, "ensure stage")
	}

	valt, err := NewStringTuples(values, len(names))
	if err != nil {
		return err
	}
	sort.Sort(valt)

	// Align beginning to 4 bytes for more efficient index list scans.
	if err := w.addPadding(4); err != nil {
		return err
	}

	w.labelIndexes = append(w.labelIndexes, hashEntry{
		keys:   names,
		offset: w.pos,
	})

	w.buf2.reset()
	w.buf2.putBE32int(len(names))
	w.buf2.putBE32int(valt.Len())

	// here we have an index for the symbol file if v2, otherwise it's an offset
	for _, v := range valt.entries {
		index, ok := w.symbols[v]
		if !ok {
			return errors.Errorf("symbol entry for %q does not exist", v)
		}
		w.buf2.putBE32(index)
	}

	w.buf1.reset()
	w.buf1.putBE32int(w.buf2.len())

	w.buf2.putHash(w.crc32)

	err = w.write(w.buf1.get(), w.buf2.get())
	return errors.Wrap(err, "write label index")
}

// writeOffsetTable writes a sequence of readable hash entries.
func (w *Writer) writeOffsetTable(entries []hashEntry) error {
	w.buf2.reset()
	w.buf2.putBE32int(len(entries))

	for _, e := range entries {
		w.buf2.putUvarint(len(e.keys))
		for _, k := range e.keys {
			w.buf2.putUvarintStr(k)
		}
		w.buf2.putUvarint64(e.offset)
	}

	w.buf1.reset()
	w.buf1.putBE32int(w.buf2.len())
	w.buf2.putHash(w.crc32)

	return w.write(w.buf1.get(), w.buf2.get())
}

const indexTOCLen = 6*8 + 4

func (w *Writer) writeTOC() error {
	w.buf1.reset()

	w.buf1.putBE64(w.toc.symbols)
	w.buf1.putBE64(w.toc.series)
	w.buf1.putBE64(w.toc.labelIndices)
	w.buf1.putBE64(w.toc.labelIndicesTable)
	w.buf1.putBE64(w.toc.postings)
	w.buf1.putBE64(w.toc.postingsTable)

	w.buf1.putHash(w.crc32)

	return w.write(w.buf1.get())
}

func (w *Writer) WritePostings(name, value string, it Postings) error {
	if err := w.ensureStage(idxStagePostings); err != nil {
		return errors.Wrap(err, "ensure stage")
	}

	// Align beginning to 4 bytes for more efficient postings list scans.
	if err := w.addPadding(4); err != nil {
		return err
	}

	w.postings = append(w.postings, hashEntry{
		keys:   []string{name, value},
		offset: w.pos,
	})

	// Order of the references in the postings list does not imply order
	// of the series references within the persisted block they are mapped to.
	// We have to sort the new references again.
	refs := w.uint32s[:0]

	for it.Next() {
		offset, ok := w.seriesOffsets[it.At()]
		if !ok {
			return errors.Errorf("%p series for reference %d not found", w, it.At())
		}
		if offset > (1<<32)-1 {
			return errors.Errorf("series offset %d exceeds 4 bytes", offset)
		}
		refs = append(refs, uint32(offset))
	}
	if err := it.Err(); err != nil {
		return err
	}
	sort.Sort(uint32slice(refs))

	w.buf2.reset()
	w.buf2.putBE32int(len(refs))

	for _, r := range refs {
		w.buf2.putBE32(r)
	}
	w.uint32s = refs

	w.buf1.reset()
	w.buf1.putBE32int(w.buf2.len())

	w.buf2.putHash(w.crc32)

	err := w.write(w.buf1.get(), w.buf2.get())
	return errors.Wrap(err, "write postings")
}

type uint32slice []uint32

func (s uint32slice) Len() int           { return len(s) }
func (s uint32slice) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s uint32slice) Less(i, j int) bool { return s[i] < s[j] }

type hashEntry struct {
	keys   []string
	offset uint64
}

func (w *Writer) Close() error {
	if err := w.ensureStage(idxStageDone); err != nil {
		return err
	}
	if err := w.fbuf.Flush(); err != nil {
		return err
	}
	if err := fileutil.Fsync(w.f); err != nil {
		return err
	}
	return w.f.Close()
}

// StringTuples provides access to a sorted list of string tuples.
type StringTuples interface {
	// Total number of tuples in the list.
	Len() int
	// At returns the tuple at position i.
	At(i int) ([]string, error)
}

type Reader struct {
	// The underlying byte slice holding the encoded series data.
	b   ByteSlice
	toc indexTOC

	// Close that releases the underlying resources of the byte slice.
	c io.Closer

	// Cached hashmaps of section offsets.
	labels   map[string]uint64
	postings map[string]map[string]uint64
	// Cache of read symbols. Strings that are returned when reading from the
	// block are always backed by true strings held in here rather than
	// strings that are backed by byte slices from the mmap'd index file. This
	// prevents memory faults when applications work with read symbols after
	// the block has been unmapped. The older format has sparse indexes so a map
	// must be used, but the new format is not so we can use a slice.
	symbols     map[uint32]string
	symbolSlice []string

	dec *Decoder

	crc32 hash.Hash32

	version int
}

var (
	errInvalidSize     = fmt.Errorf("invalid size")
	errInvalidFlag     = fmt.Errorf("invalid flag")
	errInvalidChecksum = fmt.Errorf("invalid checksum")
)

// ByteSlice abstracts a byte slice.
type ByteSlice interface {
	Len() int
	Range(start, end int) []byte
}

type realByteSlice []byte

func (b realByteSlice) Len() int {
	return len(b)
}

func (b realByteSlice) Range(start, end int) []byte {
	return b[start:end]
}

func (b realByteSlice) Sub(start, end int) ByteSlice {
	return b[start:end]
}

// NewReader returns a new IndexReader on the given byte slice. It automatically
// handles different format versions.
func NewReader(b ByteSlice) (*Reader, error) {
	return newReader(b, nil)
}

// NewFileReader returns a new index reader against the given index file.
func NewFileReader(path string) (*Reader, error) {
	f, err := fileutil.OpenMmapFile(path)
	if err != nil {
		return nil, err
	}
	return newReader(realByteSlice(f.Bytes()), f)
}

func newReader(b ByteSlice, c io.Closer) (*Reader, error) {
	r := &Reader{
		b:        b,
		c:        c,
		symbols:  map[uint32]string{},
		labels:   map[string]uint64{},
		postings: map[string]map[string]uint64{},
		crc32:    newCRC32(),
	}

	// Verify header.
	if b.Len() < 5 {
		return nil, errors.Wrap(errInvalidSize, "index header")
	}
	if m := binary.BigEndian.Uint32(r.b.Range(0, 4)); m != MagicIndex {
		return nil, errors.Errorf("invalid magic number %x", m)
	}
	r.version = int(r.b.Range(4, 5)[0])

	if r.version != 1 && r.version != 2 {
		return nil, errors.Errorf("unknown index file version %d", r.version)
	}

	if err := r.readTOC(); err != nil {
		return nil, errors.Wrap(err, "read TOC")
	}
	if err := r.readSymbols(int(r.toc.symbols)); err != nil {
		return nil, errors.Wrap(err, "read symbols")
	}
	var err error

	// Use the strings already allocated by symbols, rather than
	// re-allocating them again below.
	symbols := make(map[string]string, len(r.symbols)+len(r.symbolSlice))
	for _, s := range r.symbols {
		symbols[s] = s
	}
	for _, s := range r.symbolSlice {
		symbols[s] = s
	}

	err = r.readOffsetTable(r.toc.labelIndicesTable, func(key []string, off uint64) error {
		if len(key) != 1 {
			return errors.Errorf("unexpected key length %d", len(key))
		}
		r.labels[symbols[key[0]]] = off
		return nil
	})
	if err != nil {
		return nil, errors.Wrap(err, "read label index table")
	}
	r.postings[""] = map[string]uint64{}
	err = r.readOffsetTable(r.toc.postingsTable, func(key []string, off uint64) error {
		if len(key) != 2 {
			return errors.Errorf("unexpected key length %d", len(key))
		}
		if _, ok := r.postings[key[0]]; !ok {
			r.postings[symbols[key[0]]] = map[string]uint64{}
		}
		r.postings[key[0]][symbols[key[1]]] = off
		return nil
	})
	if err != nil {
		return nil, errors.Wrap(err, "read postings table")
	}

	r.dec = &Decoder{lookupSymbol: r.lookupSymbol}

	return r, nil
}

// Version returns the file format version of the underlying index.
func (r *Reader) Version() int {
	return r.version
}

// Range marks a byte range.
type Range struct {
	Start, End int64
}

// PostingsRanges returns a new map of byte range in the underlying index file
// for all postings lists.
func (r *Reader) PostingsRanges() (map[labels.Label]Range, error) {
	m := map[labels.Label]Range{}

	for k, e := range r.postings {
		for v, start := range e {
			d := r.decbufAt(int(start))
			if d.err() != nil {
				return nil, d.err()
			}
			m[labels.Label{Name: k, Value: v}] = Range{
				Start: int64(start) + 4,
				End:   int64(start) + 4 + int64(d.len()),
			}
		}
	}
	return m, nil
}

func (r *Reader) readTOC() error {
	if r.b.Len() < indexTOCLen {
		return errInvalidSize
	}
	b := r.b.Range(r.b.Len()-indexTOCLen, r.b.Len())

	expCRC := binary.BigEndian.Uint32(b[len(b)-4:])
	d := decbuf{b: b[:len(b)-4]}

	if d.crc32() != expCRC {
		return errors.Wrap(errInvalidChecksum, "read TOC")
	}

	r.toc.symbols = d.be64()
	r.toc.series = d.be64()
	r.toc.labelIndices = d.be64()
	r.toc.labelIndicesTable = d.be64()
	r.toc.postings = d.be64()
	r.toc.postingsTable = d.be64()

	return d.err()
}

// decbufAt returns a new decoding buffer. It expects the first 4 bytes
// after offset to hold the big endian encoded content length, followed by the contents and the expected
// checksum.
func (r *Reader) decbufAt(off int) decbuf {
	if r.b.Len() < off+4 {
		return decbuf{e: errInvalidSize}
	}
	b := r.b.Range(off, off+4)
	l := int(binary.BigEndian.Uint32(b))

	if r.b.Len() < off+4+l+4 {
		return decbuf{e: errInvalidSize}
	}

	// Load bytes holding the contents plus a CRC32 checksum.
	b = r.b.Range(off+4, off+4+l+4)
	dec := decbuf{b: b[:len(b)-4]}

	if exp := binary.BigEndian.Uint32(b[len(b)-4:]); dec.crc32() != exp {
		return decbuf{e: errInvalidChecksum}
	}
	return dec
}

// decbufUvarintAt returns a new decoding buffer. It expects the first bytes
// after offset to hold the uvarint-encoded buffers length, followed by the contents and the expected
// checksum.
func (r *Reader) decbufUvarintAt(off int) decbuf {
	// We never have to access this method at the far end of the byte slice. Thus just checking
	// against the MaxVarintLen32 is sufficient.
	if r.b.Len() < off+binary.MaxVarintLen32 {
		return decbuf{e: errInvalidSize}
	}
	b := r.b.Range(off, off+binary.MaxVarintLen32)

	l, n := binary.Uvarint(b)
	if n <= 0 || n > binary.MaxVarintLen32 {
		return decbuf{e: errors.Errorf("invalid uvarint %d", n)}
	}

	if r.b.Len() < off+n+int(l)+4 {
		return decbuf{e: errInvalidSize}
	}

	// Load bytes holding the contents plus a CRC32 checksum.
	b = r.b.Range(off+n, off+n+int(l)+4)
	dec := decbuf{b: b[:len(b)-4]}

	if dec.crc32() != binary.BigEndian.Uint32(b[len(b)-4:]) {
		return decbuf{e: errInvalidChecksum}
	}
	return dec
}

// readSymbols reads the symbol table fully into memory and allocates proper strings for them.
// Strings backed by the mmap'd memory would cause memory faults if applications keep using them
// after the reader is closed.
func (r *Reader) readSymbols(off int) error {
	if off == 0 {
		return nil
	}
	d := r.decbufAt(off)

	var (
		origLen = d.len()
		cnt     = d.be32int()
		basePos = uint32(off) + 4
		nextPos = basePos + uint32(origLen-d.len())
	)
	if r.version == 2 {
		r.symbolSlice = make([]string, 0, cnt)
	}

	for d.err() == nil && d.len() > 0 && cnt > 0 {
		s := d.uvarintStr()

		if r.version == 2 {
			r.symbolSlice = append(r.symbolSlice, s)
		} else {
			r.symbols[nextPos] = s
			nextPos = basePos + uint32(origLen-d.len())
		}
		cnt--
	}
	return errors.Wrap(d.err(), "read symbols")
}

// readOffsetTable reads an offset table at the given position calls f for each
// found entry.f
// If f returns an error it stops decoding and returns the received error,
func (r *Reader) readOffsetTable(off uint64, f func([]string, uint64) error) error {
	d := r.decbufAt(int(off))
	cnt := d.be32()

	for d.err() == nil && d.len() > 0 && cnt > 0 {
		keyCount := d.uvarint()
		keys := make([]string, 0, keyCount)

		for i := 0; i < keyCount; i++ {
			keys = append(keys, d.uvarintStr())
		}
		o := d.uvarint64()
		if d.err() != nil {
			break
		}
		if err := f(keys, o); err != nil {
			return err
		}
		cnt--
	}
	return d.err()
}

// Close the reader and its underlying resources.
func (r *Reader) Close() error {
	return r.c.Close()
}

func (r *Reader) lookupSymbol(o uint32) (string, error) {
	if int(o) < len(r.symbolSlice) {
		return r.symbolSlice[o], nil
	}
	s, ok := r.symbols[o]
	if !ok {
		return "", errors.Errorf("unknown symbol offset %d", o)
	}
	return s, nil
}

// Symbols returns a set of symbols that exist within the index.
func (r *Reader) Symbols() (map[string]struct{}, error) {
	res := make(map[string]struct{}, len(r.symbols))

	for _, s := range r.symbols {
		res[s] = struct{}{}
	}
	for _, s := range r.symbolSlice {
		res[s] = struct{}{}
	}
	return res, nil
}

// SymbolTableSize returns the symbol table that is used to resolve symbol references.
func (r *Reader) SymbolTableSize() uint64 {
	var size int
	for _, s := range r.symbols {
		size += len(s) + 8
	}
	for _, s := range r.symbolSlice {
		size += len(s) + 8
	}
	return uint64(size)
}

// LabelValues returns value tuples that exist for the given label name tuples.
func (r *Reader) LabelValues(names ...string) (StringTuples, error) {

	key := strings.Join(names, labelNameSeperator)
	off, ok := r.labels[key]
	if !ok {
		// XXX(fabxc): hot fix. Should return a partial data error and handle cases
		// where the entire block has no data gracefully.
		return emptyStringTuples{}, nil
		//return nil, fmt.Errorf("label index doesn't exist")
	}

	d := r.decbufAt(int(off))

	nc := d.be32int()
	d.be32() // consume unused value entry count.

	if d.err() != nil {
		return nil, errors.Wrap(d.err(), "read label value index")
	}
	st := &serializedStringTuples{
		idsCount: nc,
		idsBytes: d.get(),
		lookup:   r.lookupSymbol,
	}
	return st, nil
}

type emptyStringTuples struct{}

func (emptyStringTuples) At(i int) ([]string, error) { return nil, nil }
func (emptyStringTuples) Len() int                   { return 0 }

// LabelIndices returns a slice of label names for which labels or label tuples value indices exist.
// NOTE: This is deprecated. Use `LabelNames()` instead.
func (r *Reader) LabelIndices() ([][]string, error) {
	res := [][]string{}
	for s := range r.labels {
		res = append(res, strings.Split(s, labelNameSeperator))
	}
	return res, nil
}

// Series reads the series with the given ID and writes its labels and chunks into lbls and chks.
func (r *Reader) Series(id uint64, lbls *labels.Labels, chks *[]chunks.Meta) error {
	offset := id
	// In version 2 series IDs are no longer exact references but series are 16-byte padded
	// and the ID is the multiple of 16 of the actual position.
	if r.version == 2 {
		offset = id * 16
	}
	d := r.decbufUvarintAt(int(offset))
	if d.err() != nil {
		return d.err()
	}
	return errors.Wrap(r.dec.Series(d.get(), lbls, chks), "read series")
}

// Postings returns a postings list for the given label pair.
func (r *Reader) Postings(name, value string) (Postings, error) {
	e, ok := r.postings[name]
	if !ok {
		return EmptyPostings(), nil
	}
	off, ok := e[value]
	if !ok {
		return EmptyPostings(), nil
	}
	d := r.decbufAt(int(off))
	if d.err() != nil {
		return nil, errors.Wrap(d.err(), "get postings entry")
	}
	_, p, err := r.dec.Postings(d.get())
	if err != nil {
		return nil, errors.Wrap(err, "decode postings")
	}
	return p, nil
}

// SortedPostings returns the given postings list reordered so that the backing series
// are sorted.
func (r *Reader) SortedPostings(p Postings) Postings {
	return p
}

// LabelNames returns all the unique label names present in the index.
func (r *Reader) LabelNames() ([]string, error) {
	labelNamesMap := make(map[string]struct{}, len(r.labels))
	for key := range r.labels {
		// 'key' contains the label names concatenated with the
		// delimiter 'labelNameSeperator'.
		names := strings.Split(key, labelNameSeperator)
		for _, name := range names {
			if name == allPostingsKey.Name {
				// This is not from any metric.
				// It is basically an empty label name.
				continue
			}
			labelNamesMap[name] = struct{}{}
		}
	}
	labelNames := make([]string, 0, len(labelNamesMap))
	for name := range labelNamesMap {
		labelNames = append(labelNames, name)
	}
	sort.Strings(labelNames)
	return labelNames, nil
}

type stringTuples struct {
	length  int      // tuple length
	entries []string // flattened tuple entries
}

func NewStringTuples(entries []string, length int) (*stringTuples, error) {
	if len(entries)%length != 0 {
		return nil, errors.Wrap(errInvalidSize, "string tuple list")
	}
	return &stringTuples{entries: entries, length: length}, nil
}

func (t *stringTuples) Len() int                   { return len(t.entries) / t.length }
func (t *stringTuples) At(i int) ([]string, error) { return t.entries[i : i+t.length], nil }

func (t *stringTuples) Swap(i, j int) {
	c := make([]string, t.length)
	copy(c, t.entries[i:i+t.length])

	for k := 0; k < t.length; k++ {
		t.entries[i+k] = t.entries[j+k]
		t.entries[j+k] = c[k]
	}
}

func (t *stringTuples) Less(i, j int) bool {
	for k := 0; k < t.length; k++ {
		d := strings.Compare(t.entries[i+k], t.entries[j+k])

		if d < 0 {
			return true
		}
		if d > 0 {
			return false
		}
	}
	return false
}

type serializedStringTuples struct {
	idsCount int
	idsBytes []byte // bytes containing the ids pointing to the string in the lookup table.
	lookup   func(uint32) (string, error)
}

func (t *serializedStringTuples) Len() int {
	return len(t.idsBytes) / (4 * t.idsCount)
}

func (t *serializedStringTuples) At(i int) ([]string, error) {
	if len(t.idsBytes) < (i+t.idsCount)*4 {
		return nil, errInvalidSize
	}
	res := make([]string, 0, t.idsCount)

	for k := 0; k < t.idsCount; k++ {
		offset := binary.BigEndian.Uint32(t.idsBytes[(i+k)*4:])

		s, err := t.lookup(offset)
		if err != nil {
			return nil, errors.Wrap(err, "symbol lookup")
		}
		res = append(res, s)
	}

	return res, nil
}

// Decoder provides decoding methods for the v1 and v2 index file format.
//
// It currently does not contain decoding methods for all entry types but can be extended
// by them if there's demand.
type Decoder struct {
	lookupSymbol func(uint32) (string, error)
}

// Postings returns a postings list for b and its number of elements.
func (dec *Decoder) Postings(b []byte) (int, Postings, error) {
	d := decbuf{b: b}
	n := d.be32int()
	l := d.get()
	return n, newBigEndianPostings(l), d.err()
}

// Series decodes a series entry from the given byte slice into lset and chks.
func (dec *Decoder) Series(b []byte, lbls *labels.Labels, chks *[]chunks.Meta) error {
	*lbls = (*lbls)[:0]
	*chks = (*chks)[:0]

	d := decbuf{b: b}

	k := d.uvarint()

	for i := 0; i < k; i++ {
		lno := uint32(d.uvarint())
		lvo := uint32(d.uvarint())

		if d.err() != nil {
			return errors.Wrap(d.err(), "read series label offsets")
		}

		ln, err := dec.lookupSymbol(lno)
		if err != nil {
			return errors.Wrap(err, "lookup label name")
		}
		lv, err := dec.lookupSymbol(lvo)
		if err != nil {
			return errors.Wrap(err, "lookup label value")
		}

		*lbls = append(*lbls, labels.Label{Name: ln, Value: lv})
	}

	// Read the chunks meta data.
	k = d.uvarint()

	if k == 0 {
		return nil
	}

	t0 := d.varint64()
	maxt := int64(d.uvarint64()) + t0
	ref0 := int64(d.uvarint64())

	*chks = append(*chks, chunks.Meta{
		Ref:     uint64(ref0),
		MinTime: t0,
		MaxTime: maxt,
	})
	t0 = maxt

	for i := 1; i < k; i++ {
		mint := int64(d.uvarint64()) + t0
		maxt := int64(d.uvarint64()) + mint

		ref0 += d.varint64()
		t0 = maxt

		if d.err() != nil {
			return errors.Wrapf(d.err(), "read meta for chunk %d", i)
		}

		*chks = append(*chks, chunks.Meta{
			Ref:     uint64(ref0),
			MinTime: mint,
			MaxTime: maxt,
		})
	}
	return d.err()
}
