//  Copyright (c) 2020 Couchbase, Inc.
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

package ice

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"sort"

	"github.com/RoaringBitmap/roaring"
	"github.com/blevesearch/vellum"
	segment "github.com/blugelabs/bluge_segment_api"
)

const docDropped = math.MaxInt64 // sentinel docNum to represent a deleted doc

// TODO this should be going away soon
const _idFieldName = "_id"

type Merger struct {
	segments        []segment.Segment
	drops           []*roaring.Bitmap
	newDocNums      [][]uint64
	mergeBufferSize int
}

func (m *Merger) WriteTo(w io.Writer, closeCh chan struct{}) (n int64, err error) {
	var sz uint64

	bw := bufio.NewWriterSize(w, m.mergeBufferSize)

	m.newDocNums, sz, err = merge(m.segments, m.drops, bw, closeCh)
	if err != nil {
		return
	}

	n = int64(sz)
	err = bw.Flush()
	if err != nil {
		return n, err
	}

	return
}

func (m *Merger) DocumentNumbers() [][]uint64 {
	return m.newDocNums
}

func Merge(segments []segment.Segment, drops []*roaring.Bitmap, mergeBufferSize int) segment.Merger {
	return &Merger{
		segments:        segments,
		drops:           drops,
		mergeBufferSize: mergeBufferSize,
	}
}

func merge(segments []segment.Segment, drops []*roaring.Bitmap,
	w io.Writer, closeCh chan struct{}) (newDocNums [][]uint64, n uint64, err error) {
	segmentBases := make([]*Segment, len(segments))
	for segmenti, seg := range segments {
		switch segmentx := seg.(type) {
		case *Segment:
			segmentBases[segmenti] = segmentx
		default:
			panic(fmt.Sprintf("oops, unexpected segment type: %T", seg))
		}
	}
	return mergeSegmentBasesWriter(segmentBases, drops, w, defaultChunkMode, closeCh)
}

func mergeSegmentBasesWriter(segmentBases []*Segment, drops []*roaring.Bitmap, w io.Writer,
	chunkMode uint32, closeCh chan struct{}) (
	newDocNums [][]uint64, n uint64, err error) {
	// wrap it for counting (tracking offsets)
	cr := newCountHashWriter(w)

	var footer *footer
	newDocNums, footer, err =
		mergeToWriter(segmentBases, drops, chunkMode, cr, closeCh)
	if err != nil {
		return nil, 0, err
	}
	footer.crc = cr.Sum32()
	footer.chunkMode = chunkMode

	err = persistFooter(footer, cr)
	if err != nil {
		return nil, 0, err
	}

	return newDocNums, uint64(cr.Count()), nil
}

func mergeToWriter(segments []*Segment, drops []*roaring.Bitmap,
	chunkMode uint32, cr *countHashWriter, closeCh chan struct{}) (
	newDocNums [][]uint64, footerVal *footer,
	err error) {
	docValueOffset := uint64(fieldNotUninverted)

	fieldsSame, fieldsInv := mergeFields(segments)
	fieldsMap := mapFields(fieldsInv)

	numDocs := computeNewDocCount(segments, drops)

	if isClosed(closeCh) {
		return nil, nil, segment.ErrClosed
	}

	var storedIndexOffset uint64
	var fieldDocs, fieldFreqs map[uint16]uint64
	var dictLocs []uint64
	if numDocs > 0 {
		storedIndexOffset, newDocNums, err = mergeStoredAndRemap(segments, drops,
			fieldsMap, fieldsInv, fieldsSame, numDocs, cr, closeCh)
		if err != nil {
			return nil, nil, err
		}

		dictLocs, fieldDocs, fieldFreqs, docValueOffset, err = persistMergedRest(segments, drops,
			fieldsInv, fieldsMap,
			newDocNums, numDocs, chunkMode, cr, closeCh)
		if err != nil {
			return nil, nil, err
		}
	} else {
		dictLocs = make([]uint64, len(fieldsInv))
	}

	var fieldsIndexOffset uint64
	fieldsIndexOffset, err = persistFields(fieldsInv, fieldDocs, fieldFreqs, cr, dictLocs)
	if err != nil {
		return nil, nil, err
	}

	return newDocNums, &footer{
		numDocs:           numDocs,
		storedIndexOffset: storedIndexOffset,
		fieldsIndexOffset: fieldsIndexOffset,
		docValueOffset:    docValueOffset,
	}, nil
}

// mapFields takes the fieldsInv list and returns a map of fieldName
// to fieldID+1
func mapFields(fields []string) map[string]uint16 {
	rv := make(map[string]uint16, len(fields))
	for i, fieldName := range fields {
		rv[fieldName] = uint16(i) + 1
	}
	return rv
}

// computeNewDocCount determines how many documents will be in the newly
// merged segment when obsoleted docs are dropped
func computeNewDocCount(segments []*Segment, drops []*roaring.Bitmap) uint64 {
	var newDocCount uint64
	for segI, seg := range segments {
		newDocCount += seg.footer.numDocs
		if drops[segI] != nil {
			newDocCount -= drops[segI].GetCardinality()
		}
	}
	return newDocCount
}

func persistMergedRest(segments []*Segment, dropsIn []*roaring.Bitmap,
	fieldsInv []string, fieldsMap map[string]uint16,
	newDocNumsIn [][]uint64, newSegDocCount uint64, chunkMode uint32,
	w *countHashWriter, closeCh chan struct{}) (dictLocs []uint64, fieldDocs,
	fieldFreqs map[uint16]uint64, docValueOffset uint64, err error) {
	var bufMaxVarintLen64 = make([]byte, binary.MaxVarintLen64)

	dictLocs = make([]uint64, len(fieldsInv))
	fieldDvLocsStart := make([]uint64, len(fieldsInv))
	fieldDvLocsEnd := make([]uint64, len(fieldsInv))

	// these int coders are initialized with chunk size 1024
	// however this will be reset to the correct chunk size
	// while processing each individual field-term section
	tfEncoder := newChunkedIntCoder(uint64(legacyChunkMode), newSegDocCount-1)
	locEncoder := newChunkedIntCoder(uint64(legacyChunkMode), newSegDocCount-1)

	var vellumBuf bytes.Buffer
	newVellum, err := vellum.New(&vellumBuf, nil)
	if err != nil {
		return nil, nil, nil, 0, err
	}

	newRoaring := roaring.NewBitmap()

	fieldDocs = map[uint16]uint64{}
	fieldDocTracking := roaring.NewBitmap()
	fieldFreqs = map[uint16]uint64{}

	// for each field
	for fieldID, fieldName := range fieldsInv {
		err = persistMergedRestField(segments, dropsIn, fieldsMap, newDocNumsIn, newSegDocCount, chunkMode, w,
			closeCh, fieldName, newRoaring, fieldDocTracking, tfEncoder, locEncoder, newVellum, &vellumBuf,
			bufMaxVarintLen64, fieldFreqs, fieldID, dictLocs, fieldDvLocsStart, fieldDvLocsEnd)
		if err != nil {
			return nil, nil, nil, 0, err
		}

		// reset vellum buffer and vellum builder
		vellumBuf.Reset()
		err = newVellum.Reset(&vellumBuf)
		if err != nil {
			return nil, nil, nil, 0, err
		}

		fieldDocs[uint16(fieldID)] += fieldDocTracking.GetCardinality()
	}

	docValueOffset, err = writeDvLocs(w, bufMaxVarintLen64, fieldDvLocsStart, fieldDvLocsEnd)
	if err != nil {
		return nil, nil, nil, 0, err
	}

	return dictLocs, fieldDocs, fieldFreqs, docValueOffset, nil
}

func persistMergedRestField(segments []*Segment, dropsIn []*roaring.Bitmap, fieldsMap map[string]uint16,
	newDocNumsIn [][]uint64, newSegDocCount uint64, chunkMode uint32, w *countHashWriter, closeCh chan struct{},
	fieldName string, newRoaring, fieldDocTracking *roaring.Bitmap, tfEncoder, locEncoder *chunkedIntCoder,
	newVellum *vellum.Builder, vellumBuf *bytes.Buffer, bufMaxVarintLen64 []byte, fieldFreqs map[uint16]uint64,
	fieldID int, dictLocs, fieldDvLocsStart, fieldDvLocsEnd []uint64) error {
	var postings *PostingsList
	var postItr *PostingsIterator
	var bufLoc []uint64

	// collect FST iterators from all active segments for this field
	newDocNums, drops, dicts, itrs, segmentsInFocus, err :=
		setupActiveForField(segments, dropsIn, newDocNumsIn, closeCh, fieldName)
	if err != nil {
		return err
	}

	var prevTerm []byte

	newRoaring.Clear()
	fieldDocTracking.Clear()

	var lastDocNum uint64
	var lastFreq, lastNorm uint64

	enumerator, err := newEnumerator(itrs)

	for err == nil {
		term, itrI, postingsOffset := enumerator.Current()

		if !bytes.Equal(prevTerm, term) {
			// check for the closure in meantime
			if isClosed(closeCh) {
				return segment.ErrClosed
			}

			// if the term changed, write out the info collected for the previous term
			err = finishTerm(w, newRoaring, tfEncoder, locEncoder, newVellum, bufMaxVarintLen64, prevTerm, &lastDocNum,
				&lastFreq, &lastNorm)
			if err != nil {
				return err
			}
		}

		if !bytes.Equal(prevTerm, term) || prevTerm == nil {
			err = prepareNewTerm(newSegDocCount, chunkMode, tfEncoder, locEncoder, fieldFreqs, fieldID, enumerator,
				dicts, drops)
			if err != nil {
				return err
			}
		}

		postings, err = dicts[itrI].postingsListFromOffset(
			postingsOffset, drops[itrI], postings)
		if err != nil {
			return err
		}

		postItr, err = postings.iterator(true, true, true, postItr)
		if err != nil {
			return err
		}

		// can no longer optimize by copying, since chunk factor could have changed
		lastDocNum, lastFreq, lastNorm, bufLoc, err = mergeTermFreqNormLocs(
			fieldsMap, postItr, newDocNums[itrI], newRoaring,
			tfEncoder, locEncoder, bufLoc, fieldDocTracking)

		if err != nil {
			return err
		}

		prevTerm = prevTerm[:0] // copy to prevTerm in case Next() reuses term mem
		prevTerm = append(prevTerm, term...)

		err = enumerator.Next()
	}
	if err != vellum.ErrIteratorDone {
		return err
	}

	err = finishTerm(w, newRoaring, tfEncoder, locEncoder, newVellum, bufMaxVarintLen64, prevTerm, &lastDocNum,
		&lastFreq, &lastNorm)
	if err != nil {
		return err
	}

	err = writeMergedDict(w, newVellum, vellumBuf, bufMaxVarintLen64, fieldID, dictLocs)
	if err != nil {
		return err
	}

	err = buildMergedDocVals(newSegDocCount, w, closeCh, fieldName, fieldID, fieldDvLocsStart, fieldDvLocsEnd,
		segmentsInFocus, newDocNums)
	if err != nil {
		return err
	}
	return nil
}

func writeMergedDict(w *countHashWriter, newVellum io.Closer, vellumBuf *bytes.Buffer,
	bufMaxVarintLen64 []byte, fieldID int, dictLocs []uint64) error {
	dictOffset := uint64(w.Count())

	err := newVellum.Close()
	if err != nil {
		return err
	}
	vellumData := vellumBuf.Bytes()

	// write out the length of the vellum data
	n := binary.PutUvarint(bufMaxVarintLen64, uint64(len(vellumData)))
	_, err = w.Write(bufMaxVarintLen64[:n])
	if err != nil {
		return err
	}

	// write this vellum to disk
	_, err = w.Write(vellumData)
	if err != nil {
		return err
	}

	dictLocs[fieldID] = dictOffset
	return nil
}

func buildMergedDocVals(newSegDocCount uint64, w *countHashWriter, closeCh chan struct{}, fieldName string, fieldID int,
	fieldDvLocsStart, fieldDvLocsEnd []uint64, segmentsInFocus []*Segment, newDocNums [][]uint64) error {
	// get the field doc value offset (start)
	fieldDvLocsStart[fieldID] = uint64(w.Count())

	// update the field doc values
	// NOTE: doc values continue to use legacy chunk mode
	chunkSize, err := getChunkSize(legacyChunkMode, 0, 0)
	if err != nil {
		return err
	}
	fdvEncoder := newChunkedContentCoder(chunkSize, newSegDocCount-1, w, true)

	fdvReadersAvailable := false
	var dvIterClone *docValueReader
	for segmentI, seg := range segmentsInFocus {
		segmentI := segmentI
		// check for the closure in meantime
		if isClosed(closeCh) {
			return segment.ErrClosed
		}

		fieldIDPlus1 := seg.fieldsMap[fieldName]
		if dvIter, exists := seg.fieldDvReaders[fieldIDPlus1-1]; exists &&
			dvIter != nil {
			fdvReadersAvailable = true
			dvIterClone = dvIter.cloneInto(dvIterClone)
			err = dvIterClone.iterateAllDocValues(seg, func(docNum uint64, terms []byte) error {
				if newDocNums[segmentI][docNum] == docDropped {
					return nil
				}
				err2 := fdvEncoder.Add(newDocNums[segmentI][docNum], terms)
				if err2 != nil {
					return err2
				}
				return nil
			})
			if err != nil {
				return err
			}
		}
	}

	if fdvReadersAvailable {
		err = fdvEncoder.Close()
		if err != nil {
			return err
		}

		// persist the doc value details for this field
		_, err = fdvEncoder.Write()
		if err != nil {
			return err
		}

		// get the field doc value offset (end)
		fieldDvLocsEnd[fieldID] = uint64(w.Count())
	} else {
		fieldDvLocsStart[fieldID] = fieldNotUninverted
		fieldDvLocsEnd[fieldID] = fieldNotUninverted
	}
	return nil
}

func prepareNewTerm(newSegDocCount uint64, chunkMode uint32, tfEncoder, locEncoder *chunkedIntCoder,
	fieldFreqs map[uint16]uint64, fieldID int, enumerator *enumerator, dicts []*Dictionary,
	drops []*roaring.Bitmap) error {
	var err error

	// compute cardinality of field-term in new seg
	var newCard uint64
	lowItrIdxs, lowItrVals := enumerator.GetLowIdxsAndValues()
	for i, idx := range lowItrIdxs {
		var pl *PostingsList
		pl, err = dicts[idx].postingsListFromOffset(lowItrVals[i], drops[idx], nil)
		if err != nil {
			return err
		}
		newCard += pl.Count()
		fieldFreqs[uint16(fieldID)] += newCard
	}
	// compute correct chunk size with this
	var chunkSize uint64
	chunkSize, err = getChunkSize(chunkMode, newCard, newSegDocCount)
	if err != nil {
		return err
	}
	// update encoders chunk
	tfEncoder.SetChunkSize(chunkSize, newSegDocCount-1)
	locEncoder.SetChunkSize(chunkSize, newSegDocCount-1)
	return nil
}

func finishTerm(w *countHashWriter, newRoaring *roaring.Bitmap, tfEncoder, locEncoder *chunkedIntCoder,
	newVellum *vellum.Builder, bufMaxVarintLen64, term []byte, lastDocNum, lastFreq, lastNorm *uint64) error {
	tfEncoder.Close()
	locEncoder.Close()

	// determines whether to use "1-hit" encoding optimization
	// when a term appears in only 1 doc, with no loc info,
	// has freq of 1, and the docNum fits into 31-bits
	use1HitEncoding := func(termCardinality uint64) (bool, uint64, uint64) {
		if termCardinality == uint64(1) && locEncoder.FinalSize() <= 0 {
			docNum := uint64(newRoaring.Minimum())
			if under32Bits(docNum) && docNum == *lastDocNum && *lastFreq == 1 {
				return true, docNum, *lastNorm
			}
		}
		return false, 0, 0
	}

	postingsOffset, err := writePostings(newRoaring,
		tfEncoder, locEncoder, use1HitEncoding, w, bufMaxVarintLen64)
	if err != nil {
		return err
	}

	if postingsOffset > 0 {
		err = newVellum.Insert(term, postingsOffset)
		if err != nil {
			return err
		}
	}

	newRoaring.Clear()

	tfEncoder.Reset()
	locEncoder.Reset()

	*lastDocNum = 0
	*lastFreq = 0
	*lastNorm = 0

	return nil
}

func writeDvLocs(w *countHashWriter, bufMaxVarintLen64 []byte, fieldDvLocsStart, fieldDvLocsEnd []uint64) (uint64, error) {
	fieldDvLocsOffset := uint64(w.Count())

	buf := bufMaxVarintLen64
	for i := 0; i < len(fieldDvLocsStart); i++ {
		n := binary.PutUvarint(buf, fieldDvLocsStart[i])
		_, err := w.Write(buf[:n])
		if err != nil {
			return 0, err
		}
		n = binary.PutUvarint(buf, fieldDvLocsEnd[i])
		_, err = w.Write(buf[:n])
		if err != nil {
			return 0, err
		}
	}
	return fieldDvLocsOffset, nil
}

func setupActiveForField(segments []*Segment, dropsIn []*roaring.Bitmap, newDocNumsIn [][]uint64, closeCh chan struct{},
	fieldName string) (newDocNums [][]uint64, drops []*roaring.Bitmap, dicts []*Dictionary, itrs []vellum.Iterator,
	segmentsInFocus []*Segment, err error) {
	for segmentI, seg := range segments {
		// check for the closure in meantime
		if isClosed(closeCh) {
			return nil, nil, nil, nil, nil, segment.ErrClosed
		}

		var dict *Dictionary
		dict, err = seg.dictionary(fieldName)
		if err != nil {
			return nil, nil, nil, nil, nil, err
		}
		if dict != nil && dict.fst != nil {
			var itr *vellum.FSTIterator
			itr, err = dict.fst.Iterator(nil, nil)
			if err != nil && err != vellum.ErrIteratorDone {
				return nil, nil, nil, nil, nil, err
			}
			if itr != nil {
				newDocNums = append(newDocNums, newDocNumsIn[segmentI])
				if dropsIn[segmentI] != nil && !dropsIn[segmentI].IsEmpty() {
					drops = append(drops, dropsIn[segmentI])
				} else {
					drops = append(drops, nil)
				}
				dicts = append(dicts, dict)
				itrs = append(itrs, itr)
				segmentsInFocus = append(segmentsInFocus, seg)
			}
		}
	}
	return newDocNums, drops, dicts, itrs, segmentsInFocus, nil
}

const numUintsLocation = 4

func mergeTermFreqNormLocs(fieldsMap map[string]uint16, postItr *PostingsIterator,
	newDocNums []uint64, newRoaring *roaring.Bitmap,
	tfEncoder, locEncoder *chunkedIntCoder, bufLoc []uint64, docTracking *roaring.Bitmap) (
	lastDocNum, lastFreq, lastNorm uint64, bufLocOut []uint64, err error) {
	next, err := postItr.Next()
	for next != nil && err == nil {
		hitNewDocNum := newDocNums[next.Number()]
		if hitNewDocNum == docDropped {
			return 0, 0, 0, nil, fmt.Errorf("see hit with dropped docNum")
		}

		newRoaring.Add(uint32(hitNewDocNum))
		docTracking.Add(uint32(hitNewDocNum))

		nextFreq := next.Frequency()
		nextNorm := uint64(math.Float32bits(float32(next.Norm())))

		locs := next.Locations()

		err = tfEncoder.Add(hitNewDocNum,
			encodeFreqHasLocs(uint64(nextFreq), len(locs) > 0), nextNorm)
		if err != nil {
			return 0, 0, 0, nil, err
		}

		if len(locs) > 0 {
			numBytesLocs := 0
			for _, loc := range locs {
				numBytesLocs += totalUvarintBytes(uint64(fieldsMap[loc.Field()]-1),
					uint64(loc.Pos()), uint64(loc.Start()), uint64(loc.End()))
			}

			err = locEncoder.Add(hitNewDocNum, uint64(numBytesLocs))
			if err != nil {
				return 0, 0, 0, nil, err
			}

			for _, loc := range locs {
				if cap(bufLoc) < numUintsLocation {
					bufLoc = make([]uint64, 0, numUintsLocation)
				}
				args := bufLoc[0:4]
				args[0] = uint64(fieldsMap[loc.Field()] - 1)
				args[1] = uint64(loc.Pos())
				args[2] = uint64(loc.Start())
				args[3] = uint64(loc.End())
				err = locEncoder.Add(hitNewDocNum, args...)
				if err != nil {
					return 0, 0, 0, nil, err
				}
			}
		}

		lastDocNum = hitNewDocNum
		lastFreq = uint64(nextFreq)
		lastNorm = nextNorm

		next, err = postItr.Next()
	}

	return lastDocNum, lastFreq, lastNorm, bufLoc, err
}

func mergeStoredAndRemap(segments []*Segment, drops []*roaring.Bitmap,
	fieldsMap map[string]uint16, fieldsInv []string, fieldsSame bool, newSegDocCount uint64,
	w *countHashWriter, closeCh chan struct{}) (storedIndexOffset uint64, newDocNums [][]uint64, err error) {
	var newDocNum uint64

	var data []byte
	var metaBuf bytes.Buffer
	varBuf := make([]byte, binary.MaxVarintLen64)
	metaEncode := func(val uint64) (int, error) {
		wb := binary.PutUvarint(varBuf, val)
		return metaBuf.Write(varBuf[:wb])
	}

	vals := make([][][]byte, len(fieldsInv))

	docNumOffsets := make([]uint64, newSegDocCount)

	vdc := visitDocumentCtxPool.Get().(*visitDocumentCtx)
	defer visitDocumentCtxPool.Put(vdc)

	// document chunk coder
	docChunkCoder := newChunkedDocumentCoder(uint64(defaultDocumentChunkSize), w)

	// for each segment
	for segI, seg := range segments {
		// check for the closure in meantime
		if isClosed(closeCh) {
			return 0, nil, segment.ErrClosed
		}

		segNewDocNums := make([]uint64, seg.footer.numDocs)

		dropsI := drops[segI]

		// optimize when the field mapping is the same across all
		// segments and there are no deletions, via byte-copying
		// of stored docs bytes directly to the writer
		if fieldsSame && (dropsI == nil || dropsI.GetCardinality() == 0) {
			err := seg.copyStoredDocs(newDocNum, docNumOffsets, docChunkCoder)
			if err != nil {
				return 0, nil, err
			}

			for i := uint64(0); i < seg.footer.numDocs; i++ {
				segNewDocNums[i] = newDocNum
				newDocNum++
			}
			newDocNums = append(newDocNums, segNewDocNums)

			continue
		}

		var err2 error
		newDocNum, err2 = mergeStoredAndRemapSegment(seg, dropsI, segNewDocNums, newDocNum, &metaBuf, data,
			fieldsInv, vals, vdc, fieldsMap, metaEncode, docNumOffsets, docChunkCoder)
		if err2 != nil {
			return 0, nil, err2
		}

		newDocNums = append(newDocNums, segNewDocNums)
	}

	// document chunk coder
	if err := docChunkCoder.Write(); err != nil {
		return 0, nil, err
	}

	// return value is the start of the stored index
	storedIndexOffset = uint64(w.Count())

	// now write out the stored doc index
	for _, docNumOffset := range docNumOffsets {
		err := binary.Write(w, binary.BigEndian, docNumOffset)
		if err != nil {
			return 0, nil, err
		}
	}

	return storedIndexOffset, newDocNums, nil
}

func mergeStoredAndRemapSegment(seg *Segment, dropsI *roaring.Bitmap, segNewDocNums []uint64, newDocNum uint64,
	metaBuf *bytes.Buffer, data []byte, fieldsInv []string, vals [][][]byte, vdc *visitDocumentCtx,
	fieldsMap map[string]uint16, metaEncode func(val uint64) (int, error), docNumOffsets []uint64,
	docChunkCoder *chunkedDocumentCoder) (uint64, error) {
	// for each doc num
	for docNum := uint64(0); docNum < seg.footer.numDocs; docNum++ {
		// TODO: roaring's API limits docNums to 32-bits?
		if dropsI != nil && dropsI.Contains(uint32(docNum)) {
			segNewDocNums[docNum] = docDropped
			continue
		}

		segNewDocNums[docNum] = newDocNum

		curr := 0
		metaBuf.Reset()
		data = data[:0]

		// collect all the data
		for i := 0; i < len(fieldsInv); i++ {
			vals[i] = vals[i][:0]
		}
		err := seg.visitDocument(vdc, docNum, func(field string, value []byte) bool {
			fieldID := int(fieldsMap[field]) - 1
			vals[fieldID] = append(vals[fieldID], value)
			return true
		})
		if err != nil {
			return 0, err
		}

		// now walk the fields in order
		for fieldID := 0; fieldID < len(fieldsInv); fieldID++ {
			storedFieldValues := vals[fieldID]

			var err2 error
			curr, data, err2 = encodeStoredFieldValues(fieldID,
				storedFieldValues, curr, metaEncode, data)
			if err2 != nil {
				return 0, err2
			}
		}

		metaBytes := metaBuf.Bytes()

		// record where we're about to start writing
		docNumOffsets[newDocNum] = docChunkCoder.Size()
		// document chunk line
		if _, err := docChunkCoder.Add(newDocNum, metaBytes, data); err != nil {
			return 0, err
		}

		newDocNum++
	}
	return newDocNum, nil
}

// copyStoredDocs writes out a segment's stored doc info, optimized by
// using a single Write() call for the entire set of bytes.  The
// newDocNumOffsets is filled with the new offsets for each doc.
func (s *Segment) copyStoredDocs(newDocNum uint64, newDocNumOffsets []uint64, docChunkCoder *chunkedDocumentCoder) error {
	if s.footer.numDocs <= 0 {
		return nil
	}

	// visit documents and rewrite to chunk
	uncompressed := make([]byte, 0)
	for i := 0; i < len(s.storedFieldChunkOffsets)-1; i++ {
		chunkOffstart := s.storedFieldChunkOffsets[i]
		chunkOffend := s.storedFieldChunkOffsets[i+1]
		if chunkOffstart == chunkOffend {
			continue
		}
		compressed, err := s.data.Read(int(chunkOffstart), int(chunkOffend))
		if err != nil {
			return err
		}
		uncompressed, err = ZSTDDecompress(uncompressed[:cap(uncompressed)], compressed)
		if err != nil {
			return err
		}
		storedOffset := 0
		n := 0
		for storedOffset < len(uncompressed) {
			n = 0
			metaDataLenEnd := storedOffset + binary.MaxVarintLen64
			if metaDataLenEnd > cap(uncompressed) {
				metaDataLenEnd = cap(uncompressed)
			}
			metaLenData := uncompressed[storedOffset:metaDataLenEnd]
			metaLen, read := binary.Uvarint(metaLenData)
			n += read
			dataLenEnd := storedOffset + n + binary.MaxVarintLen64
			if dataLenEnd > cap(uncompressed) {
				dataLenEnd = cap(uncompressed)
			}
			dataLenData := uncompressed[storedOffset+n : dataLenEnd]
			dataLen, read := binary.Uvarint(dataLenData)
			n += read
			newDocNumOffsets[newDocNum] = docChunkCoder.Size()
			metaBytes := uncompressed[storedOffset+n : storedOffset+n+int(metaLen)]
			data := uncompressed[storedOffset+n+int(metaLen) : storedOffset+n+int(metaLen+dataLen)]
			if _, err := docChunkCoder.Add(newDocNum, metaBytes, data); err != nil {
				return err
			}
			storedOffset += n + int(metaLen+dataLen)
			newDocNum++
		}
	}

	return nil
}

// mergeFields builds a unified list of fields used across all the
// input segments, and computes whether the fields are the same across
// segments (which depends on fields to be sorted in the same way
// across segments)
func mergeFields(segments []*Segment) (same bool, fields []string) {
	same = true

	var segment0Fields []string
	if len(segments) > 0 {
		segment0Fields = segments[0].Fields()
	}

	fieldsExist := map[string]struct{}{}
	for _, seg := range segments {
		fields = seg.Fields()
		for fieldi, field := range fields {
			fieldsExist[field] = struct{}{}
			if len(segment0Fields) != len(fields) || segment0Fields[fieldi] != field {
				same = false
			}
		}
	}

	fields = make([]string, 0, len(fieldsExist))
	// ensure _id stays first
	fields = append(fields, _idFieldName)
	for k := range fieldsExist {
		if k != _idFieldName {
			fields = append(fields, k)
		}
	}

	sort.Strings(fields[1:]) // leave _id as first

	return same, fields
}

func isClosed(closeCh chan struct{}) bool {
	select {
	case <-closeCh:
		return true
	default:
		return false
	}
}
