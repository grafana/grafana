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

package index

import (
	"bufio"
	"bytes"
	"container/heap"
	"encoding/binary"
	"fmt"
	"io"
	"sort"
	"sync"
	"sync/atomic"

	"github.com/RoaringBitmap/roaring"
	segment "github.com/blugelabs/bluge_segment_api"
)

type asyncSegmentResult struct {
	dict    segment.Dictionary
	dictItr segment.DictionaryIterator

	index int
	docs  *roaring.Bitmap

	err error
}

type Snapshot struct {
	parent  *Writer
	segment []*segmentSnapshot
	offsets []uint64
	epoch   uint64
	size    uint64
	creator string

	m    sync.Mutex // Protects the fields that follow.
	refs int64

	m2        sync.Mutex                     // Protects the fields that follow.
	fieldTFRs map[string][]*postingsIterator // keyed by field, recycled TFR's
}

func (i *Snapshot) Segments() []SegmentSnapshot {
	rv := make([]SegmentSnapshot, len(i.segment))
	for j := range i.segment {
		rv[j] = i.segment[j]
	}
	return rv
}

func (i *Snapshot) addRef() {
	i.m.Lock()
	i.refs++
	i.m.Unlock()
}

func (i *Snapshot) decRef() (err error) {
	i.m.Lock()
	i.refs--
	if i.refs == 0 {
		for _, s := range i.segment {
			if s != nil {
				err2 := s.segment.DecRef()
				if err == nil {
					err = err2
				}
			}
		}
	}
	i.m.Unlock()
	return err
}

func (i *Snapshot) Close() error {
	return i.decRef()
}

func (i *Snapshot) Size() int {
	return int(i.size)
}

func (i *Snapshot) updateSize() {
	i.size += uint64(reflectStaticSizeIndexSnapshot)
	for _, s := range i.segment {
		i.size += uint64(s.Size())
	}
}

func (i *Snapshot) newDictionary(field string,
	makeItr func(i segment.Dictionary) segment.DictionaryIterator,
	randomLookup bool) (*dictionary, error) {
	results := make(chan *asyncSegmentResult)
	for _, seg := range i.segment {
		go func(segment *segmentSnapshot) {
			dict, err := segment.segment.Dictionary(field)
			if err != nil {
				results <- &asyncSegmentResult{err: err}
			} else {
				if randomLookup {
					results <- &asyncSegmentResult{dict: dict}
				} else {
					results <- &asyncSegmentResult{dictItr: makeItr(dict)}
				}
			}
		}(seg)
	}

	var err error
	rv := &dictionary{
		snapshot: i,
		cursors:  make([]*segmentDictCursor, 0, len(i.segment)),
	}
	for count := 0; count < len(i.segment); count++ {
		asr := <-results
		if asr.err != nil && err == nil {
			err = asr.err
		} else {
			if !randomLookup {
				next, err2 := asr.dictItr.Next()
				if err2 != nil && err == nil {
					err = err2
				}
				if next != nil {
					rv.cursors = append(rv.cursors, &segmentDictCursor{
						itr:  asr.dictItr,
						curr: next,
					})
				}
			} else {
				rv.cursors = append(rv.cursors, &segmentDictCursor{
					dict: asr.dict,
				})
			}
		}
	}
	// after ensuring we've read all items on channel
	if err != nil {
		return nil, err
	}

	if !randomLookup {
		// prepare heap
		heap.Init(rv)
	}

	return rv, nil
}

func (i *Snapshot) DictionaryLookup(field string) (segment.DictionaryLookup, error) {
	return i.newDictionary(field, nil, true)
}

func (i *Snapshot) DictionaryIterator(field string, automaton segment.Automaton, start, end []byte) (
	segment.DictionaryIterator, error) {
	return i.newDictionary(field, func(i segment.Dictionary) segment.DictionaryIterator {
		return i.Iterator(automaton, start, end)
	}, false)
}

func (i *Snapshot) Fields() ([]string, error) {
	fieldsMap := map[string]struct{}{}
	for _, seg := range i.segment {
		fields := seg.Fields()
		for _, field := range fields {
			fieldsMap[field] = struct{}{}
		}
	}
	rv := make([]string, 0, len(fieldsMap))
	for k := range fieldsMap {
		rv = append(rv, k)
	}
	return rv, nil
}

type collectionStats struct {
	totalDocCount    uint64
	docCount         uint64
	sumTotalTermFreq uint64
}

func (c *collectionStats) TotalDocumentCount() uint64 {
	return c.totalDocCount
}

func (c *collectionStats) DocumentCount() uint64 {
	return c.docCount
}

func (c *collectionStats) SumTotalTermFrequency() uint64 {
	return c.sumTotalTermFreq
}

func (c *collectionStats) Merge(other segment.CollectionStats) {
	c.totalDocCount += other.TotalDocumentCount()
	c.docCount += other.DocumentCount()
	c.sumTotalTermFreq += other.SumTotalTermFrequency()
}

func (i *Snapshot) CollectionStats(field string) (segment.CollectionStats, error) {
	// first handle case where this is a virtual field
	if vFields, ok := i.parent.config.virtualFields[field]; ok {
		for _, vField := range vFields {
			if field == vField.Name() {
				totalDocCount, _ := i.Count()
				return &collectionStats{
					totalDocCount:    totalDocCount,
					docCount:         totalDocCount,
					sumTotalTermFreq: totalDocCount,
				}, nil
			}
		}
	}

	// FIXME just making this work for now, possibly should be async
	var rv segment.CollectionStats
	for _, seg := range i.segment {
		segStats, err := seg.segment.CollectionStats(field)
		if err != nil {
			return nil, err
		}
		if rv == nil {
			rv = segStats
		} else {
			rv.Merge(segStats)
		}
	}
	return rv, nil
}

func (i *Snapshot) Count() (uint64, error) {
	var rv uint64
	for _, seg := range i.segment {
		rv += seg.Count()
	}
	return rv, nil
}

func (i *Snapshot) postingsIteratorAll(term string) (segment.PostingsIterator, error) {
	results := make(chan *asyncSegmentResult)
	for index, seg := range i.segment {
		go func(index int, segment *segmentSnapshot) {
			results <- &asyncSegmentResult{
				index: index,
				docs:  segment.DocNumbersLive(),
			}
		}(index, seg)
	}

	return i.newPostingsIteratorAll(term, results)
}

func (i *Snapshot) newPostingsIteratorAll(term string, results chan *asyncSegmentResult) (segment.PostingsIterator, error) {
	rv := &postingsIteratorAll{
		preAlloc: virtualPosting{
			term: term,
		},
		snapshot:  i,
		iterators: make([]roaring.IntPeekable, len(i.segment)),
	}
	var err error
	for count := 0; count < len(i.segment); count++ {
		asr := <-results
		if asr.err != nil {
			if err == nil {
				// returns the first error encountered
				err = asr.err
			}
		} else if err == nil {
			rv.iterators[asr.index] = asr.docs.Iterator()
		}
	}

	if err != nil {
		return nil, err
	}

	return rv, nil
}

func (i *Snapshot) VisitStoredFields(number uint64, visitor segment.StoredFieldVisitor) error {
	segmentIndex, localDocNum := i.segmentIndexAndLocalDocNumFromGlobal(number)

	for _, vFields := range i.parent.config.virtualFields {
		for _, vField := range vFields {
			if vField.Store() {
				cont := visitor(vField.Name(), vField.Value())
				if !cont {
					return nil
				}
			}
		}
	}
	err := i.segment[segmentIndex].VisitDocument(localDocNum, func(name string, val []byte) bool {
		return visitor(name, val)
	})
	if err != nil {
		return err
	}
	return nil
}

func (i *Snapshot) segmentIndexAndLocalDocNumFromGlobal(docNum uint64) (segmentIndex int, localDocNum uint64) {
	segmentIndex = sort.Search(len(i.offsets),
		func(x int) bool {
			return i.offsets[x] > docNum
		}) - 1

	localDocNum = docNum - i.offsets[segmentIndex]
	return segmentIndex, localDocNum
}

func (i *Snapshot) PostingsIterator(term []byte, field string, includeFreq,
	includeNorm, includeTermVectors bool) (segment.PostingsIterator, error) {
	if vFields, ok := i.parent.config.virtualFields[field]; ok {
		for _, vField := range vFields {
			if vField.Index() {
				var match bool
				vField.EachTerm(func(vFieldTerm segment.FieldTerm) {
					if bytes.Equal(vFieldTerm.Term(), term) {
						match = true
					}
				})
				if match {
					return i.postingsIteratorAll(string(term))
				}
			}
		}
	}

	rv := i.allocPostingsIterator(field)

	rv.term = term
	rv.field = field
	rv.snapshot = i
	if rv.postings == nil {
		rv.postings = make([]segment.PostingsList, len(i.segment))
	}
	if rv.iterators == nil {
		rv.iterators = make([]segment.PostingsIterator, len(i.segment))
	}
	rv.segmentOffset = 0
	rv.includeFreq = includeFreq
	rv.includeNorm = includeNorm
	rv.includeTermVectors = includeTermVectors
	rv.currPosting = nil
	rv.currID = 0

	if rv.dicts == nil {
		rv.dicts = make([]segment.Dictionary, len(i.segment))
		for i, seg := range i.segment {
			dict, err := seg.segment.Dictionary(field)
			if err != nil {
				return nil, err
			}
			rv.dicts[i] = dict
		}
	}

	for i, seg := range i.segment {
		pl, err := rv.dicts[i].PostingsList(term, seg.deleted, rv.postings[i])
		if err != nil {
			return nil, err
		}
		rv.postings[i] = pl
		rv.iterators[i], err = pl.Iterator(includeFreq, includeNorm, includeTermVectors, rv.iterators[i])
		if err != nil {
			return nil, err
		}
	}
	atomic.AddUint64(&i.parent.stats.TotTermSearchersStarted, uint64(1))
	return rv, nil
}

func (i *Snapshot) allocPostingsIterator(field string) (tfr *postingsIterator) {
	i.m2.Lock()
	if i.fieldTFRs != nil {
		tfrs := i.fieldTFRs[field]
		last := len(tfrs) - 1
		if last >= 0 {
			tfr = tfrs[last]
			tfrs[last] = nil
			i.fieldTFRs[field] = tfrs[:last]
			i.m2.Unlock()
			return
		}
	}
	i.m2.Unlock()
	return &postingsIterator{
		recycle: true,
	}
}

func (i *Snapshot) recyclePostingsIterator(tfr *postingsIterator) {
	if !tfr.recycle {
		// Do not recycle an optimized unadorned term field reader (used for
		// ConjunctionUnadorned or DisjunctionUnadorned), during when a fresh
		// roaring.Bitmap is built by AND-ing or OR-ing individual bitmaps,
		// and we'll need to release them for GC. (See MB-40916)
		return
	}

	if i.epoch != i.parent.currentEpoch() {
		// if we're not the current root (mutations happened), don't bother recycling
		return
	}

	i.m2.Lock()
	if i.fieldTFRs == nil {
		i.fieldTFRs = map[string][]*postingsIterator{}
	}
	i.fieldTFRs[tfr.field] = append(i.fieldTFRs[tfr.field], tfr)
	i.m2.Unlock()
}

func (i *Snapshot) unadornedPostingsIterator(
	term []byte, field string) *postingsIterator {
	// This IndexSnapshotTermFieldReader will not be recycled, more
	// conversation here: https://github.com/blevesearch/bleve/pull/1438
	return &postingsIterator{
		term:               term,
		field:              field,
		snapshot:           i,
		iterators:          make([]segment.PostingsIterator, len(i.segment)),
		segmentOffset:      0,
		includeFreq:        false,
		includeNorm:        false,
		includeTermVectors: false,
		recycle:            false,
	}
}

const blugeSnapshotFormatVersion1 = 1
const blugeSnapshotFormatVersion = blugeSnapshotFormatVersion1
const crcWidth = 4

func (i *Snapshot) WriteTo(w io.Writer, _ chan struct{}) (int64, error) {
	bw := bufio.NewWriter(w)
	chw := newCountHashWriter(bw)

	var bytesWritten int64
	var intBuf = make([]byte, binary.MaxVarintLen64)
	// write the bluge snapshot format version number
	n := binary.PutUvarint(intBuf, uint64(blugeSnapshotFormatVersion))
	sz, err := chw.Write(intBuf[:n])
	if err != nil {
		return bytesWritten, fmt.Errorf("error writing snapshot %d: %w", i.epoch, err)
	}
	bytesWritten += int64(sz)

	// write number of segments
	n = binary.PutUvarint(intBuf, uint64(len(i.segment)))
	sz, err = chw.Write(intBuf[:n])
	if err != nil {
		return bytesWritten, fmt.Errorf("error writing snapshot %d: %w", i.epoch, err)
	}
	bytesWritten += int64(sz)

	for _, segmentSnapshot := range i.segment {
		sz, err = recordSegment(chw, segmentSnapshot, segmentSnapshot.id, segmentSnapshot.segment.Type(), segmentSnapshot.segment.Version())
		if err != nil {
			return bytesWritten, fmt.Errorf("error writing snapshot %d: %w", i.epoch, err)
		}
		bytesWritten += int64(sz)
	}

	// write crc32 at end of file
	crc32 := chw.Sum32()
	binary.BigEndian.PutUint32(intBuf, crc32)
	sz, err = chw.Write(intBuf[:crcWidth])
	if err != nil {
		return bytesWritten, fmt.Errorf("error writing snapshot %d: %w", i.epoch, err)
	}
	bytesWritten += int64(sz)

	err = bw.Flush()
	if err != nil {
		return bytesWritten, err
	}

	return bytesWritten, nil
}

func recordSegment(w io.Writer, snapshot *segmentSnapshot, id uint64, typ string, ver uint32) (int, error) {
	var bytesWritten int
	var intBuf = make([]byte, binary.MaxVarintLen64)
	// record type
	sz, err := writeVarLenString(w, intBuf, typ)
	if err != nil {
		return bytesWritten, err
	}
	bytesWritten += sz

	// record version
	binary.BigEndian.PutUint32(intBuf, ver)
	sz, err = w.Write(intBuf[:4])
	if err != nil {
		return bytesWritten, err
	}
	bytesWritten += sz

	// record segment id
	n := binary.PutUvarint(intBuf, id)
	sz, err = w.Write(intBuf[:n])
	if err != nil {
		return bytesWritten, err
	}
	bytesWritten += sz

	// record deleted bits
	if snapshot.deleted != nil {
		var deletedBytes []byte
		deletedBytes, err = snapshot.deleted.ToBytes()
		if err != nil {
			return bytesWritten, err
		}
		// first length
		n := binary.PutUvarint(intBuf, uint64(len(deletedBytes)))
		sz, err = w.Write(intBuf[:n])
		if err != nil {
			return bytesWritten, err
		}
		bytesWritten += sz

		// then data
		sz, err = w.Write(deletedBytes)
		if err != nil {
			return bytesWritten, err
		}
		bytesWritten += sz
	} else {
		n := binary.PutUvarint(intBuf, 0)
		sz, err = w.Write(intBuf[:n])
		if err != nil {
			return bytesWritten, err
		}
		bytesWritten += sz
	}

	return bytesWritten, nil
}

func writeVarLenString(w io.Writer, intBuf []byte, str string) (int, error) {
	var bytesWritten int
	n := binary.PutUvarint(intBuf, uint64(len(str)))
	sz, err := w.Write(intBuf[:n])
	if err != nil {
		return bytesWritten, err
	}
	bytesWritten += sz
	sz, err = w.Write([]byte(str))
	if err != nil {
		return bytesWritten, err
	}
	bytesWritten += sz
	return bytesWritten, nil
}

func (i *Snapshot) ReadFrom(r io.Reader) (int64, error) {
	var bytesRead int64
	br := bufio.NewReader(r)

	// read bluge snapshot format version
	peek, err := br.Peek(binary.MaxVarintLen64)
	if err != nil && err != io.EOF {
		return bytesRead, fmt.Errorf("error peeking snapshot format version %d: %w", i.epoch, err)
	}
	snapshotFormatVersion, n := binary.Uvarint(peek)
	sz, err := br.Discard(n)
	if err != nil {
		return bytesRead, fmt.Errorf("error reading snapshot format version %d: %w", i.epoch, err)
	}
	bytesRead += int64(sz)

	if snapshotFormatVersion == blugeSnapshotFormatVersion1 {
		n, err := i.readFromVersion1(br)
		return n + bytesRead, err
	}

	return bytesRead, fmt.Errorf("unsupportred snapshot format version: %d", snapshotFormatVersion)
}

func (i *Snapshot) readFromVersion1(br *bufio.Reader) (int64, error) {
	var bytesRead int64

	// read number of segments
	peek, err := br.Peek(binary.MaxVarintLen64)
	if err != nil && err != io.EOF {
		return bytesRead, fmt.Errorf("error peeking snapshot number of segments %d: %w", i.epoch, err)
	}
	numSegments, n := binary.Uvarint(peek)
	sz, err := br.Discard(n)
	if err != nil {
		return bytesRead, fmt.Errorf("error reading snapshot number of segments %d: %w", i.epoch, err)
	}
	bytesRead += int64(sz)

	for j := 0; j < int(numSegments); j++ {
		segmentBytesRead, ss, err := i.readSegmentSnapshot(br)
		if err != nil {
			return bytesRead, err
		}
		bytesRead += segmentBytesRead

		i.segment = append(i.segment, ss)
	}

	return bytesRead, nil
}

func (i *Snapshot) readSegmentSnapshot(br *bufio.Reader) (bytesRead int64, ss *segmentSnapshot, err error) {
	var sz int
	var segmentType string
	// read type
	sz, segmentType, err = readVarLenString(br)
	if err != nil {
		return bytesRead, nil, fmt.Errorf("error reading snapshot %d: %w", i.epoch, err)
	}
	bytesRead += int64(sz)

	// read ver
	verBuf := make([]byte, 4)
	sz, err = br.Read(verBuf)
	if err != nil {
		return bytesRead, nil, fmt.Errorf("error reading snapshot %d: %w", i.epoch, err)
	}
	segmentVersion := binary.BigEndian.Uint32(verBuf)
	bytesRead += int64(sz)

	// read segment id
	peekSegmentID, err := br.Peek(binary.MaxVarintLen64)
	if err != nil && err != io.EOF {
		return bytesRead, nil, fmt.Errorf("error reading snapshot %d: %w", i.epoch, err)
	}
	segmentID, n := binary.Uvarint(peekSegmentID)
	sz, err = br.Discard(n)
	if err != nil {
		return bytesRead, nil, fmt.Errorf("error reading snapshot %d: %w", i.epoch, err)
	}
	bytesRead += int64(sz)

	ss = &segmentSnapshot{
		id:             segmentID,
		segmentType:    segmentType,
		segmentVersion: segmentVersion,
	}

	// read size of deleted bitmap
	peek, err := br.Peek(binary.MaxVarintLen64)
	if err != nil && err != io.EOF {
		return bytesRead, nil, fmt.Errorf("xerror reading snapshot %d: %w", i.epoch, err)
	}
	delLen, n := binary.Uvarint(peek)
	sz, err = br.Discard(n)
	if err != nil {
		return bytesRead, nil, fmt.Errorf("error reading snapshot %d: %w", i.epoch, err)
	}
	bytesRead += int64(sz)

	if delLen > 0 {
		deletedBytes := make([]byte, int(delLen))
		sz, err = io.ReadFull(br, deletedBytes)
		if err != nil {
			return bytesRead, nil, fmt.Errorf("error reading snapshot %d: %w", i.epoch, err)
		}
		bytesRead += int64(sz)

		rr := bytes.NewReader(deletedBytes)
		deletedBitmap := roaring.NewBitmap()
		_, err = deletedBitmap.ReadFrom(rr)
		if err != nil {
			return bytesRead, nil, fmt.Errorf("error reading snapshot %d: %w", i.epoch, err)
		}

		if !deletedBitmap.IsEmpty() {
			ss.deleted = deletedBitmap
		}
	}
	return bytesRead, ss, nil
}

func readVarLenString(r *bufio.Reader) (n int, str string, err error) {
	peek, err := r.Peek(binary.MaxVarintLen64)
	if err != nil {
		return n, "", err
	}
	strLen, uVarRead := binary.Uvarint(peek)
	sz, err := r.Discard(uVarRead)
	if err != nil {
		return n, "", err
	}
	n += sz

	strBytes := make([]byte, strLen)
	sz, err = r.Read(strBytes)
	if err != nil {
		return n, "", err
	}
	n += sz
	return n, string(strBytes), nil
}

func (i *Snapshot) DocumentValueReader(fields []string) (
	segment.DocumentValueReader, error) {
	return &documentValueReader{i: i, fields: fields, currSegmentIndex: -1}, nil
}

func (i *Snapshot) Backup(remote Directory, cancel chan struct{}) error {
	// first copy all the segments
	for j := range i.segment {
		err := remote.Persist(ItemKindSegment, i.segment[j].id, i.segment[j].segment, cancel)
		if err != nil {
			return fmt.Errorf("error backing up segment %d: %w", i.segment[j].id, err)
		}
	}
	// now persist ourself (snapshot)
	err := remote.Persist(ItemKindSnapshot, i.epoch, i, cancel)
	if err != nil {
		return fmt.Errorf("error backing up snapshot %d: %w", i.epoch, err)
	}

	return nil
}

type documentValueReader struct {
	i      *Snapshot
	fields []string
	sdvr   segment.DocumentValueReader

	currSegmentIndex int
}

func (dvr *documentValueReader) VisitDocumentValues(number uint64,
	visitor segment.DocumentValueVisitor) (err error) {
	segmentIndex, localDocNum := dvr.i.segmentIndexAndLocalDocNumFromGlobal(number)
	if segmentIndex >= len(dvr.i.segment) {
		return nil
	}

	if dvr.currSegmentIndex != segmentIndex {
		dvr.currSegmentIndex = segmentIndex
		sdvr, err := dvr.i.segment[dvr.currSegmentIndex].segment.DocumentValueReader(dvr.fields)
		if err != nil {
			return err
		}
		dvr.sdvr = sdvr
	}

	// handle virtual fields first
	for _, field := range dvr.fields {
		if vFields, ok := dvr.i.parent.config.virtualFields[field]; ok {
			for _, vField := range vFields {
				vField := vField
				vField.EachTerm(func(term segment.FieldTerm) {
					visitor(vField.Name(), term.Term())
				})
			}
		}
	}

	return dvr.sdvr.VisitDocumentValues(localDocNum, visitor)
}
