//  Copyright (c) 2024 Couchbase, Inc.
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
	"sort"

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/RoaringBitmap/roaring/v2/roaring64"
	index "github.com/blevesearch/bleve_index_api"
	seg "github.com/blevesearch/scorch_segment_api/v2"
	"github.com/blevesearch/vellum"
)

func init() {
	registerSegmentSection(SectionSynonymIndex, &synonymIndexSection{})
	invertedTextIndexSectionExclusionChecks = append(invertedTextIndexSectionExclusionChecks, func(field index.Field) bool {
		_, ok := field.(index.SynonymField)
		return ok
	})
}

// -----------------------------------------------------------------------------

type synonymIndexOpaque struct {
	results []index.Document

	// indicates whether the following structs are initialized
	init bool

	// FieldsMap maps field name to field id and must be set in
	// the index opaque using the key "fieldsMap"
	// used for ensuring accurate mapping between fieldID and
	// thesaurusID
	//  name -> field id + 1
	FieldsMap map[string]uint16

	// ThesaurusMap adds 1 to thesaurus id to avoid zero value issues
	//  name -> thesaurus id + 1
	ThesaurusMap map[string]uint16

	// ThesaurusMapInv is the inverse of ThesaurusMap
	//  thesaurus id + 1 -> name
	ThesaurusInv []string

	// Thesaurus for each thesaurus ID
	//  thesaurus id -> LHS term -> synonym postings list id + 1
	Thesauri []map[string]uint64

	// LHS Terms for each thesaurus ID, where terms are sorted ascending
	//  thesaurus id -> []term
	ThesaurusKeys [][]string

	// FieldIDtoThesaurusID maps the field id to the thesaurus id
	//  field id -> thesaurus id
	FieldIDtoThesaurusID map[uint16]int

	// SynonymIDtoTerm maps synonym id to term for each thesaurus
	//  thesaurus id -> synonym id -> term
	SynonymTermToID []map[string]uint32

	// SynonymTermToID maps term to synonym id for each thesaurus
	//  thesaurus id -> term -> synonym id
	// this is the inverse of SynonymIDtoTerm for each thesaurus
	SynonymIDtoTerm []map[uint32]string

	//  synonym postings list -> synonym bitmap
	Synonyms []*roaring64.Bitmap

	// A reusable vellum FST builder that will be stored in the synonym opaque
	// and reused across multiple document batches during the persist phase
	// of the synonym index section, the FST builder is used to build the
	// FST for each thesaurus, which maps terms to their corresponding synonym bitmaps.
	builder *vellum.Builder

	// A reusable buffer for the vellum FST builder. It streams data written
	// into the builder into a byte slice. The final byte slice represents
	// the serialized vellum FST, which will be written to disk
	builderBuf bytes.Buffer

	// A reusable buffer for temporary use within the synonym index opaque
	tmp0 []byte

	// A map linking thesaurus IDs to their corresponding thesaurus' file offsets
	thesaurusAddrs map[int]int
}

// Set the fieldsMap and results in the synonym index opaque before the section processes a synonym field.
func (so *synonymIndexOpaque) Set(key string, value interface{}) {
	switch key {
	case "results":
		so.results = value.([]index.Document)
	case "fieldsMap":
		so.FieldsMap = value.(map[string]uint16)
	}
}

// Reset the synonym index opaque after a batch of documents have been processed into a segment.
func (so *synonymIndexOpaque) Reset() (err error) {
	// cleanup stuff over here
	so.results = nil
	so.init = false
	so.ThesaurusMap = nil
	so.ThesaurusInv = so.ThesaurusInv[:0]
	for i := range so.Thesauri {
		so.Thesauri[i] = nil
	}
	so.Thesauri = so.Thesauri[:0]
	for i := range so.ThesaurusKeys {
		so.ThesaurusKeys[i] = so.ThesaurusKeys[i][:0]
	}
	so.ThesaurusKeys = so.ThesaurusKeys[:0]
	for _, idn := range so.Synonyms {
		idn.Clear()
	}
	so.Synonyms = so.Synonyms[:0]
	so.builderBuf.Reset()
	if so.builder != nil {
		err = so.builder.Reset(&so.builderBuf)
	}
	so.FieldIDtoThesaurusID = nil
	so.SynonymTermToID = so.SynonymTermToID[:0]
	so.SynonymIDtoTerm = so.SynonymIDtoTerm[:0]

	so.tmp0 = so.tmp0[:0]
	return err
}

func (so *synonymIndexOpaque) process(field index.SynonymField, fieldID uint16, docNum uint32) {
	// if this is the first time we are processing a synonym field in this batch
	// we need to allocate memory for the thesauri and related data structures
	if !so.init {
		so.realloc()
		so.init = true
	}

	// get the thesaurus id for this field
	tid := so.FieldIDtoThesaurusID[fieldID]

	// get the thesaurus for this field
	thesaurus := so.Thesauri[tid]

	termSynMap := so.SynonymTermToID[tid]

	field.IterateSynonyms(func(term string, synonyms []string) {
		pid := thesaurus[term] - 1

		bs := so.Synonyms[pid]

		for _, syn := range synonyms {
			code := encodeSynonym(termSynMap[syn], docNum)
			bs.Add(code)
		}
	})
}

// a one-time call to allocate memory for the thesauri and synonyms which takes
// all the documents in the result batch and the fieldsMap and predetermines the
// size of the data structures in the synonymIndexOpaque
func (so *synonymIndexOpaque) realloc() {
	var pidNext int
	var sidNext uint32
	so.ThesaurusMap = map[string]uint16{}
	so.FieldIDtoThesaurusID = map[uint16]int{}

	// count the number of unique thesauri from the batch of documents
	for _, result := range so.results {
		if synDoc, ok := result.(index.SynonymDocument); ok {
			synDoc.VisitSynonymFields(func(synField index.SynonymField) {
				fieldIDPlus1 := so.FieldsMap[synField.Name()]
				so.getOrDefineThesaurus(fieldIDPlus1-1, synField.Name())
			})
		}
	}

	for _, result := range so.results {
		if synDoc, ok := result.(index.SynonymDocument); ok {
			synDoc.VisitSynonymFields(func(synField index.SynonymField) {
				fieldIDPlus1 := so.FieldsMap[synField.Name()]
				thesaurusID := so.getOrDefineThesaurus(fieldIDPlus1-1, synField.Name())

				thesaurus := so.Thesauri[thesaurusID]
				thesaurusKeys := so.ThesaurusKeys[thesaurusID]

				synTermMap := so.SynonymIDtoTerm[thesaurusID]

				termSynMap := so.SynonymTermToID[thesaurusID]

				// iterate over all the term-synonyms pair from the field
				synField.IterateSynonyms(func(term string, synonyms []string) {
					_, exists := thesaurus[term]
					if !exists {
						pidNext++
						pidPlus1 := uint64(pidNext)

						thesaurus[term] = pidPlus1
						thesaurusKeys = append(thesaurusKeys, term)
					}
					for _, syn := range synonyms {
						_, exists := termSynMap[syn]
						if !exists {
							termSynMap[syn] = sidNext
							synTermMap[sidNext] = syn
							sidNext++
						}
					}
				})
				so.ThesaurusKeys[thesaurusID] = thesaurusKeys
			})
		}
	}

	numSynonymsLists := pidNext

	if cap(so.Synonyms) >= numSynonymsLists {
		so.Synonyms = so.Synonyms[:numSynonymsLists]
	} else {
		synonyms := make([]*roaring64.Bitmap, numSynonymsLists)
		copy(synonyms, so.Synonyms[:cap(so.Synonyms)])
		for i := 0; i < numSynonymsLists; i++ {
			if synonyms[i] == nil {
				synonyms[i] = roaring64.New()
			}
		}
		so.Synonyms = synonyms
	}

	for _, thes := range so.ThesaurusKeys {
		sort.Strings(thes)
	}
}

// getOrDefineThesaurus returns the thesaurus id for the given field id and thesaurus name.
func (so *synonymIndexOpaque) getOrDefineThesaurus(fieldID uint16, thesaurusName string) int {
	thesaurusIDPlus1, exists := so.ThesaurusMap[thesaurusName]
	if !exists {
		// need to create a new thesaurusID for this thesaurusName and
		thesaurusIDPlus1 = uint16(len(so.ThesaurusInv) + 1)
		so.ThesaurusMap[thesaurusName] = thesaurusIDPlus1
		so.ThesaurusInv = append(so.ThesaurusInv, thesaurusName)

		so.Thesauri = append(so.Thesauri, make(map[string]uint64))

		so.SynonymIDtoTerm = append(so.SynonymIDtoTerm, make(map[uint32]string))

		so.SynonymTermToID = append(so.SynonymTermToID, make(map[string]uint32))

		// map the fieldID to the thesaurusID
		so.FieldIDtoThesaurusID[fieldID] = int(thesaurusIDPlus1 - 1)

		n := len(so.ThesaurusKeys)
		if n < cap(so.ThesaurusKeys) {
			so.ThesaurusKeys = so.ThesaurusKeys[:n+1]
			so.ThesaurusKeys[n] = so.ThesaurusKeys[n][:0]
		} else {
			so.ThesaurusKeys = append(so.ThesaurusKeys, []string(nil))
		}
	}

	return int(thesaurusIDPlus1 - 1)
}

// grabBuf returns a reusable buffer of the given size from the synonymIndexOpaque.
func (so *synonymIndexOpaque) grabBuf(size int) []byte {
	buf := so.tmp0
	if cap(buf) < size {
		buf = make([]byte, size)
		so.tmp0 = buf
	}
	return buf[:size]
}

func (so *synonymIndexOpaque) writeThesauri(w *CountHashWriter) (thesOffsets []uint64, err error) {

	if so.results == nil || len(so.results) == 0 {
		return nil, nil
	}

	thesOffsets = make([]uint64, len(so.ThesaurusInv))

	buf := so.grabBuf(binary.MaxVarintLen64)

	if so.builder == nil {
		so.builder, err = vellum.New(&so.builderBuf, nil)
		if err != nil {
			return nil, err
		}
	}

	for thesaurusID, terms := range so.ThesaurusKeys {
		thes := so.Thesauri[thesaurusID]
		for _, term := range terms { // terms are already sorted
			pid := thes[term] - 1
			postingsBS := so.Synonyms[pid]
			postingsOffset, err := writeSynonyms(postingsBS, w, buf)
			if err != nil {
				return nil, err
			}

			if postingsOffset > uint64(0) {
				err = so.builder.Insert([]byte(term), postingsOffset)
				if err != nil {
					return nil, err
				}
			}
		}

		err = so.builder.Close()
		if err != nil {
			return nil, err
		}

		thesOffsets[thesaurusID] = uint64(w.Count())

		vellumData := so.builderBuf.Bytes()

		// write out the length of the vellum data
		n := binary.PutUvarint(buf, uint64(len(vellumData)))
		_, err = w.Write(buf[:n])
		if err != nil {
			return nil, err
		}

		// write this vellum to disk
		_, err = w.Write(vellumData)
		if err != nil {
			return nil, err
		}

		// reset vellum for reuse
		so.builderBuf.Reset()

		err = so.builder.Reset(&so.builderBuf)
		if err != nil {
			return nil, err
		}

		// write out the synTermMap for this thesaurus
		err := writeSynTermMap(so.SynonymIDtoTerm[thesaurusID], w, buf)
		if err != nil {
			return nil, err
		}

		thesaurusStart := w.Count()

		n = binary.PutUvarint(buf, fieldNotUninverted)
		_, err = w.Write(buf[:n])
		if err != nil {
			return nil, err
		}

		n = binary.PutUvarint(buf, fieldNotUninverted)
		_, err = w.Write(buf[:n])
		if err != nil {
			return nil, err
		}

		n = binary.PutUvarint(buf, thesOffsets[thesaurusID])
		_, err = w.Write(buf[:n])
		if err != nil {
			return nil, err
		}
		so.thesaurusAddrs[thesaurusID] = thesaurusStart
	}
	return thesOffsets, nil
}

// -----------------------------------------------------------------------------

type synonymIndexSection struct {
}

func (s *synonymIndexSection) getSynonymIndexOpaque(opaque map[int]resetable) *synonymIndexOpaque {
	if _, ok := opaque[SectionSynonymIndex]; !ok {
		opaque[SectionSynonymIndex] = s.InitOpaque(nil)
	}
	return opaque[SectionSynonymIndex].(*synonymIndexOpaque)
}

// Implementations of the Section interface for the synonym index section.
// InitOpaque initializes the synonym index opaque, which sets the FieldsMap and
// results in the opaque before the section processes a synonym field.
func (s *synonymIndexSection) InitOpaque(args map[string]interface{}) resetable {
	rv := &synonymIndexOpaque{
		thesaurusAddrs: map[int]int{},
	}
	for k, v := range args {
		rv.Set(k, v)
	}

	return rv
}

// Process processes a synonym field by adding the synonyms to the thesaurus
// pointed to by the fieldID, implements the Process API for the synonym index section.
func (s *synonymIndexSection) Process(opaque map[int]resetable, docNum uint32, field index.Field, fieldID uint16) {
	if fieldID == math.MaxUint16 {
		return
	}
	if sf, ok := field.(index.SynonymField); ok {
		so := s.getSynonymIndexOpaque(opaque)
		so.process(sf, fieldID, docNum)
	}
}

// Persist serializes and writes the thesauri processed to the writer, along
// with the synonym postings lists, and the synonym term map. Implements the
// Persist API for the synonym index section.
func (s *synonymIndexSection) Persist(opaque map[int]resetable, w *CountHashWriter) (n int64, err error) {
	synIndexOpaque := s.getSynonymIndexOpaque(opaque)
	_, err = synIndexOpaque.writeThesauri(w)
	return 0, err
}

// AddrForField returns the file offset of the thesaurus for the given fieldID,
// it uses the FieldIDtoThesaurusID map to translate the fieldID to the thesaurusID,
// and returns the corresponding thesaurus offset from the thesaurusAddrs map.
// Implements the AddrForField API for the synonym index section.
func (s *synonymIndexSection) AddrForField(opaque map[int]resetable, fieldID int) int {
	synIndexOpaque := s.getSynonymIndexOpaque(opaque)
	if synIndexOpaque == nil || synIndexOpaque.FieldIDtoThesaurusID == nil {
		return 0
	}
	tid, exists := synIndexOpaque.FieldIDtoThesaurusID[uint16(fieldID)]
	if !exists {
		return 0
	}
	return synIndexOpaque.thesaurusAddrs[tid]
}

// Merge merges the thesauri, synonym postings lists and synonym term maps from
// the segments into a single thesaurus and serializes and writes the merged
// thesaurus and associated data to the writer. Implements the Merge API for the
// synonym index section.
func (s *synonymIndexSection) Merge(opaque map[int]resetable, segments []*SegmentBase,
	drops []*roaring.Bitmap, fieldsInv []string, newDocNumsIn [][]uint64,
	w *CountHashWriter, closeCh chan struct{}) error {
	so := s.getSynonymIndexOpaque(opaque)
	thesaurusAddrs, fieldIDtoThesaurusID, err := mergeAndPersistSynonymSection(segments, drops, fieldsInv, newDocNumsIn, w, closeCh)
	if err != nil {
		return err
	}

	so.thesaurusAddrs = thesaurusAddrs
	so.FieldIDtoThesaurusID = fieldIDtoThesaurusID
	return nil
}

// -----------------------------------------------------------------------------

// encodeSynonym encodes a synonymID and a docID into a single uint64 value.
// The encoding format splits the 64 bits as follows:
//
//	63        32 31         0
//	+-----------+----------+
//	| synonymID |  docNum  |
//	+-----------+----------+
//
// The upper 32 bits (63-32) store the synonymID, and the lower 32 bits (31-0) store the docID.
//
// Parameters:
//
//	synonymID - A 32-bit unsigned integer representing the ID of the synonym.
//	docID     - A 32-bit unsigned integer representing the document ID.
//
// Returns:
//
//	A 64-bit unsigned integer that combines the synonymID and docID.
func encodeSynonym(synonymID uint32, docID uint32) uint64 {
	return uint64(synonymID)<<32 | uint64(docID)
}

// writeSynonyms serilizes and writes the synonym postings list to the writer, by first
// serializing the postings list to a byte slice and then writing the length
// of the byte slice followed by the byte slice itself.
func writeSynonyms(postings *roaring64.Bitmap, w *CountHashWriter, bufMaxVarintLen64 []byte) (
	offset uint64, err error) {
	termCardinality := postings.GetCardinality()
	if termCardinality <= 0 {
		return 0, nil
	}

	postingsOffset := uint64(w.Count())

	buf, err := postings.ToBytes()
	if err != nil {
		return 0, err
	}
	// write out the length
	n := binary.PutUvarint(bufMaxVarintLen64, uint64(len(buf)))
	_, err = w.Write(bufMaxVarintLen64[:n])
	if err != nil {
		return 0, err
	}
	// write out the roaring bytes
	_, err = w.Write(buf)
	if err != nil {
		return 0, err
	}

	return postingsOffset, nil
}

// writeSynTermMap serializes and writes the synonym term map to the writer, by first
// writing the length of the map followed by the map entries, where each entry
// consists of the synonym ID, the length of the term, and the term itself.
func writeSynTermMap(synTermMap map[uint32]string, w *CountHashWriter, bufMaxVarintLen64 []byte) error {
	if len(synTermMap) == 0 {
		return nil
	}
	n := binary.PutUvarint(bufMaxVarintLen64, uint64(len(synTermMap)))
	_, err := w.Write(bufMaxVarintLen64[:n])
	if err != nil {
		return err
	}

	for sid, term := range synTermMap {
		n = binary.PutUvarint(bufMaxVarintLen64, uint64(sid))
		_, err = w.Write(bufMaxVarintLen64[:n])
		if err != nil {
			return err
		}

		n = binary.PutUvarint(bufMaxVarintLen64, uint64(len(term)))
		_, err = w.Write(bufMaxVarintLen64[:n])
		if err != nil {
			return err
		}

		_, err = w.Write([]byte(term))
		if err != nil {
			return err
		}
	}

	return nil
}

func mergeAndPersistSynonymSection(segments []*SegmentBase, dropsIn []*roaring.Bitmap,
	fieldsInv []string, newDocNumsIn [][]uint64, w *CountHashWriter,
	closeCh chan struct{}) (map[int]int, map[uint16]int, error) {

	var bufMaxVarintLen64 []byte = make([]byte, binary.MaxVarintLen64)

	var synonyms *SynonymsList
	var synItr *SynonymsIterator

	thesaurusAddrs := make(map[int]int)

	var vellumBuf bytes.Buffer
	newVellum, err := vellum.New(&vellumBuf, nil)
	if err != nil {
		return nil, nil, err
	}

	newRoaring := roaring64.NewBitmap()

	newDocNums := make([][]uint64, 0, len(segments))

	drops := make([]*roaring.Bitmap, 0, len(segments))

	thesauri := make([]*Thesaurus, 0, len(segments))

	itrs := make([]vellum.Iterator, 0, len(segments))

	fieldIDtoThesaurusID := make(map[uint16]int)

	var thesaurusID int
	var newSynonymID uint32

	// for each field
	for fieldID, fieldName := range fieldsInv {
		// collect FST iterators from all active segments for this field
		newDocNums = newDocNums[:0]
		drops = drops[:0]
		thesauri = thesauri[:0]
		itrs = itrs[:0]
		newSynonymID = 0
		synTermMap := make(map[uint32]string)
		termSynMap := make(map[string]uint32)

		for segmentI, segment := range segments {
			// check for the closure in meantime
			if isClosed(closeCh) {
				return nil, nil, seg.ErrClosed
			}

			thes, err2 := segment.thesaurus(fieldName)
			if err2 != nil {
				return nil, nil, err2
			}
			if thes != nil && thes.fst != nil {
				itr, err2 := thes.fst.Iterator(nil, nil)
				if err2 != nil && err2 != vellum.ErrIteratorDone {
					return nil, nil, err2
				}
				if itr != nil {
					newDocNums = append(newDocNums, newDocNumsIn[segmentI])
					if dropsIn[segmentI] != nil && !dropsIn[segmentI].IsEmpty() {
						drops = append(drops, dropsIn[segmentI])
					} else {
						drops = append(drops, nil)
					}
					thesauri = append(thesauri, thes)
					itrs = append(itrs, itr)
				}
			}
		}

		// if no iterators, skip this field
		if len(itrs) == 0 {
			continue
		}

		var prevTerm []byte

		newRoaring.Clear()

		finishTerm := func(term []byte) error {
			postingsOffset, err := writeSynonyms(newRoaring, w, bufMaxVarintLen64)
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
			return nil
		}

		enumerator, err := newEnumerator(itrs)

		for err == nil {
			term, itrI, postingsOffset := enumerator.Current()

			if prevTerm != nil && !bytes.Equal(prevTerm, term) {
				// check for the closure in meantime
				if isClosed(closeCh) {
					return nil, nil, seg.ErrClosed
				}

				// if the term changed, write out the info collected
				// for the previous term
				err = finishTerm(prevTerm)
				if err != nil {
					return nil, nil, err
				}
			}

			synonyms, err = thesauri[itrI].synonymsListFromOffset(
				postingsOffset, drops[itrI], synonyms)
			if err != nil {
				return nil, nil, err
			}
			synItr = synonyms.iterator(synItr)

			var next seg.Synonym
			next, err = synItr.Next()
			for next != nil && err == nil {
				synNewDocNum := newDocNums[itrI][next.Number()]
				if synNewDocNum == docDropped {
					return nil, nil, fmt.Errorf("see hit with dropped docNum")
				}
				nextTerm := next.Term()
				var synNewID uint32
				if synID, ok := termSynMap[nextTerm]; ok {
					synNewID = synID
				} else {
					synNewID = newSynonymID
					termSynMap[nextTerm] = newSynonymID
					synTermMap[newSynonymID] = nextTerm
					newSynonymID++
				}
				synNewCode := encodeSynonym(synNewID, uint32(synNewDocNum))
				newRoaring.Add(synNewCode)
				next, err = synItr.Next()
			}
			if err != nil {
				return nil, nil, err
			}

			prevTerm = prevTerm[:0] // copy to prevTerm in case Next() reuses term mem
			prevTerm = append(prevTerm, term...)
			err = enumerator.Next()
		}
		if err != vellum.ErrIteratorDone {
			return nil, nil, err
		}
		// close the enumerator to free the underlying iterators
		err = enumerator.Close()
		if err != nil {
			return nil, nil, err
		}

		if prevTerm != nil {
			err = finishTerm(prevTerm)
			if err != nil {
				return nil, nil, err
			}
		}

		err = newVellum.Close()
		if err != nil {
			return nil, nil, err
		}
		vellumData := vellumBuf.Bytes()

		thesOffset := uint64(w.Count())

		// write out the length of the vellum data
		n := binary.PutUvarint(bufMaxVarintLen64, uint64(len(vellumData)))
		_, err = w.Write(bufMaxVarintLen64[:n])
		if err != nil {
			return nil, nil, err
		}

		// write this vellum to disk
		_, err = w.Write(vellumData)
		if err != nil {
			return nil, nil, err
		}

		// reset vellum buffer and vellum builder
		vellumBuf.Reset()
		err = newVellum.Reset(&vellumBuf)
		if err != nil {
			return nil, nil, err
		}

		// write out the synTermMap for this thesaurus
		err = writeSynTermMap(synTermMap, w, bufMaxVarintLen64)
		if err != nil {
			return nil, nil, err
		}

		thesStart := w.Count()

		// the synonym index section does not have any doc value data
		// so we write two special entries to indicate that
		// the field is not uninverted and the thesaurus offset
		n = binary.PutUvarint(bufMaxVarintLen64, fieldNotUninverted)
		_, err = w.Write(bufMaxVarintLen64[:n])
		if err != nil {
			return nil, nil, err
		}

		n = binary.PutUvarint(bufMaxVarintLen64, fieldNotUninverted)
		_, err = w.Write(bufMaxVarintLen64[:n])
		if err != nil {
			return nil, nil, err
		}

		// write out the thesaurus offset from which the vellum data starts
		n = binary.PutUvarint(bufMaxVarintLen64, thesOffset)
		_, err = w.Write(bufMaxVarintLen64[:n])
		if err != nil {
			return nil, nil, err
		}

		// if we have a new thesaurus, add it to the thesaurus map
		fieldIDtoThesaurusID[uint16(fieldID)] = thesaurusID
		thesaurusAddrs[thesaurusID] = thesStart
		thesaurusID++
	}

	return thesaurusAddrs, fieldIDtoThesaurusID, nil
}
