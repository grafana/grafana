//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package zap

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"sync"
	"sync/atomic"
	"unsafe"

	"github.com/RoaringBitmap/roaring/v2"
	mmap "github.com/blevesearch/mmap-go"
	segment "github.com/blevesearch/scorch_segment_api/v2"
	"github.com/blevesearch/vellum"
	"github.com/golang/snappy"
)

var reflectStaticSizeSegmentBase int

func init() {
	var sb SegmentBase
	reflectStaticSizeSegmentBase = int(unsafe.Sizeof(sb))
}

// Open returns a zap impl of a segment
func (*ZapPlugin) Open(path string) (segment.Segment, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	mm, err := mmap.Map(f, mmap.RDONLY, 0)
	if err != nil {
		// mmap failed, try to close the file
		_ = f.Close()
		return nil, err
	}

	rv := &Segment{
		SegmentBase: SegmentBase{
			mem:            mm[0 : len(mm)-FooterSize],
			fieldsMap:      make(map[string]uint16),
			fieldDvReaders: make(map[uint16]*docValueReader),
			fieldFSTs:      make(map[uint16]*vellum.FST),
		},
		f:    f,
		mm:   mm,
		path: path,
		refs: 1,
	}
	rv.SegmentBase.updateSize()

	err = rv.loadConfig()
	if err != nil {
		_ = rv.Close()
		return nil, err
	}

	err = rv.loadFields()
	if err != nil {
		_ = rv.Close()
		return nil, err
	}

	err = rv.loadDvReaders()
	if err != nil {
		_ = rv.Close()
		return nil, err
	}

	return rv, nil
}

// SegmentBase is a memory only, read-only implementation of the
// segment.Segment interface, using zap's data representation.
type SegmentBase struct {
	mem               []byte
	memCRC            uint32
	chunkMode         uint32
	fieldsMap         map[string]uint16 // fieldName -> fieldID+1
	fieldsInv         []string          // fieldID -> fieldName
	numDocs           uint64
	storedIndexOffset uint64
	fieldsIndexOffset uint64
	docValueOffset    uint64
	dictLocs          []uint64
	fieldDvReaders    map[uint16]*docValueReader // naive chunk cache per field
	fieldDvNames      []string                   // field names cached in fieldDvReaders
	size              uint64

	// atomic access to these variables
	bytesRead    uint64
	bytesWritten uint64

	m         sync.Mutex
	fieldFSTs map[uint16]*vellum.FST
}

func (sb *SegmentBase) Size() int {
	return int(sb.size)
}

func (sb *SegmentBase) updateSize() {
	sizeInBytes := reflectStaticSizeSegmentBase +
		cap(sb.mem)

	// fieldsMap
	for k := range sb.fieldsMap {
		sizeInBytes += (len(k) + SizeOfString) + SizeOfUint16
	}

	// fieldsInv, dictLocs
	for _, entry := range sb.fieldsInv {
		sizeInBytes += len(entry) + SizeOfString
	}
	sizeInBytes += len(sb.dictLocs) * SizeOfUint64

	// fieldDvReaders
	for _, v := range sb.fieldDvReaders {
		sizeInBytes += SizeOfUint16 + SizeOfPtr
		if v != nil {
			sizeInBytes += v.size()
		}
	}

	sb.size = uint64(sizeInBytes)
}

func (sb *SegmentBase) AddRef()             {}
func (sb *SegmentBase) DecRef() (err error) { return nil }
func (sb *SegmentBase) Close() (err error)  { return nil }

// Segment implements a persisted segment.Segment interface, by
// embedding an mmap()'ed SegmentBase.
type Segment struct {
	SegmentBase

	f       *os.File
	mm      mmap.MMap
	path    string
	version uint32
	crc     uint32

	m    sync.Mutex // Protects the fields that follow.
	refs int64
}

func (s *Segment) Size() int {
	// 8 /* size of file pointer */
	// 4 /* size of version -> uint32 */
	// 4 /* size of crc -> uint32 */
	sizeOfUints := 16

	sizeInBytes := (len(s.path) + SizeOfString) + sizeOfUints

	// mutex, refs -> int64
	sizeInBytes += 16

	// do not include the mmap'ed part
	return sizeInBytes + s.SegmentBase.Size() - cap(s.mem)
}

func (s *Segment) AddRef() {
	s.m.Lock()
	s.refs++
	s.m.Unlock()
}

func (s *Segment) DecRef() (err error) {
	s.m.Lock()
	s.refs--
	if s.refs == 0 {
		err = s.closeActual()
	}
	s.m.Unlock()
	return err
}

func (s *Segment) loadConfig() error {
	crcOffset := len(s.mm) - 4
	s.crc = binary.BigEndian.Uint32(s.mm[crcOffset : crcOffset+4])

	verOffset := crcOffset - 4
	s.version = binary.BigEndian.Uint32(s.mm[verOffset : verOffset+4])
	if s.version != Version {
		return fmt.Errorf("unsupported version %d != %d", s.version, Version)
	}

	chunkOffset := verOffset - 4
	s.chunkMode = binary.BigEndian.Uint32(s.mm[chunkOffset : chunkOffset+4])

	docValueOffset := chunkOffset - 8
	s.docValueOffset = binary.BigEndian.Uint64(s.mm[docValueOffset : docValueOffset+8])

	fieldsIndexOffset := docValueOffset - 8
	s.fieldsIndexOffset = binary.BigEndian.Uint64(s.mm[fieldsIndexOffset : fieldsIndexOffset+8])

	storedIndexOffset := fieldsIndexOffset - 8
	s.storedIndexOffset = binary.BigEndian.Uint64(s.mm[storedIndexOffset : storedIndexOffset+8])

	numDocsOffset := storedIndexOffset - 8
	s.numDocs = binary.BigEndian.Uint64(s.mm[numDocsOffset : numDocsOffset+8])

	// 8*4 + 4*3 = 44 bytes being accounted from all the offsets
	// above being read from the file
	s.incrementBytesRead(44)
	return nil
}

// Implements the segment.DiskStatsReporter interface
// Only the persistedSegment type implments the
// interface, as the intention is to retrieve the bytes
// read from the on-disk segment as part of the current
// query.
func (s *Segment) ResetBytesRead(val uint64) {
	atomic.StoreUint64(&s.SegmentBase.bytesRead, val)
}

func (s *Segment) BytesRead() uint64 {
	return atomic.LoadUint64(&s.bytesRead)
}

func (s *Segment) BytesWritten() uint64 {
	return 0
}

func (s *Segment) incrementBytesRead(val uint64) {
	atomic.AddUint64(&s.bytesRead, val)
}

func (s *SegmentBase) BytesWritten() uint64 {
	return atomic.LoadUint64(&s.bytesWritten)
}

func (s *SegmentBase) setBytesWritten(val uint64) {
	atomic.AddUint64(&s.bytesWritten, val)
}

func (s *SegmentBase) BytesRead() uint64 {
	return 0
}

func (s *SegmentBase) ResetBytesRead(val uint64) {}

func (s *SegmentBase) incrementBytesRead(val uint64) {
	atomic.AddUint64(&s.bytesRead, val)
}

func (s *SegmentBase) loadFields() error {
	// NOTE for now we assume the fields index immediately precedes
	// the footer, and if this changes, need to adjust accordingly (or
	// store explicit length), where s.mem was sliced from s.mm in Open().
	fieldsIndexEnd := uint64(len(s.mem))

	// iterate through fields index
	var fieldID uint64
	for s.fieldsIndexOffset+(8*fieldID) < fieldsIndexEnd {
		addr := binary.BigEndian.Uint64(s.mem[s.fieldsIndexOffset+(8*fieldID) : s.fieldsIndexOffset+(8*fieldID)+8])

		// accounting the address of the dictLoc being read from file
		s.incrementBytesRead(8)

		dictLoc, read := binary.Uvarint(s.mem[addr:fieldsIndexEnd])
		n := uint64(read)
		s.dictLocs = append(s.dictLocs, dictLoc)

		var nameLen uint64
		nameLen, read = binary.Uvarint(s.mem[addr+n : fieldsIndexEnd])
		n += uint64(read)

		name := string(s.mem[addr+n : addr+n+nameLen])

		s.incrementBytesRead(n + nameLen)
		s.fieldsInv = append(s.fieldsInv, name)
		s.fieldsMap[name] = uint16(fieldID + 1)

		fieldID++
	}
	return nil
}

// Dictionary returns the term dictionary for the specified field
func (s *SegmentBase) Dictionary(field string) (segment.TermDictionary, error) {
	dict, err := s.dictionary(field)
	if err == nil && dict == nil {
		return emptyDictionary, nil
	}
	return dict, err
}

func (sb *SegmentBase) dictionary(field string) (rv *Dictionary, err error) {
	fieldIDPlus1 := sb.fieldsMap[field]
	if fieldIDPlus1 > 0 {
		rv = &Dictionary{
			sb:      sb,
			field:   field,
			fieldID: fieldIDPlus1 - 1,
		}

		dictStart := sb.dictLocs[rv.fieldID]
		if dictStart > 0 {
			var ok bool
			sb.m.Lock()
			if rv.fst, ok = sb.fieldFSTs[rv.fieldID]; !ok {
				// read the length of the vellum data
				vellumLen, read := binary.Uvarint(sb.mem[dictStart : dictStart+binary.MaxVarintLen64])
				if vellumLen == 0 {
					sb.m.Unlock()
					return nil, fmt.Errorf("empty dictionary for field: %v", field)
				}
				fstBytes := sb.mem[dictStart+uint64(read) : dictStart+uint64(read)+vellumLen]
				rv.incrementBytesRead(uint64(read) + vellumLen)
				rv.fst, err = vellum.Load(fstBytes)
				if err != nil {
					sb.m.Unlock()
					return nil, fmt.Errorf("dictionary field %s vellum err: %v", field, err)
				}

				sb.fieldFSTs[rv.fieldID] = rv.fst
			}

			sb.m.Unlock()
			rv.fstReader, err = rv.fst.Reader()
			if err != nil {
				return nil, fmt.Errorf("dictionary field %s vellum reader err: %v", field, err)
			}
		}
	}

	return rv, nil
}

// visitDocumentCtx holds data structures that are reusable across
// multiple VisitDocument() calls to avoid memory allocations
type visitDocumentCtx struct {
	buf      []byte
	reader   bytes.Reader
	arrayPos []uint64
}

var visitDocumentCtxPool = sync.Pool{
	New: func() interface{} {
		reuse := &visitDocumentCtx{}
		return reuse
	},
}

// VisitStoredFields invokes the StoredFieldValueVisitor for each stored field
// for the specified doc number
func (s *SegmentBase) VisitStoredFields(num uint64, visitor segment.StoredFieldValueVisitor) error {
	vdc := visitDocumentCtxPool.Get().(*visitDocumentCtx)
	defer visitDocumentCtxPool.Put(vdc)
	return s.visitStoredFields(vdc, num, visitor)
}

func (s *SegmentBase) visitStoredFields(vdc *visitDocumentCtx, num uint64,
	visitor segment.StoredFieldValueVisitor) error {
	// first make sure this is a valid number in this segment
	if num < s.numDocs {
		meta, compressed := s.getDocStoredMetaAndCompressed(num)

		vdc.reader.Reset(meta)

		// handle _id field special case
		idFieldValLen, err := binary.ReadUvarint(&vdc.reader)
		if err != nil {
			return err
		}
		idFieldVal := compressed[:idFieldValLen]

		keepGoing := visitor("_id", byte('t'), idFieldVal, nil)
		if !keepGoing {
			visitDocumentCtxPool.Put(vdc)
			return nil
		}

		// handle non-"_id" fields
		compressed = compressed[idFieldValLen:]

		uncompressed, err := snappy.Decode(vdc.buf[:cap(vdc.buf)], compressed)
		if err != nil {
			return err
		}

		for keepGoing {
			field, err := binary.ReadUvarint(&vdc.reader)
			if err == io.EOF {
				break
			}
			if err != nil {
				return err
			}
			typ, err := binary.ReadUvarint(&vdc.reader)
			if err != nil {
				return err
			}
			offset, err := binary.ReadUvarint(&vdc.reader)
			if err != nil {
				return err
			}
			l, err := binary.ReadUvarint(&vdc.reader)
			if err != nil {
				return err
			}
			numap, err := binary.ReadUvarint(&vdc.reader)
			if err != nil {
				return err
			}
			var arrayPos []uint64
			if numap > 0 {
				if cap(vdc.arrayPos) < int(numap) {
					vdc.arrayPos = make([]uint64, numap)
				}
				arrayPos = vdc.arrayPos[:numap]
				for i := 0; i < int(numap); i++ {
					ap, err := binary.ReadUvarint(&vdc.reader)
					if err != nil {
						return err
					}
					arrayPos[i] = ap
				}
			}

			value := uncompressed[offset : offset+l]
			keepGoing = visitor(s.fieldsInv[field], byte(typ), value, arrayPos)
		}

		vdc.buf = uncompressed
	}
	return nil
}

// DocID returns the value of the _id field for the given docNum
func (s *SegmentBase) DocID(num uint64) ([]byte, error) {
	if num >= s.numDocs {
		return nil, nil
	}

	vdc := visitDocumentCtxPool.Get().(*visitDocumentCtx)

	meta, compressed := s.getDocStoredMetaAndCompressed(num)

	vdc.reader.Reset(meta)

	// handle _id field special case
	idFieldValLen, err := binary.ReadUvarint(&vdc.reader)
	if err != nil {
		return nil, err
	}
	idFieldVal := compressed[:idFieldValLen]

	visitDocumentCtxPool.Put(vdc)

	return idFieldVal, nil
}

// Count returns the number of documents in this segment.
func (s *SegmentBase) Count() uint64 {
	return s.numDocs
}

// DocNumbers returns a bitset corresponding to the doc numbers of all the
// provided _id strings
func (s *SegmentBase) DocNumbers(ids []string) (*roaring.Bitmap, error) {
	rv := roaring.New()

	if len(s.fieldsMap) > 0 {
		idDict, err := s.dictionary("_id")
		if err != nil {
			return nil, err
		}

		postingsList := emptyPostingsList

		sMax, err := idDict.fst.GetMaxKey()
		if err != nil {
			return nil, err
		}
		sMaxStr := string(sMax)
		filteredIds := make([]string, 0, len(ids))
		for _, id := range ids {
			if id <= sMaxStr {
				filteredIds = append(filteredIds, id)
			}
		}

		for _, id := range filteredIds {
			postingsList, err = idDict.postingsList([]byte(id), nil, postingsList)
			if err != nil {
				return nil, err
			}
			postingsList.OrInto(rv)
		}
	}

	return rv, nil
}

// Fields returns the field names used in this segment
func (s *SegmentBase) Fields() []string {
	return s.fieldsInv
}

// Path returns the path of this segment on disk
func (s *Segment) Path() string {
	return s.path
}

// Close releases all resources associated with this segment
func (s *Segment) Close() (err error) {
	return s.DecRef()
}

func (s *Segment) closeActual() (err error) {
	if s.mm != nil {
		err = s.mm.Unmap()
	}
	// try to close file even if unmap failed
	if s.f != nil {
		err2 := s.f.Close()
		if err == nil {
			// try to return first error
			err = err2
		}
	}
	return
}

// some helpers i started adding for the command-line utility

// Data returns the underlying mmaped data slice
func (s *Segment) Data() []byte {
	return s.mm
}

// CRC returns the CRC value stored in the file footer
func (s *Segment) CRC() uint32 {
	return s.crc
}

// Version returns the file version in the file footer
func (s *Segment) Version() uint32 {
	return s.version
}

// ChunkFactor returns the chunk factor in the file footer
func (s *Segment) ChunkMode() uint32 {
	return s.chunkMode
}

// FieldsIndexOffset returns the fields index offset in the file footer
func (s *Segment) FieldsIndexOffset() uint64 {
	return s.fieldsIndexOffset
}

// StoredIndexOffset returns the stored value index offset in the file footer
func (s *Segment) StoredIndexOffset() uint64 {
	return s.storedIndexOffset
}

// DocValueOffset returns the docValue offset in the file footer
func (s *Segment) DocValueOffset() uint64 {
	return s.docValueOffset
}

// NumDocs returns the number of documents in the file footer
func (s *Segment) NumDocs() uint64 {
	return s.numDocs
}

// DictAddr is a helper function to compute the file offset where the
// dictionary is stored for the specified field.
func (s *Segment) DictAddr(field string) (uint64, error) {
	fieldIDPlus1, ok := s.fieldsMap[field]
	if !ok {
		return 0, fmt.Errorf("no such field '%s'", field)
	}

	return s.dictLocs[fieldIDPlus1-1], nil
}

func (s *SegmentBase) loadDvReaders() error {
	if s.docValueOffset == fieldNotUninverted || s.numDocs == 0 {
		return nil
	}

	var read uint64
	for fieldID, field := range s.fieldsInv {
		var fieldLocStart, fieldLocEnd uint64
		var n int
		fieldLocStart, n = binary.Uvarint(s.mem[s.docValueOffset+read : s.docValueOffset+read+binary.MaxVarintLen64])
		if n <= 0 {
			return fmt.Errorf("loadDvReaders: failed to read the docvalue offset start for field %d", fieldID)
		}
		read += uint64(n)
		fieldLocEnd, n = binary.Uvarint(s.mem[s.docValueOffset+read : s.docValueOffset+read+binary.MaxVarintLen64])
		if n <= 0 {
			return fmt.Errorf("loadDvReaders: failed to read the docvalue offset end for field %d", fieldID)
		}
		read += uint64(n)

		s.incrementBytesRead(read)
		fieldDvReader, err := s.loadFieldDocValueReader(field, fieldLocStart, fieldLocEnd)
		if err != nil {
			return err
		}
		if fieldDvReader != nil {
			s.fieldDvReaders[uint16(fieldID)] = fieldDvReader
			s.fieldDvNames = append(s.fieldDvNames, field)
		}
	}

	return nil
}
