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
	"math"
	"reflect"
	"sort"

	index "github.com/blevesearch/bleve_index_api"
	segment "github.com/blevesearch/scorch_segment_api/v2"
	"github.com/golang/snappy"
)

var reflectStaticSizedocValueReader int

func init() {
	var dvi docValueReader
	reflectStaticSizedocValueReader = int(reflect.TypeOf(dvi).Size())
}

type docNumTermsVisitor func(docNum uint64, terms []byte) error

type docVisitState struct {
	dvrs    map[uint16]*docValueReader
	segment *SegmentBase

	bytesRead uint64
}

// Implements the segment.DiskStatsReporter interface
// The purpose of this implementation is to get
// the bytes read from the disk (pertaining to the
// docvalues) while querying.
// the loadDvChunk retrieves the next chunk of docvalues
// and the bytes retrieved off the disk pertaining to that
// is accounted as well.
func (d *docVisitState) incrementBytesRead(val uint64) {
	d.bytesRead += val
}

func (d *docVisitState) BytesRead() uint64 {
	return d.bytesRead
}

func (d *docVisitState) BytesWritten() uint64 {
	return 0
}

func (d *docVisitState) ResetBytesRead(val uint64) {
	d.bytesRead = val
}

type docValueReader struct {
	field          string
	curChunkNum    uint64
	chunkOffsets   []uint64
	dvDataLoc      uint64
	curChunkHeader []MetaData
	curChunkData   []byte // compressed data cache
	uncompressed   []byte // temp buf for snappy decompression

	bytesRead uint64
}

func (di *docValueReader) size() int {
	return reflectStaticSizedocValueReader + SizeOfPtr +
		len(di.field) +
		len(di.chunkOffsets)*SizeOfUint64 +
		len(di.curChunkHeader)*reflectStaticSizeMetaData +
		len(di.curChunkData)
}

func (di *docValueReader) cloneInto(rv *docValueReader) *docValueReader {
	if rv == nil {
		rv = &docValueReader{}
	}

	rv.field = di.field
	rv.curChunkNum = math.MaxUint64
	rv.chunkOffsets = di.chunkOffsets // immutable, so it's sharable
	rv.dvDataLoc = di.dvDataLoc
	rv.curChunkHeader = rv.curChunkHeader[:0]
	rv.curChunkData = nil
	rv.uncompressed = rv.uncompressed[:0]

	return rv
}

func (di *docValueReader) curChunkNumber() uint64 {
	return di.curChunkNum
}

func (s *SegmentBase) loadFieldDocValueReader(field string,
	fieldDvLocStart, fieldDvLocEnd uint64) (*docValueReader, error) {
	// get the docValue offset for the given fields
	if fieldDvLocStart == fieldNotUninverted {
		// no docValues found, nothing to do
		return nil, nil
	}

	// read the number of chunks, and chunk offsets position
	var numChunks, chunkOffsetsPosition uint64

	if fieldDvLocEnd-fieldDvLocStart > 16 {
		numChunks = binary.BigEndian.Uint64(s.mem[fieldDvLocEnd-8 : fieldDvLocEnd])
		// read the length of chunk offsets
		chunkOffsetsLen := binary.BigEndian.Uint64(s.mem[fieldDvLocEnd-16 : fieldDvLocEnd-8])
		// acquire position of chunk offsets
		chunkOffsetsPosition = (fieldDvLocEnd - 16) - chunkOffsetsLen

		// 16 bytes since it corresponds to the length
		// of chunk offsets and the position of the offsets
		s.incrementBytesRead(16)
	} else {
		return nil, fmt.Errorf("loadFieldDocValueReader: fieldDvLoc too small: %d-%d", fieldDvLocEnd, fieldDvLocStart)
	}

	fdvIter := &docValueReader{
		curChunkNum:  math.MaxUint64,
		field:        field,
		chunkOffsets: make([]uint64, int(numChunks)),
	}

	// read the chunk offsets
	var offset uint64
	for i := 0; i < int(numChunks); i++ {
		loc, read := binary.Uvarint(s.mem[chunkOffsetsPosition+offset : chunkOffsetsPosition+offset+binary.MaxVarintLen64])
		if read <= 0 {
			return nil, fmt.Errorf("corrupted chunk offset during segment load")
		}
		fdvIter.chunkOffsets[i] = loc
		offset += uint64(read)
	}
	s.incrementBytesRead(offset)
	// set the data offset
	fdvIter.dvDataLoc = fieldDvLocStart

	return fdvIter, nil
}

func (d *docValueReader) getBytesRead() uint64 {
	return d.bytesRead
}

func (d *docValueReader) incrementBytesRead(val uint64) {
	d.bytesRead += val
}

func (di *docValueReader) loadDvChunk(chunkNumber uint64, s *SegmentBase) error {
	// advance to the chunk where the docValues
	// reside for the given docNum
	destChunkDataLoc, curChunkEnd := di.dvDataLoc, di.dvDataLoc
	start, end := readChunkBoundary(int(chunkNumber), di.chunkOffsets)
	if start >= end {
		di.curChunkHeader = di.curChunkHeader[:0]
		di.curChunkData = nil
		di.curChunkNum = chunkNumber
		di.uncompressed = di.uncompressed[:0]
		return nil
	}

	destChunkDataLoc += start
	curChunkEnd += end

	// read the number of docs reside in the chunk
	numDocs, read := binary.Uvarint(s.mem[destChunkDataLoc : destChunkDataLoc+binary.MaxVarintLen64])
	if read <= 0 {
		return fmt.Errorf("failed to read the chunk")
	}
	chunkMetaLoc := destChunkDataLoc + uint64(read)
	di.incrementBytesRead(uint64(read))
	offset := uint64(0)
	if cap(di.curChunkHeader) < int(numDocs) {
		di.curChunkHeader = make([]MetaData, int(numDocs))
	} else {
		di.curChunkHeader = di.curChunkHeader[:int(numDocs)]
	}
	for i := 0; i < int(numDocs); i++ {
		di.curChunkHeader[i].DocNum, read = binary.Uvarint(s.mem[chunkMetaLoc+offset : chunkMetaLoc+offset+binary.MaxVarintLen64])
		offset += uint64(read)
		di.curChunkHeader[i].DocDvOffset, read = binary.Uvarint(s.mem[chunkMetaLoc+offset : chunkMetaLoc+offset+binary.MaxVarintLen64])
		offset += uint64(read)
	}

	compressedDataLoc := chunkMetaLoc + offset
	dataLength := curChunkEnd - compressedDataLoc
	di.incrementBytesRead(uint64(dataLength + offset))
	di.curChunkData = s.mem[compressedDataLoc : compressedDataLoc+dataLength]
	di.curChunkNum = chunkNumber
	di.uncompressed = di.uncompressed[:0]
	return nil
}

func (di *docValueReader) iterateAllDocValues(s *SegmentBase, visitor docNumTermsVisitor) error {
	for i := 0; i < len(di.chunkOffsets); i++ {
		err := di.loadDvChunk(uint64(i), s)
		if err != nil {
			return err
		}
		if di.curChunkData == nil || len(di.curChunkHeader) == 0 {
			continue
		}

		// uncompress the already loaded data
		uncompressed, err := snappy.Decode(di.uncompressed[:cap(di.uncompressed)], di.curChunkData)
		if err != nil {
			return err
		}
		di.uncompressed = uncompressed

		start := uint64(0)
		for _, entry := range di.curChunkHeader {
			err = visitor(entry.DocNum, uncompressed[start:entry.DocDvOffset])
			if err != nil {
				return err
			}

			start = entry.DocDvOffset
		}
	}

	return nil
}

func (di *docValueReader) visitDocValues(docNum uint64,
	visitor index.DocValueVisitor) error {
	// binary search the term locations for the docNum
	start, end := di.getDocValueLocs(docNum)
	if start == math.MaxUint64 || end == math.MaxUint64 || start == end {
		return nil
	}

	var uncompressed []byte
	var err error
	// use the uncompressed copy if available
	if len(di.uncompressed) > 0 {
		uncompressed = di.uncompressed
	} else {
		// uncompress the already loaded data
		uncompressed, err = snappy.Decode(di.uncompressed[:cap(di.uncompressed)], di.curChunkData)
		if err != nil {
			return err
		}
		di.uncompressed = uncompressed
	}

	// pick the terms for the given docNum
	uncompressed = uncompressed[start:end]
	for {
		i := bytes.Index(uncompressed, termSeparatorSplitSlice)
		if i < 0 {
			break
		}

		visitor(di.field, uncompressed[0:i])
		uncompressed = uncompressed[i+1:]
	}

	return nil
}

func (di *docValueReader) getDocValueLocs(docNum uint64) (uint64, uint64) {
	i := sort.Search(len(di.curChunkHeader), func(i int) bool {
		return di.curChunkHeader[i].DocNum >= docNum
	})
	if i < len(di.curChunkHeader) && di.curChunkHeader[i].DocNum == docNum {
		return ReadDocValueBoundary(i, di.curChunkHeader)
	}
	return math.MaxUint64, math.MaxUint64
}

// VisitDocValues is an implementation of the
// DocValueVisitable interface
func (s *SegmentBase) VisitDocValues(localDocNum uint64, fields []string,
	visitor index.DocValueVisitor, dvsIn segment.DocVisitState) (
	segment.DocVisitState, error) {
	dvs, ok := dvsIn.(*docVisitState)
	if !ok || dvs == nil {
		dvs = &docVisitState{}
	} else {
		if dvs.segment != s {
			dvs.segment = s
			dvs.dvrs = nil
			dvs.bytesRead = 0
		}
	}

	var fieldIDPlus1 uint16
	if dvs.dvrs == nil {
		dvs.dvrs = make(map[uint16]*docValueReader, len(fields))
		for _, field := range fields {
			if fieldIDPlus1, ok = s.fieldsMap[field]; !ok {
				continue
			}
			fieldID := fieldIDPlus1 - 1
			if dvIter, exists := s.fieldDvReaders[fieldID]; exists &&
				dvIter != nil {
				dvs.dvrs[fieldID] = dvIter.cloneInto(dvs.dvrs[fieldID])
			}
		}
	}

	// find the chunkNumber where the docValues are stored
	// NOTE: doc values continue to use legacy chunk mode
	chunkFactor, err := getChunkSize(LegacyChunkMode, 0, 0)
	if err != nil {
		return nil, err
	}
	docInChunk := localDocNum / chunkFactor
	var dvr *docValueReader
	for _, field := range fields {
		if fieldIDPlus1, ok = s.fieldsMap[field]; !ok {
			continue
		}
		fieldID := fieldIDPlus1 - 1
		if dvr, ok = dvs.dvrs[fieldID]; ok && dvr != nil {
			// check if the chunk is already loaded
			if docInChunk != dvr.curChunkNumber() {
				err := dvr.loadDvChunk(docInChunk, s)
				if err != nil {
					return dvs, err
				}
				dvs.ResetBytesRead(dvr.getBytesRead())
			} else {
				dvs.ResetBytesRead(0)
			}

			_ = dvr.visitDocValues(localDocNum, visitor)
		}
	}
	return dvs, nil
}

// VisitableDocValueFields returns the list of fields with
// persisted doc value terms ready to be visitable using the
// VisitDocumentFieldTerms method.
func (s *SegmentBase) VisitableDocValueFields() ([]string, error) {
	return s.fieldDvNames, nil
}
