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
	index "github.com/blevesearch/bleve_index_api"
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
			fieldsMap:      make(map[string]uint16),
			fieldFSTs:      make(map[uint16]*vellum.FST),
			vecIndexCache:  newVectorIndexCache(),
			synIndexCache:  newSynonymIndexCache(),
			fieldDvReaders: make([]map[uint16]*docValueReader, len(segmentSections)),
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

	err = rv.loadFieldsNew()
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
	// atomic access to these variables, moved to top to correct alignment issues on ARM, 386 and 32-bit MIPS.
	bytesRead    uint64
	bytesWritten uint64

	mem                 []byte
	memCRC              uint32
	chunkMode           uint32
	fieldsMap           map[string]uint16   // fieldName -> fieldID+1
	fieldsInv           []string            // fieldID -> fieldName
	fieldsSectionsMap   []map[uint16]uint64 // fieldID -> section -> address
	numDocs             uint64
	storedIndexOffset   uint64
	fieldsIndexOffset   uint64
	sectionsIndexOffset uint64
	docValueOffset      uint64
	dictLocs            []uint64
	fieldDvReaders      []map[uint16]*docValueReader // naive chunk cache per field; section->field->reader
	fieldDvNames        []string                     // field names cached in fieldDvReaders
	size                uint64

	updatedFields map[string]*index.UpdateFieldInfo

	m         sync.Mutex
	fieldFSTs map[uint16]*vellum.FST

	// this cache comes into play when vectors are supported in builds.
	vecIndexCache *vectorIndexCache
	synIndexCache *synonymIndexCache
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
	for _, secDvReaders := range sb.fieldDvReaders {
		for _, v := range secDvReaders {
			sizeInBytes += SizeOfUint16 + SizeOfPtr
			if v != nil {
				sizeInBytes += v.size()
			}
		}
	}

	sb.size = uint64(sizeInBytes)
}

func (sb *SegmentBase) AddRef()             {}
func (sb *SegmentBase) DecRef() (err error) { return nil }
func (sb *SegmentBase) Close() (err error) {
	sb.vecIndexCache.Clear()
	sb.synIndexCache.Clear()
	return nil
}

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
	if Version < IndexSectionsVersion && s.version != Version {
		return fmt.Errorf("unsupported version %d != %d", s.version, Version)
	}

	chunkOffset := verOffset - 4
	s.chunkMode = binary.BigEndian.Uint32(s.mm[chunkOffset : chunkOffset+4])

	docValueOffset := chunkOffset - 8
	s.docValueOffset = binary.BigEndian.Uint64(s.mm[docValueOffset : docValueOffset+8])

	fieldsIndexOffset := docValueOffset - 8

	// determining the right footer size based on version, this becomes important
	// while loading the fields portion or the sections portion of the index file.
	var footerSize int
	if s.version >= IndexSectionsVersion {
		// for version 16 and above, parse the sectionsIndexOffset
		s.sectionsIndexOffset = binary.BigEndian.Uint64(s.mm[fieldsIndexOffset : fieldsIndexOffset+8])
		fieldsIndexOffset = fieldsIndexOffset - 8
		footerSize = FooterSize
	} else {
		footerSize = FooterSize - 8
	}

	s.fieldsIndexOffset = binary.BigEndian.Uint64(s.mm[fieldsIndexOffset : fieldsIndexOffset+8])

	storedIndexOffset := fieldsIndexOffset - 8
	s.storedIndexOffset = binary.BigEndian.Uint64(s.mm[storedIndexOffset : storedIndexOffset+8])

	numDocsOffset := storedIndexOffset - 8
	s.numDocs = binary.BigEndian.Uint64(s.mm[numDocsOffset : numDocsOffset+8])

	// 8*4 + 4*3 = 44 bytes being accounted from all the offsets
	// above being read from the file
	s.incrementBytesRead(uint64(footerSize))
	s.SegmentBase.mem = s.mm[:len(s.mm)-footerSize]
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

func (sb *SegmentBase) BytesWritten() uint64 {
	return atomic.LoadUint64(&sb.bytesWritten)
}

func (sb *SegmentBase) setBytesWritten(val uint64) {
	atomic.AddUint64(&sb.bytesWritten, val)
}

func (sb *SegmentBase) BytesRead() uint64 {
	return 0
}

func (sb *SegmentBase) ResetBytesRead(val uint64) {}

func (sb *SegmentBase) incrementBytesRead(val uint64) {
	atomic.AddUint64(&sb.bytesRead, val)
}

func (sb *SegmentBase) loadFields() error {
	// NOTE for now we assume the fields index immediately precedes
	// the footer, and if this changes, need to adjust accordingly (or
	// store explicit length), where s.mem was sliced from s.mm in Open().
	fieldsIndexEnd := uint64(len(sb.mem))

	// iterate through fields index
	var fieldID uint64
	for sb.fieldsIndexOffset+(8*fieldID) < fieldsIndexEnd {
		addr := binary.BigEndian.Uint64(sb.mem[sb.fieldsIndexOffset+(8*fieldID) : sb.fieldsIndexOffset+(8*fieldID)+8])

		// accounting the address of the dictLoc being read from file
		sb.incrementBytesRead(8)

		dictLoc, read := binary.Uvarint(sb.mem[addr:fieldsIndexEnd])
		n := uint64(read)
		sb.dictLocs = append(sb.dictLocs, dictLoc)

		var nameLen uint64
		nameLen, read = binary.Uvarint(sb.mem[addr+n : fieldsIndexEnd])
		n += uint64(read)

		name := string(sb.mem[addr+n : addr+n+nameLen])

		sb.incrementBytesRead(n + nameLen)
		sb.fieldsInv = append(sb.fieldsInv, name)
		sb.fieldsMap[name] = uint16(fieldID + 1)

		fieldID++
	}
	return nil
}

func (sb *SegmentBase) loadFieldsNew() error {
	pos := sb.sectionsIndexOffset

	if pos == 0 {
		// this is the case only for older file formats
		return sb.loadFields()
	}

	seek := pos + binary.MaxVarintLen64
	if seek > uint64(len(sb.mem)) {
		// handling a buffer overflow case.
		// a rare case where the backing buffer is not large enough to be read directly via
		// a pos+binary.MaxVarintLen64 seek. For eg, this can happen when there is only
		// one field to be indexed in the entire batch of data and while writing out
		// these fields metadata, you write 1 + 8 bytes whereas the MaxVarintLen64 = 10.
		seek = uint64(len(sb.mem))
	}

	// read the number of fields
	numFields, sz := binary.Uvarint(sb.mem[pos:seek])
	// here, the pos is incremented by the valid number bytes read from the buffer
	// so in the edge case pointed out above the numFields = 1, the sz = 1 as well.
	pos += uint64(sz)
	sb.incrementBytesRead(uint64(sz))

	// the following loop will be executed only once in the edge case pointed out above
	// since there is only field's offset store which occupies 8 bytes.
	// the pointer then seeks to a position preceding the sectionsIndexOffset, at
	// which point the responsibility of handling the out-of-bounds cases shifts to
	// the specific section's parsing logic.
	var fieldID uint64
	for fieldID < numFields {
		addr := binary.BigEndian.Uint64(sb.mem[pos : pos+8])
		sb.incrementBytesRead(8)

		fieldSectionMap := make(map[uint16]uint64)

		err := sb.loadFieldNew(uint16(fieldID), addr, fieldSectionMap)
		if err != nil {
			return err
		}

		sb.fieldsSectionsMap = append(sb.fieldsSectionsMap, fieldSectionMap)

		fieldID++
		pos += 8
	}

	return nil
}

func (sb *SegmentBase) loadFieldNew(fieldID uint16, pos uint64,
	fieldSectionMap map[uint16]uint64) error {
	if pos == 0 {
		// there is no indexing structure present for this field/section
		return nil
	}

	fieldStartPos := pos // to track the number of bytes read
	fieldNameLen, sz := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
	pos += uint64(sz)

	fieldName := string(sb.mem[pos : pos+fieldNameLen])
	pos += fieldNameLen

	sb.fieldsInv = append(sb.fieldsInv, fieldName)
	sb.fieldsMap[fieldName] = uint16(fieldID + 1)

	fieldNumSections, sz := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
	pos += uint64(sz)

	for sectionIdx := uint64(0); sectionIdx < fieldNumSections; sectionIdx++ {
		// read section id
		fieldSectionType := binary.BigEndian.Uint16(sb.mem[pos : pos+2])
		pos += 2
		fieldSectionAddr := binary.BigEndian.Uint64(sb.mem[pos : pos+8])
		pos += 8
		fieldSectionMap[fieldSectionType] = fieldSectionAddr
		if fieldSectionType == SectionInvertedTextIndex {
			// for the fields which don't have the inverted index, the offset is
			// 0 and during query time, because there is no valid dictionary we
			// will just have follow a no-op path.
			if fieldSectionAddr == 0 {
				sb.dictLocs = append(sb.dictLocs, 0)
				continue
			}

			read := 0
			// skip the doc values
			_, n := binary.Uvarint(sb.mem[fieldSectionAddr : fieldSectionAddr+binary.MaxVarintLen64])
			fieldSectionAddr += uint64(n)
			read += n
			_, n = binary.Uvarint(sb.mem[fieldSectionAddr : fieldSectionAddr+binary.MaxVarintLen64])
			fieldSectionAddr += uint64(n)
			read += n
			dictLoc, n := binary.Uvarint(sb.mem[fieldSectionAddr : fieldSectionAddr+binary.MaxVarintLen64])
			// account the bytes read while parsing the field's inverted index section
			sb.incrementBytesRead(uint64(read + n))
			sb.dictLocs = append(sb.dictLocs, dictLoc)
		}
	}

	// account the bytes read while parsing the sections field index.
	sb.incrementBytesRead((pos - uint64(fieldStartPos)) + fieldNameLen)
	return nil
}

// Dictionary returns the term dictionary for the specified field
func (sb *SegmentBase) Dictionary(field string) (segment.TermDictionary, error) {
	dict, err := sb.dictionary(field)
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

// Thesaurus returns the thesaurus with the specified name, or an empty thesaurus if not found.
func (sb *SegmentBase) Thesaurus(name string) (segment.Thesaurus, error) {
	thesaurus, err := sb.thesaurus(name)
	if err == nil && thesaurus == nil {
		return emptyThesaurus, nil
	}
	return thesaurus, err
}

func (sb *SegmentBase) thesaurus(name string) (rv *Thesaurus, err error) {
	fieldIDPlus1 := sb.fieldsMap[name]
	if fieldIDPlus1 == 0 {
		return nil, nil
	}
	pos := sb.fieldsSectionsMap[fieldIDPlus1-1][SectionSynonymIndex]
	if pos > 0 {
		rv = &Thesaurus{
			sb:      sb,
			name:    name,
			fieldID: fieldIDPlus1 - 1,
		}
		// skip the doc value offsets as doc values are not supported in thesaurus
		for i := 0; i < 2; i++ {
			_, n := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
			pos += uint64(n)
		}
		thesLoc, n := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
		pos += uint64(n)
		fst, synTermMap, err := sb.synIndexCache.loadOrCreate(rv.fieldID, sb.mem[thesLoc:])
		if err != nil {
			return nil, fmt.Errorf("thesaurus name %s err: %v", name, err)
		}
		rv.fst = fst
		rv.synIDTermMap = synTermMap
		rv.fstReader, err = rv.fst.Reader()
		if err != nil {
			return nil, fmt.Errorf("thesaurus name %s vellum reader err: %v", name, err)
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
func (sb *SegmentBase) VisitStoredFields(num uint64, visitor segment.StoredFieldValueVisitor) error {
	vdc := visitDocumentCtxPool.Get().(*visitDocumentCtx)
	defer visitDocumentCtxPool.Put(vdc)
	return sb.visitStoredFields(vdc, num, visitor)
}

func (sb *SegmentBase) visitStoredFields(vdc *visitDocumentCtx, num uint64,
	visitor segment.StoredFieldValueVisitor) error {
	// first make sure this is a valid number in this segment
	if num < sb.numDocs {
		meta, compressed := sb.getDocStoredMetaAndCompressed(num)

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
			keepGoing = visitor(sb.fieldsInv[field], byte(typ), value, arrayPos)
		}

		vdc.buf = uncompressed
	}
	return nil
}

// DocID returns the value of the _id field for the given docNum
func (sb *SegmentBase) DocID(num uint64) ([]byte, error) {
	if num >= sb.numDocs {
		return nil, nil
	}

	vdc := visitDocumentCtxPool.Get().(*visitDocumentCtx)

	meta, compressed := sb.getDocStoredMetaAndCompressed(num)

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
func (sb *SegmentBase) Count() uint64 {
	return sb.numDocs
}

// DocNumbers returns a bitset corresponding to the doc numbers of all the
// provided _id strings
func (sb *SegmentBase) DocNumbers(ids []string) (*roaring.Bitmap, error) {
	rv := roaring.New()

	if len(sb.fieldsMap) > 0 {
		idDict, err := sb.dictionary("_id")
		if err != nil {
			return nil, err
		}

		postingsList := emptyPostingsList

		sMax, err := idDict.fst.GetMaxKey()
		if err != nil {
			return nil, err
		}
		sMaxStr := string(sMax)
		for _, id := range ids {
			if id <= sMaxStr {
				postingsList, err = idDict.postingsList([]byte(id), nil, postingsList)
				if err != nil {
					return nil, err
				}
				postingsList.OrInto(rv)
			}
		}
	}

	return rv, nil
}

// Fields returns the field names used in this segment
func (sb *SegmentBase) Fields() []string {
	return sb.fieldsInv
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
	// clear contents from the vector and synonym index cache before un-mmapping
	s.vecIndexCache.Clear()
	s.synIndexCache.Clear()

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

// ThesaurusAddr is a helper function to compute the file offset where the
// thesaurus is stored with the specified name.
func (s *Segment) ThesaurusAddr(name string) (uint64, error) {
	fieldIDPlus1, ok := s.fieldsMap[name]
	if !ok {
		return 0, fmt.Errorf("no such thesaurus '%s'", name)
	}
	thesaurusStart := s.fieldsSectionsMap[fieldIDPlus1-1][SectionSynonymIndex]
	if thesaurusStart == 0 {
		return 0, fmt.Errorf("no such thesaurus '%s'", name)
	}
	for i := 0; i < 2; i++ {
		_, n := binary.Uvarint(s.mem[thesaurusStart : thesaurusStart+binary.MaxVarintLen64])
		thesaurusStart += uint64(n)
	}
	thesLoc, _ := binary.Uvarint(s.mem[thesaurusStart : thesaurusStart+binary.MaxVarintLen64])
	return thesLoc, nil
}

func (s *Segment) getSectionDvOffsets(fieldID int, secID uint16) (uint64, uint64, uint64, error) {
	// Version is gonna be 16
	var fieldLocStart uint64 = fieldNotUninverted
	fieldLocEnd := fieldLocStart
	sectionMap := s.fieldsSectionsMap[fieldID]
	fieldAddrStart := sectionMap[secID]
	n := 0

	if fieldAddrStart > 0 {
		// fixed encoding as of now, need to uvarint this
		var read uint64
		fieldLocStart, n = binary.Uvarint(s.mem[fieldAddrStart+read : fieldAddrStart+read+binary.MaxVarintLen64])
		if n <= 0 {
			return 0, 0, 0, fmt.Errorf("loadDvReaders: failed to read the docvalue offset start for field %d", fieldID)
		}
		read += uint64(n)

		fieldLocEnd, n = binary.Uvarint(s.mem[fieldAddrStart+read : fieldAddrStart+read+binary.MaxVarintLen64])
		if n <= 0 {
			return 0, 0, 0, fmt.Errorf("loadDvReaders: failed to read the docvalue offset end for field %d", fieldID)
		}
		read += uint64(n)

		s.incrementBytesRead(read)
	}

	return fieldLocStart, fieldLocEnd, 0, nil
}

func (s *Segment) loadDvReader(fieldID int, secID uint16) error {
	start, end, _, err := s.getSectionDvOffsets(fieldID, secID)
	if err != nil {
		return err
	}

	fieldDvReader, err := s.loadFieldDocValueReader(s.fieldsInv[fieldID], start, end)
	if err != nil {
		return err
	}

	if fieldDvReader != nil {
		if s.fieldDvReaders[secID] == nil {
			s.fieldDvReaders[secID] = make(map[uint16]*docValueReader)
		}
		// fix the structure of fieldDvReaders
		// currently it populates the inverted index doc values
		s.fieldDvReaders[secID][uint16(fieldID)] = fieldDvReader
		s.fieldDvNames = append(s.fieldDvNames, s.fieldsInv[fieldID])
	}
	return nil
}

func (s *Segment) loadDvReadersLegacy() error {
	// older file formats to parse the docValueIndex and if that says doc values
	// aren't there in this segment file, just return nil
	if s.docValueOffset == fieldNotUninverted {
		return nil
	}

	for fieldID := range s.fieldsInv {
		var read uint64
		start, n := binary.Uvarint(s.mem[s.docValueOffset+read : s.docValueOffset+read+binary.MaxVarintLen64])
		if n <= 0 {
			return fmt.Errorf("loadDvReaders: failed to read the docvalue offset start for field %d", fieldID)
		}
		read += uint64(n)
		end, n := binary.Uvarint(s.mem[s.docValueOffset+read : s.docValueOffset+read+binary.MaxVarintLen64])
		if n <= 0 {
			return fmt.Errorf("loadDvReaders: failed to read the docvalue offset end for field %d", fieldID)
		}
		read += uint64(n)
		s.incrementBytesRead(read)

		fieldDvReader, err := s.loadFieldDocValueReader(s.fieldsInv[fieldID], start, end)
		if err != nil {
			return err
		}

		if fieldDvReader != nil {
			// older file formats have docValues corresponding only to inverted index
			// ignore the rest.
			if s.fieldDvReaders[SectionInvertedTextIndex] == nil {
				s.fieldDvReaders[SectionInvertedTextIndex] = make(map[uint16]*docValueReader)
			}
			// fix the structure of fieldDvReaders
			// currently it populates the inverted index doc values
			s.fieldDvReaders[SectionInvertedTextIndex][uint16(fieldID)] = fieldDvReader
			s.fieldDvNames = append(s.fieldDvNames, s.fieldsInv[fieldID])
		}
	}

	return nil
}

// Segment is a file segment, and loading the dv readers from that segment
// must account for the version while loading since the formats are different
// in the older and the Version version.
func (s *Segment) loadDvReaders() error {
	if s.numDocs == 0 {
		return nil
	}

	if s.version < IndexSectionsVersion {
		return s.loadDvReadersLegacy()
	}

	// for every section of every field, load the doc values and register
	// the readers.
	for fieldID := range s.fieldsInv {
		for secID := range segmentSections {
			s.loadDvReader(fieldID, secID)
		}
	}

	return nil
}

// since segmentBase is an in-memory segment, it can be called only
// for v16 file formats as part of InitSegmentBase() while introducing
// a segment into the system.
func (sb *SegmentBase) loadDvReaders() error {

	// evaluate -> s.docValueOffset == fieldNotUninverted
	if sb.numDocs == 0 {
		return nil
	}

	for fieldID, sections := range sb.fieldsSectionsMap {
		for secID, secOffset := range sections {
			if secOffset > 0 {
				// fixed encoding as of now, need to uvarint this
				pos := secOffset
				var read uint64
				fieldLocStart, n := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
				if n <= 0 {
					return fmt.Errorf("loadDvReaders: failed to read the docvalue offset start for field %v", sb.fieldsInv[fieldID])
				}
				pos += uint64(n)
				read += uint64(n)
				fieldLocEnd, n := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
				if read <= 0 {
					return fmt.Errorf("loadDvReaders: failed to read the docvalue offset end for field %v", sb.fieldsInv[fieldID])
				}
				pos += uint64(n)
				read += uint64(n)

				sb.incrementBytesRead(read)

				fieldDvReader, err := sb.loadFieldDocValueReader(sb.fieldsInv[fieldID], fieldLocStart, fieldLocEnd)
				if err != nil {
					return err
				}
				if fieldDvReader != nil {
					if sb.fieldDvReaders[secID] == nil {
						sb.fieldDvReaders[secID] = make(map[uint16]*docValueReader)
					}
					sb.fieldDvReaders[secID][uint16(fieldID)] = fieldDvReader
					sb.fieldDvNames = append(sb.fieldDvNames, sb.fieldsInv[fieldID])
				}
			}
		}
	}

	return nil
}

// Getter method to retrieve updateFieldInfo within segment base
func (s *SegmentBase) GetUpdatedFields() map[string]*index.UpdateFieldInfo {
	return s.updatedFields
}

// Setter method to store updateFieldInfo within segment base
func (s *SegmentBase) SetUpdatedFields(updatedFields map[string]*index.UpdateFieldInfo) {
	s.updatedFields = updatedFields
}
