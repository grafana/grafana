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
	"bufio"
	"bytes"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"sort"

	"github.com/RoaringBitmap/roaring/v2"
	index "github.com/blevesearch/bleve_index_api"
	seg "github.com/blevesearch/scorch_segment_api/v2"
	"github.com/golang/snappy"
)

var DefaultFileMergerBufferSize = 1024 * 1024

const docDropped = math.MaxUint64 // sentinel docNum to represent a deleted doc

// Merge takes a slice of segments and bit masks describing which
// documents may be dropped, and creates a new segment containing the
// remaining data.  This new segment is built at the specified path.
func (*ZapPlugin) Merge(segments []seg.Segment, drops []*roaring.Bitmap, path string,
	closeCh chan struct{}, s seg.StatsReporter) (
	[][]uint64, uint64, error) {
	segmentBases := make([]*SegmentBase, len(segments))
	for segmenti, segment := range segments {
		switch segmentx := segment.(type) {
		case *Segment:
			segmentBases[segmenti] = &segmentx.SegmentBase
		case *SegmentBase:
			segmentBases[segmenti] = segmentx
		default:
			panic(fmt.Sprintf("oops, unexpected segment type: %T", segment))
		}
	}
	return mergeSegmentBases(segmentBases, drops, path, DefaultChunkMode, closeCh, s)
}

func mergeSegmentBases(segmentBases []*SegmentBase, drops []*roaring.Bitmap, path string,
	chunkMode uint32, closeCh chan struct{}, s seg.StatsReporter) (
	[][]uint64, uint64, error) {
	flag := os.O_RDWR | os.O_CREATE

	f, err := os.OpenFile(path, flag, 0600)
	if err != nil {
		return nil, 0, err
	}

	cleanup := func() {
		_ = f.Close()
		_ = os.Remove(path)
	}

	// buffer the output
	br := bufio.NewWriterSize(f, DefaultFileMergerBufferSize)

	// wrap it for counting (tracking offsets)
	cr := NewCountHashWriterWithStatsReporter(br, s)

	newDocNums, numDocs, storedIndexOffset, _, _, sectionsIndexOffset, err :=
		mergeToWriter(segmentBases, drops, chunkMode, cr, closeCh)
	if err != nil {
		cleanup()
		return nil, 0, err
	}

	// passing the sectionsIndexOffset as fieldsIndexOffset and the docValueOffset as 0 for the footer
	err = persistFooter(numDocs, storedIndexOffset, sectionsIndexOffset, sectionsIndexOffset,
		0, chunkMode, cr.Sum32(), cr)
	if err != nil {
		cleanup()
		return nil, 0, err
	}

	err = br.Flush()
	if err != nil {
		cleanup()
		return nil, 0, err
	}

	err = f.Sync()
	if err != nil {
		cleanup()
		return nil, 0, err
	}

	err = f.Close()
	if err != nil {
		cleanup()
		return nil, 0, err
	}

	return newDocNums, uint64(cr.Count()), nil
}

// Remove fields that have been completely deleted from fieldsInv
func filterFields(fieldsInv []string, fieldInfo map[string]*index.UpdateFieldInfo) []string {
	idx := 0
	for _, field := range fieldsInv {
		if val, ok := fieldInfo[field]; ok && val.Deleted {
			continue
		}
		fieldsInv[idx] = field
		idx++
	}
	return fieldsInv[:idx]
}

func mergeToWriter(segments []*SegmentBase, drops []*roaring.Bitmap,
	chunkMode uint32, cr *CountHashWriter, closeCh chan struct{}) (
	newDocNums [][]uint64, numDocs, storedIndexOffset uint64,
	fieldsInv []string, fieldsMap map[string]uint16, sectionsIndexOffset uint64,
	err error) {

	var fieldsSame bool
	fieldsSame, fieldsInv = mergeFields(segments)
	updatedFields := mergeUpdatedFields(segments)
	fieldsInv = filterFields(fieldsInv, updatedFields)
	fieldsMap = mapFields(fieldsInv)

	numDocs = computeNewDocCount(segments, drops)

	if isClosed(closeCh) {
		return nil, 0, 0, nil, nil, 0, seg.ErrClosed
	}

	// the merge opaque is especially important when it comes to tracking the file
	// offset a field of a particular section is at. This will be used to write the
	// offsets in the fields section index of the file (the final merged file).
	mergeOpaque := map[int]resetable{}
	args := map[string]interface{}{
		"chunkMode":     chunkMode,
		"fieldsSame":    fieldsSame,
		"fieldsMap":     fieldsMap,
		"numDocs":       numDocs,
		"updatedFields": updatedFields,
	}

	if numDocs > 0 {
		storedIndexOffset, newDocNums, err = mergeStoredAndRemap(segments, drops,
			fieldsMap, fieldsInv, fieldsSame, numDocs, cr, closeCh, updatedFields)
		if err != nil {
			return nil, 0, 0, nil, nil, 0, err
		}

		// at this point, ask each section implementation to merge itself
		for i, x := range segmentSections {
			mergeOpaque[int(i)] = x.InitOpaque(args)

			err = x.Merge(mergeOpaque, segments, drops, fieldsInv, newDocNums, cr, closeCh)
			if err != nil {
				return nil, 0, 0, nil, nil, 0, err
			}
		}
	}

	// we can persist the fields section index now, this will point
	// to the various indexes (each in different section) available for a field.
	sectionsIndexOffset, err = persistFieldsSection(fieldsInv, cr, mergeOpaque)
	if err != nil {
		return nil, 0, 0, nil, nil, 0, err
	}

	return newDocNums, numDocs, storedIndexOffset, fieldsInv, fieldsMap, sectionsIndexOffset, nil
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
func computeNewDocCount(segments []*SegmentBase, drops []*roaring.Bitmap) uint64 {
	var newDocCount uint64
	for segI, segment := range segments {
		newDocCount += segment.numDocs
		if drops[segI] != nil {
			newDocCount -= drops[segI].GetCardinality()
		}
	}
	return newDocCount
}

func mergeTermFreqNormLocsByCopying(term []byte, postItr *PostingsIterator,
	newDocNums []uint64, newRoaring *roaring.Bitmap,
	tfEncoder *chunkedIntCoder, locEncoder *chunkedIntCoder) (
	lastDocNum uint64, lastFreq uint64, lastNorm uint64, err error) {
	nextDocNum, nextFreq, nextNorm, nextFreqNormBytes, nextLocBytes, err :=
		postItr.nextBytes()
	for err == nil && len(nextFreqNormBytes) > 0 {
		hitNewDocNum := newDocNums[nextDocNum]
		if hitNewDocNum == docDropped {
			return 0, 0, 0, fmt.Errorf("see hit with dropped doc num")
		}

		newRoaring.Add(uint32(hitNewDocNum))

		err = tfEncoder.AddBytes(hitNewDocNum, nextFreqNormBytes)
		if err != nil {
			return 0, 0, 0, err
		}

		if len(nextLocBytes) > 0 {
			err = locEncoder.AddBytes(hitNewDocNum, nextLocBytes)
			if err != nil {
				return 0, 0, 0, err
			}
		}

		lastDocNum = hitNewDocNum
		lastFreq = nextFreq
		lastNorm = nextNorm

		nextDocNum, nextFreq, nextNorm, nextFreqNormBytes, nextLocBytes, err =
			postItr.nextBytes()
	}

	return lastDocNum, lastFreq, lastNorm, err
}

func mergeTermFreqNormLocs(fieldsMap map[string]uint16, term []byte, postItr *PostingsIterator,
	newDocNums []uint64, newRoaring *roaring.Bitmap,
	tfEncoder *chunkedIntCoder, locEncoder *chunkedIntCoder, bufLoc []uint64) (
	lastDocNum uint64, lastFreq uint64, lastNorm uint64, bufLocOut []uint64, err error) {
	next, err := postItr.Next()
	for next != nil && err == nil {
		hitNewDocNum := newDocNums[next.Number()]
		if hitNewDocNum == docDropped {
			return 0, 0, 0, nil, fmt.Errorf("see hit with dropped docNum")
		}

		newRoaring.Add(uint32(hitNewDocNum))

		nextFreq := next.Frequency()
		var nextNorm uint64
		if pi, ok := next.(*Posting); ok {
			nextNorm = pi.NormUint64()
		} else {
			return 0, 0, 0, nil, fmt.Errorf("unexpected posting type %T", next)
		}

		locs := next.Locations()

		if nextFreq > 0 {
			err = tfEncoder.Add(hitNewDocNum,
				encodeFreqHasLocs(nextFreq, len(locs) > 0), nextNorm)
		} else {
			err = tfEncoder.Add(hitNewDocNum,
				encodeFreqHasLocs(nextFreq, len(locs) > 0))
		}
		if err != nil {
			return 0, 0, 0, nil, err
		}

		if len(locs) > 0 {
			numBytesLocs := 0
			for _, loc := range locs {
				ap := loc.ArrayPositions()
				numBytesLocs += totalUvarintBytes(uint64(fieldsMap[loc.Field()]-1),
					loc.Pos(), loc.Start(), loc.End(), uint64(len(ap)), ap)
			}

			err = locEncoder.Add(hitNewDocNum, uint64(numBytesLocs))
			if err != nil {
				return 0, 0, 0, nil, err
			}

			for _, loc := range locs {
				ap := loc.ArrayPositions()
				if cap(bufLoc) < 5+len(ap) {
					bufLoc = make([]uint64, 0, 5+len(ap))
				}
				args := bufLoc[0:5]
				args[0] = uint64(fieldsMap[loc.Field()] - 1)
				args[1] = loc.Pos()
				args[2] = loc.Start()
				args[3] = loc.End()
				args[4] = uint64(len(ap))
				args = append(args, ap...)
				err = locEncoder.Add(hitNewDocNum, args...)
				if err != nil {
					return 0, 0, 0, nil, err
				}
			}
		}

		lastDocNum = hitNewDocNum
		lastFreq = nextFreq
		lastNorm = nextNorm

		next, err = postItr.Next()
	}

	return lastDocNum, lastFreq, lastNorm, bufLoc, err
}

func writePostings(postings *roaring.Bitmap, tfEncoder, locEncoder *chunkedIntCoder,
	use1HitEncoding func(uint64) (bool, uint64, uint64),
	w *CountHashWriter, bufMaxVarintLen64 []byte) (
	offset uint64, err error) {
	if postings == nil {
		return 0, nil
	}

	termCardinality := postings.GetCardinality()
	if termCardinality <= 0 {
		return 0, nil
	}

	if use1HitEncoding != nil {
		encodeAs1Hit, docNum1Hit, normBits1Hit := use1HitEncoding(termCardinality)
		if encodeAs1Hit {
			return FSTValEncode1Hit(docNum1Hit, normBits1Hit), nil
		}
	}

	var tfOffset uint64
	tfOffset, _, err = tfEncoder.writeAt(w)
	if err != nil {
		return 0, err
	}

	var locOffset uint64
	locOffset, _, err = locEncoder.writeAt(w)
	if err != nil {
		return 0, err
	}

	postingsOffset := uint64(w.Count())

	n := binary.PutUvarint(bufMaxVarintLen64, tfOffset)
	_, err = w.Write(bufMaxVarintLen64[:n])
	if err != nil {
		return 0, err
	}

	n = binary.PutUvarint(bufMaxVarintLen64, locOffset)
	_, err = w.Write(bufMaxVarintLen64[:n])
	if err != nil {
		return 0, err
	}

	_, err = writeRoaringWithLen(postings, w, bufMaxVarintLen64)
	if err != nil {
		return 0, err
	}

	return postingsOffset, nil
}

type varintEncoder func(uint64) (int, error)

func mergeStoredAndRemap(segments []*SegmentBase, drops []*roaring.Bitmap,
	fieldsMap map[string]uint16, fieldsInv []string, fieldsSame bool, newSegDocCount uint64,
	w *CountHashWriter, closeCh chan struct{}, updatedFields map[string]*index.UpdateFieldInfo) (uint64, [][]uint64, error) {
	var rv [][]uint64 // The remapped or newDocNums for each segment.

	var newDocNum uint64

	var curr int
	var data, compressed []byte
	var metaBuf bytes.Buffer
	varBuf := make([]byte, binary.MaxVarintLen64)
	metaEncode := func(val uint64) (int, error) {
		wb := binary.PutUvarint(varBuf, val)
		return metaBuf.Write(varBuf[:wb])
	}

	vals := make([][][]byte, len(fieldsInv))
	typs := make([][]byte, len(fieldsInv))
	poss := make([][][]uint64, len(fieldsInv))

	var posBuf []uint64

	docNumOffsets := make([]uint64, newSegDocCount)

	vdc := visitDocumentCtxPool.Get().(*visitDocumentCtx)
	defer visitDocumentCtxPool.Put(vdc)

	// for each segment
	for segI, segment := range segments {
		// check for the closure in meantime
		if isClosed(closeCh) {
			return 0, nil, seg.ErrClosed
		}

		segNewDocNums := make([]uint64, segment.numDocs)

		dropsI := drops[segI]

		// optimize when the field mapping is the same across all
		// segments and there are no deletions, via byte-copying
		// of stored docs bytes directly to the writer
		// cannot copy directly if fields might have been deleted
		if fieldsSame && (dropsI == nil || dropsI.GetCardinality() == 0) && len(updatedFields) == 0 {
			err := segment.copyStoredDocs(newDocNum, docNumOffsets, w)
			if err != nil {
				return 0, nil, err
			}

			for i := uint64(0); i < segment.numDocs; i++ {
				segNewDocNums[i] = newDocNum
				newDocNum++
			}
			rv = append(rv, segNewDocNums)

			continue
		}

		// for each doc num
		for docNum := uint64(0); docNum < segment.numDocs; docNum++ {
			// TODO: roaring's API limits docNums to 32-bits?
			if dropsI != nil && dropsI.Contains(uint32(docNum)) {
				segNewDocNums[docNum] = docDropped
				continue
			}

			segNewDocNums[docNum] = newDocNum

			curr = 0
			metaBuf.Reset()
			data = data[:0]

			posTemp := posBuf

			// collect all the data
			for i := 0; i < len(fieldsInv); i++ {
				vals[i] = vals[i][:0]
				typs[i] = typs[i][:0]
				poss[i] = poss[i][:0]
			}
			err := segment.visitStoredFields(vdc, docNum, func(field string, typ byte, value []byte, pos []uint64) bool {
				fieldID := int(fieldsMap[field]) - 1
				if fieldID < 0 {
					// no entry for field in fieldsMap
					return false
				}
				// early exit if the stored portion of the field is deleted
				if val, ok := updatedFields[fieldsInv[fieldID]]; ok && val.Store {
					return true
				}
				vals[fieldID] = append(vals[fieldID], value)
				typs[fieldID] = append(typs[fieldID], typ)

				// copy array positions to preserve them beyond the scope of this callback
				var curPos []uint64
				if len(pos) > 0 {
					if cap(posTemp) < len(pos) {
						posBuf = make([]uint64, len(pos)*len(fieldsInv))
						posTemp = posBuf
					}
					curPos = posTemp[0:len(pos)]
					copy(curPos, pos)
					posTemp = posTemp[len(pos):]
				}
				poss[fieldID] = append(poss[fieldID], curPos)

				return true
			})
			if err != nil {
				return 0, nil, err
			}

			// _id field special case optimizes ExternalID() lookups
			idFieldVal := vals[uint16(0)][0]
			_, err = metaEncode(uint64(len(idFieldVal)))
			if err != nil {
				return 0, nil, err
			}

			// now walk the non-"_id" fields in order
			for fieldID := 1; fieldID < len(fieldsInv); fieldID++ {
				// early exit if the stored portion of the field is deleted
				if val, ok := updatedFields[fieldsInv[fieldID]]; ok && val.Store {
					continue
				}
				storedFieldValues := vals[fieldID]

				stf := typs[fieldID]
				spf := poss[fieldID]

				var err2 error
				curr, data, err2 = persistStoredFieldValues(fieldID,
					storedFieldValues, stf, spf, curr, metaEncode, data)
				if err2 != nil {
					return 0, nil, err2
				}
			}

			metaBytes := metaBuf.Bytes()

			compressed = snappy.Encode(compressed[:cap(compressed)], data)

			// record where we're about to start writing
			docNumOffsets[newDocNum] = uint64(w.Count())

			// write out the meta len and compressed data len
			_, err = writeUvarints(w,
				uint64(len(metaBytes)),
				uint64(len(idFieldVal)+len(compressed)))
			if err != nil {
				return 0, nil, err
			}
			// now write the meta
			_, err = w.Write(metaBytes)
			if err != nil {
				return 0, nil, err
			}
			// now write the _id field val (counted as part of the 'compressed' data)
			_, err = w.Write(idFieldVal)
			if err != nil {
				return 0, nil, err
			}
			// now write the compressed data
			_, err = w.Write(compressed)
			if err != nil {
				return 0, nil, err
			}

			newDocNum++
		}

		rv = append(rv, segNewDocNums)
	}

	// return value is the start of the stored index
	storedIndexOffset := uint64(w.Count())

	// now write out the stored doc index
	for _, docNumOffset := range docNumOffsets {
		err := binary.Write(w, binary.BigEndian, docNumOffset)
		if err != nil {
			return 0, nil, err
		}
	}

	return storedIndexOffset, rv, nil
}

// copyStoredDocs writes out a segment's stored doc info, optimized by
// using a single Write() call for the entire set of bytes.  The
// newDocNumOffsets is filled with the new offsets for each doc.
func (sb *SegmentBase) copyStoredDocs(newDocNum uint64, newDocNumOffsets []uint64,
	w *CountHashWriter) error {
	if sb.numDocs <= 0 {
		return nil
	}

	indexOffset0, storedOffset0, _, _, _ :=
		sb.getDocStoredOffsets(0) // the segment's first doc

	indexOffsetN, storedOffsetN, readN, metaLenN, dataLenN :=
		sb.getDocStoredOffsets(sb.numDocs - 1) // the segment's last doc

	storedOffset0New := uint64(w.Count())

	storedBytes := sb.mem[storedOffset0 : storedOffsetN+readN+metaLenN+dataLenN]
	_, err := w.Write(storedBytes)
	if err != nil {
		return err
	}

	// remap the storedOffset's for the docs into new offsets relative
	// to storedOffset0New, filling the given docNumOffsetsOut array
	for indexOffset := indexOffset0; indexOffset <= indexOffsetN; indexOffset += 8 {
		storedOffset := binary.BigEndian.Uint64(sb.mem[indexOffset : indexOffset+8])
		storedOffsetNew := storedOffset - storedOffset0 + storedOffset0New
		newDocNumOffsets[newDocNum] = storedOffsetNew
		newDocNum += 1
	}

	return nil
}

// mergeFields builds a unified list of fields used across all the
// input segments, and computes whether the fields are the same across
// segments (which depends on fields to be sorted in the same way
// across segments)
func mergeFields(segments []*SegmentBase) (bool, []string) {
	fieldsSame := true

	var segment0Fields []string
	if len(segments) > 0 {
		segment0Fields = segments[0].Fields()
	}

	fieldsExist := map[string]struct{}{}
	for _, segment := range segments {
		fields := segment.Fields()
		for fieldi, field := range fields {
			fieldsExist[field] = struct{}{}
			if len(segment0Fields) != len(fields) || segment0Fields[fieldi] != field {
				fieldsSame = false
			}
		}
	}

	rv := make([]string, 0, len(fieldsExist))
	// ensure _id stays first
	rv = append(rv, "_id")
	for k := range fieldsExist {
		if k != "_id" {
			rv = append(rv, k)
		}
	}

	sort.Strings(rv[1:]) // leave _id as first

	return fieldsSame, rv
}

// Combine updateFieldInfo from all segments
func mergeUpdatedFields(segments []*SegmentBase) map[string]*index.UpdateFieldInfo {
	var fieldInfo map[string]*index.UpdateFieldInfo

	for _, segment := range segments {
		for field, info := range segment.updatedFields {
			if fieldInfo == nil {
				fieldInfo = make(map[string]*index.UpdateFieldInfo)
			}
			if _, ok := fieldInfo[field]; !ok {
				fieldInfo[field] = &index.UpdateFieldInfo{
					Deleted:   info.Deleted,
					Index:     info.Index,
					Store:     info.Store,
					DocValues: info.DocValues,
				}
			} else {
				fieldInfo[field].Deleted = fieldInfo[field].Deleted || info.Deleted
				fieldInfo[field].Index = fieldInfo[field].Index || info.Index
				fieldInfo[field].Store = fieldInfo[field].Store || info.Store
				fieldInfo[field].DocValues = fieldInfo[field].Store || info.DocValues
			}
		}

	}
	return fieldInfo
}

func isClosed(closeCh chan struct{}) bool {
	select {
	case <-closeCh:
		return true
	default:
		return false
	}
}
