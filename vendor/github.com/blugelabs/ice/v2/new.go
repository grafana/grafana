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
	"bytes"
	"encoding/binary"
	"math"
	"sort"
	"sync"

	"github.com/RoaringBitmap/roaring"
	"github.com/blevesearch/vellum"
	segment "github.com/blugelabs/bluge_segment_api"
)

var newSegmentBufferNumResultsBump = 100
var newSegmentBufferNumResultsFactor = 1.0
var newSegmentBufferAvgBytesPerDocFactor = 1.0

// New creates an in-memory implementation
// of a segment for the source documents
func New(results []segment.Document, normCalc func(string, int) float32) (
	segment.Segment, uint64, error) {
	return newWithChunkMode(results, normCalc, defaultChunkMode)
}

func newWithChunkMode(results []segment.Document, normCalc func(string, int) float32,
	chunkMode uint32) (segment.Segment, uint64, error) {
	s := interimPool.Get().(*interim)

	s.normCalc = normCalc

	var br bytes.Buffer
	if s.lastNumDocs > 0 {
		// use previous results to initialize the buf with an estimate
		// size, but note that the interim instance comes from a
		// global interimPool, so multiple index instances indexing
		// different docs can lead to low quality estimates
		estimateAvgBytesPerDoc := int(float64(s.lastOutSize/s.lastNumDocs) *
			newSegmentBufferNumResultsFactor)
		estimateNumResults := int(float64(len(results)+newSegmentBufferNumResultsBump) *
			newSegmentBufferAvgBytesPerDocFactor)
		br.Grow(estimateAvgBytesPerDoc * estimateNumResults)
	}

	s.results = results
	s.chunkMode = chunkMode
	s.w = newCountHashWriter(&br)

	var footer *footer
	footer, dictOffsets, storedFieldChunkOffsets, err := s.convert()
	if err != nil {
		return nil, uint64(0), err
	}
	footer.crc = s.w.Sum32()
	footer.chunkMode = chunkMode
	footer.numDocs = uint64(len(results))

	sb, err := initSegmentBase(br.Bytes(), footer,
		s.FieldsMap, s.FieldsInv,
		s.FieldDocs, s.FieldFreqs,
		dictOffsets, storedFieldChunkOffsets)

	if err == nil && s.reset() == nil {
		s.lastNumDocs = len(results)
		s.lastOutSize = len(br.Bytes())
		interimPool.Put(s)
	}

	return sb, uint64(len(br.Bytes())), err
}

func initSegmentBase(mem []byte, footer *footer,
	fieldsMap map[string]uint16, fieldsInv []string,
	fieldsDocs, fieldsFreqs map[uint16]uint64,
	dictLocs []uint64, storedFieldChunkOffsets []uint64) (*Segment, error) {
	sb := &Segment{
		data:                    segment.NewDataBytes(mem),
		footer:                  footer,
		fieldsMap:               fieldsMap,
		fieldsInv:               fieldsInv,
		fieldDocs:               fieldsDocs,
		fieldFreqs:              fieldsFreqs,
		dictLocs:                dictLocs,
		fieldDvReaders:          make(map[uint16]*docValueReader),
		fieldFSTs:               make(map[uint16]*vellum.FST),
		storedFieldChunkOffsets: storedFieldChunkOffsets,
	}
	sb.updateSize()

	err := sb.loadDvReaders()
	if err != nil {
		return nil, err
	}

	return sb, nil
}

var interimPool = sync.Pool{New: func() interface{} { return &interim{} }}

// interim holds temporary working data used while converting from
// the source operations to an encoded segment
type interim struct {
	results []segment.Document

	chunkMode uint32

	w *countHashWriter

	// FieldsMap adds 1 to field id to avoid zero value issues
	//  name -> field id + 1
	FieldsMap map[string]uint16

	// FieldsInv is the inverse of FieldsMap
	//  field id -> name
	FieldsInv []string

	// FieldDocs tracks how many documents have at least one value
	// for each field
	FieldDocs map[uint16]uint64

	// FieldFreqs tracks how many total tokens there are in a field
	// across all documents
	FieldFreqs map[uint16]uint64

	// Term dictionaries for each field
	//  field id -> term -> postings list id + 1
	Dicts []map[string]uint64

	// Terms for each field, where terms are sorted ascending
	//  field id -> []term
	DictKeys [][]string

	// Fields whose IncludeDocValues is true
	//  field id -> bool
	IncludeDocValues []bool

	// postings id -> bitmap of docNums
	Postings []*roaring.Bitmap

	// postings id -> freq/norm's, one for each docNum in postings
	FreqNorms        [][]interimFreqNorm
	freqNormsBacking []interimFreqNorm

	// postings id -> locs, one for each freq
	Locs        [][]interimLoc
	locsBacking []interimLoc

	numTermsPerPostingsList []int // key is postings list id
	numLocsPerPostingsList  []int // key is postings list id

	builder    *vellum.Builder
	builderBuf bytes.Buffer

	metaBuf bytes.Buffer

	tmp0 []byte
	tmp1 []byte

	lastNumDocs int
	lastOutSize int

	normCalc func(string, int) float32
}

func (s *interim) reset() (err error) {
	s.results = nil
	s.chunkMode = 0
	s.w = nil
	s.FieldsMap = nil
	s.FieldsInv = nil
	for i := range s.Dicts {
		s.Dicts[i] = nil
	}
	s.Dicts = s.Dicts[:0]
	for i := range s.DictKeys {
		s.DictKeys[i] = s.DictKeys[i][:0]
	}
	s.DictKeys = s.DictKeys[:0]
	for i := range s.IncludeDocValues {
		s.IncludeDocValues[i] = false
	}
	s.IncludeDocValues = s.IncludeDocValues[:0]
	for _, idn := range s.Postings {
		idn.Clear()
	}
	s.Postings = s.Postings[:0]
	s.FreqNorms = s.FreqNorms[:0]
	for i := range s.freqNormsBacking {
		s.freqNormsBacking[i] = interimFreqNorm{}
	}
	s.freqNormsBacking = s.freqNormsBacking[:0]
	s.Locs = s.Locs[:0]
	for i := range s.locsBacking {
		s.locsBacking[i] = interimLoc{}
	}
	s.locsBacking = s.locsBacking[:0]
	s.numTermsPerPostingsList = s.numTermsPerPostingsList[:0]
	s.numLocsPerPostingsList = s.numLocsPerPostingsList[:0]
	s.builderBuf.Reset()
	if s.builder != nil {
		err = s.builder.Reset(&s.builderBuf)
	}
	s.metaBuf.Reset()
	s.tmp0 = s.tmp0[:0]
	s.tmp1 = s.tmp1[:0]
	s.lastNumDocs = 0
	s.lastOutSize = 0

	return err
}

func (s *interim) grabBuf(size int) []byte {
	buf := s.tmp0
	if cap(buf) < size {
		buf = make([]byte, size)
		s.tmp0 = buf
	}
	return buf[0:size]
}

type interimStoredField struct {
	vals [][]byte
}

type interimFreqNorm struct {
	freq    uint64
	norm    float32
	numLocs int
}

type interimLoc struct {
	fieldID uint16
	pos     uint64
	start   uint64
	end     uint64
}

func (s *interim) convert() (f *footer, dictOffsets, storedFieldChunkOffsets []uint64, err error) {
	s.FieldsMap = map[string]uint16{}
	s.FieldDocs = map[uint16]uint64{}
	s.FieldFreqs = map[uint16]uint64{}

	// FIXME review if this is still necessary
	// YES, integration tests fail when removed
	s.getOrDefineField(_idFieldName) // _id field is fieldID 0

	for _, result := range s.results {
		result.EachField(func(field segment.Field) {
			s.getOrDefineField(field.Name())
		})
	}

	sort.Strings(s.FieldsInv[1:]) // keep _id as first field

	for fieldID, fieldName := range s.FieldsInv {
		s.FieldsMap[fieldName] = uint16(fieldID + 1)
	}

	if cap(s.IncludeDocValues) >= len(s.FieldsInv) {
		s.IncludeDocValues = s.IncludeDocValues[:len(s.FieldsInv)]
	} else {
		s.IncludeDocValues = make([]bool, len(s.FieldsInv))
	}

	s.prepareDicts()

	for _, dict := range s.DictKeys {
		sort.Strings(dict)
	}

	s.processDocuments()

	var storedIndexOffset uint64
	storedIndexOffset, storedFieldChunkOffsets, err = s.writeStoredFields()
	if err != nil {
		return nil, nil, nil, err
	}

	var fdvIndexOffset uint64

	if len(s.results) > 0 {
		fdvIndexOffset, dictOffsets, err = s.writeDicts()
		if err != nil {
			return nil, nil, nil, err
		}
	} else {
		dictOffsets = make([]uint64, len(s.FieldsInv))
	}

	fieldsIndexOffset, err := persistFields(s.FieldsInv, s.FieldDocs, s.FieldFreqs, s.w, dictOffsets)
	if err != nil {
		return nil, nil, nil, err
	}

	return &footer{
		storedIndexOffset: storedIndexOffset,
		fieldsIndexOffset: fieldsIndexOffset,
		docValueOffset:    fdvIndexOffset,
		version:           Version,
	}, dictOffsets, storedFieldChunkOffsets, nil
}

func (s *interim) getOrDefineField(fieldName string) int {
	fieldIDPlus1, exists := s.FieldsMap[fieldName]
	if !exists {
		fieldIDPlus1 = uint16(len(s.FieldsInv) + 1)
		s.FieldsMap[fieldName] = fieldIDPlus1
		s.FieldsInv = append(s.FieldsInv, fieldName)

		s.Dicts = append(s.Dicts, make(map[string]uint64))

		n := len(s.DictKeys)
		if n < cap(s.DictKeys) {
			s.DictKeys = s.DictKeys[:n+1]
			s.DictKeys[n] = s.DictKeys[n][:0]
		} else {
			s.DictKeys = append(s.DictKeys, []string(nil))
		}
	}

	return int(fieldIDPlus1 - 1)
}

// fill Dicts and DictKeys from analysis results
func (s *interim) prepareDicts() {
	var pidNext int

	var totTFs int
	var totLocs int

	for _, result := range s.results {
		pidNext, totLocs, totTFs = s.prepareDictsForDocument(result, pidNext, totLocs, totTFs)
	}

	numPostingsLists := pidNext

	if cap(s.Postings) >= numPostingsLists {
		s.Postings = s.Postings[:numPostingsLists]
	} else {
		postings := make([]*roaring.Bitmap, numPostingsLists)
		copy(postings, s.Postings[:cap(s.Postings)])
		for i := 0; i < numPostingsLists; i++ {
			if postings[i] == nil {
				postings[i] = roaring.New()
			}
		}
		s.Postings = postings
	}

	if cap(s.FreqNorms) >= numPostingsLists {
		s.FreqNorms = s.FreqNorms[:numPostingsLists]
	} else {
		s.FreqNorms = make([][]interimFreqNorm, numPostingsLists)
	}

	if cap(s.freqNormsBacking) >= totTFs {
		s.freqNormsBacking = s.freqNormsBacking[:totTFs]
	} else {
		s.freqNormsBacking = make([]interimFreqNorm, totTFs)
	}

	freqNormsBacking := s.freqNormsBacking
	for pid, numTerms := range s.numTermsPerPostingsList {
		s.FreqNorms[pid] = freqNormsBacking[0:0]
		freqNormsBacking = freqNormsBacking[numTerms:]
	}

	if cap(s.Locs) >= numPostingsLists {
		s.Locs = s.Locs[:numPostingsLists]
	} else {
		s.Locs = make([][]interimLoc, numPostingsLists)
	}

	if cap(s.locsBacking) >= totLocs {
		s.locsBacking = s.locsBacking[:totLocs]
	} else {
		s.locsBacking = make([]interimLoc, totLocs)
	}

	locsBacking := s.locsBacking
	for pid, numLocs := range s.numLocsPerPostingsList {
		s.Locs[pid] = locsBacking[0:0]
		locsBacking = locsBacking[numLocs:]
	}
}

func (s *interim) prepareDictsForDocument(result segment.Document, pidNext, totLocs, totTFs int) (
	pidNextOut, totLocsOut, totTFsOut int) {
	fieldsSeen := map[uint16]struct{}{}
	result.EachField(func(field segment.Field) {
		fieldID := uint16(s.getOrDefineField(field.Name()))

		fieldsSeen[fieldID] = struct{}{}
		s.FieldFreqs[fieldID] += uint64(field.Length())

		dict := s.Dicts[fieldID]
		dictKeys := s.DictKeys[fieldID]

		var numTerms int
		field.EachTerm(func(term segment.FieldTerm) {
			numTerms++
			termStr := string(term.Term())
			pidPlus1, exists := dict[termStr]
			if !exists {
				pidNext++
				pidPlus1 = uint64(pidNext)

				dict[termStr] = pidPlus1
				dictKeys = append(dictKeys, termStr)

				s.numTermsPerPostingsList = append(s.numTermsPerPostingsList, 0)
				s.numLocsPerPostingsList = append(s.numLocsPerPostingsList, 0)
			}

			pid := pidPlus1 - 1

			s.numTermsPerPostingsList[pid]++

			var numLocations int
			term.EachLocation(func(_ segment.Location) {
				numLocations++
			})
			s.numLocsPerPostingsList[pid] += numLocations

			totLocs += numLocations
		})

		totTFs += numTerms

		s.DictKeys[fieldID] = dictKeys
	})
	// record fields seen by this doc
	for k := range fieldsSeen {
		s.FieldDocs[k]++
	}
	return pidNext, totLocs, totTFs
}

func (s *interim) processDocuments() {
	numFields := len(s.FieldsInv)
	reuseFieldLens := make([]int, numFields)
	reuseFieldTFs := make([]tokenFrequencies, numFields)

	for docNum, result := range s.results {
		for i := 0; i < numFields; i++ { // clear these for reuse
			reuseFieldLens[i] = 0
			reuseFieldTFs[i] = nil
		}

		s.processDocument(uint64(docNum), result,
			reuseFieldLens, reuseFieldTFs)
	}
}

func (s *interim) processDocument(docNum uint64,
	result segment.Document,
	fieldLens []int, fieldTFs []tokenFrequencies) {
	visitField := func(field segment.Field) {
		fieldID := uint16(s.getOrDefineField(field.Name()))
		fieldLens[fieldID] += field.Length()

		if existingFreqs := fieldTFs[fieldID]; existingFreqs == nil {
			fieldTFs[fieldID] = make(map[string]*tokenFreq)
		}

		existingFreqs := fieldTFs[fieldID]
		field.EachTerm(func(term segment.FieldTerm) {
			tfk := string(term.Term())
			existingTf, exists := existingFreqs[tfk]
			if exists {
				term.EachLocation(func(location segment.Location) {
					existingTf.Locations = append(existingTf.Locations,
						&tokenLocation{
							FieldVal:    field.Name(),
							StartVal:    location.Start(),
							EndVal:      location.End(),
							PositionVal: location.Pos(),
						})
				})
				existingTf.frequency += term.Frequency()
			} else {
				newTf := &tokenFreq{
					TermVal:   term.Term(),
					frequency: term.Frequency(),
				}
				term.EachLocation(func(location segment.Location) {
					newTf.Locations = append(newTf.Locations,
						&tokenLocation{
							FieldVal:    location.Field(),
							StartVal:    location.Start(),
							EndVal:      location.End(),
							PositionVal: location.Pos(),
						})
				})
				existingFreqs[tfk] = newTf
			}
		})
	}

	result.EachField(visitField)

	// now that it's been rolled up into fieldTFs, walk that
	for fieldID, tfs := range fieldTFs {
		dict := s.Dicts[fieldID]
		norm := s.normCalc(s.FieldsInv[fieldID], fieldLens[fieldID])

		for term, tf := range tfs {
			pid := dict[term] - 1
			bs := s.Postings[pid]
			bs.Add(uint32(docNum))

			s.FreqNorms[pid] = append(s.FreqNorms[pid],
				interimFreqNorm{
					freq:    uint64(tf.Frequency()),
					norm:    norm,
					numLocs: len(tf.Locations),
				})

			if len(tf.Locations) > 0 {
				locs := s.Locs[pid]

				for _, loc := range tf.Locations {
					var locf = uint16(fieldID)
					if loc.FieldVal != "" {
						locf = uint16(s.getOrDefineField(loc.FieldVal))
					}
					locs = append(locs, interimLoc{
						fieldID: locf,
						pos:     uint64(loc.PositionVal),
						start:   uint64(loc.StartVal),
						end:     uint64(loc.EndVal),
					})
				}

				s.Locs[pid] = locs
			}
		}
	}
}

func (s *interim) writeStoredFields() (
	storedIndexOffset uint64, storedFieldChunkOffsets []uint64, err error) {
	varBuf := make([]byte, binary.MaxVarintLen64)
	metaEncode := func(val uint64) (int, error) {
		wb := binary.PutUvarint(varBuf, val)
		return s.metaBuf.Write(varBuf[:wb])
	}

	data, compressed := s.tmp0[:0], s.tmp1[:0]
	defer func() { s.tmp0, s.tmp1 = data, compressed }()

	// keyed by docNum
	docStoredOffsets := make([]uint64, len(s.results))

	// keyed by fieldID, for the current doc in the loop
	docStoredFields := map[uint16]interimStoredField{}

	// document chunk coder
	docChunkCoder := newChunkedDocumentCoder(uint64(defaultDocumentChunkSize), s.w)

	for docNum, result := range s.results {
		for fieldID := range docStoredFields { // reset for next doc
			delete(docStoredFields, fieldID)
		}

		result.EachField(func(field segment.Field) {
			fieldID := uint16(s.getOrDefineField(field.Name()))

			if field.Store() {
				isf := docStoredFields[fieldID]
				isf.vals = append(isf.vals, field.Value())
				docStoredFields[fieldID] = isf
			}

			if field.IndexDocValues() {
				s.IncludeDocValues[fieldID] = true
			}
		})

		var curr int

		s.metaBuf.Reset()
		data = data[:0]

		// handle fields
		for fieldID := 0; fieldID < len(s.FieldsInv); fieldID++ {
			isf, exists := docStoredFields[uint16(fieldID)]
			if exists {
				curr, data, err = encodeStoredFieldValues(
					fieldID, isf.vals,
					curr, metaEncode, data)
				if err != nil {
					return 0, nil, err
				}
			}
		}

		metaBytes := s.metaBuf.Bytes()
		docStoredOffsets[docNum] = docChunkCoder.Size()
		_, err = docChunkCoder.Add(uint64(docNum), metaBytes, data)
		if err != nil {
			return 0, nil, err
		}
	}

	// document chunk coder
	err = docChunkCoder.Write()
	if err != nil {
		return 0, nil, err
	}
	storedFieldChunkOffsets = docChunkCoder.Offsets()

	storedIndexOffset = uint64(s.w.Count())

	for _, docStoredOffset := range docStoredOffsets {
		err = binary.Write(s.w, binary.BigEndian, docStoredOffset)
		if err != nil {
			return 0, nil, err
		}
	}

	return storedIndexOffset, storedFieldChunkOffsets, nil
}

func (s *interim) writeDicts() (fdvIndexOffset uint64, dictOffsets []uint64, err error) {
	dictOffsets = make([]uint64, len(s.FieldsInv))

	fdvOffsetsStart := make([]uint64, len(s.FieldsInv))
	fdvOffsetsEnd := make([]uint64, len(s.FieldsInv))

	buf := s.grabBuf(binary.MaxVarintLen64)

	// these int coders are initialized with chunk size 1024
	// however this will be reset to the correct chunk size
	// while processing each individual field-term section
	tfEncoder := newChunkedIntCoder(uint64(legacyChunkMode), uint64(len(s.results)-1))
	locEncoder := newChunkedIntCoder(uint64(legacyChunkMode), uint64(len(s.results)-1))

	var docTermMap [][]byte

	if s.builder == nil {
		s.builder, err = vellum.New(&s.builderBuf, nil)
		if err != nil {
			return 0, nil, err
		}
	}

	for fieldID, terms := range s.DictKeys {
		err2 := s.writeDictsField(docTermMap, fieldID, terms, tfEncoder, locEncoder, buf, dictOffsets, fdvOffsetsStart, fdvOffsetsEnd)
		if err2 != nil {
			return 0, nil, err2
		}
	}

	fdvIndexOffset = uint64(s.w.Count())

	for i := 0; i < len(fdvOffsetsStart); i++ {
		n := binary.PutUvarint(buf, fdvOffsetsStart[i])
		_, err := s.w.Write(buf[:n])
		if err != nil {
			return 0, nil, err
		}
		n = binary.PutUvarint(buf, fdvOffsetsEnd[i])
		_, err = s.w.Write(buf[:n])
		if err != nil {
			return 0, nil, err
		}
	}

	return fdvIndexOffset, dictOffsets, nil
}

func (s *interim) writeDictsField(docTermMap [][]byte, fieldID int, terms []string, tfEncoder,
	locEncoder *chunkedIntCoder, buf []byte, dictOffsets, fdvOffsetsStart, fdvOffsetsEnd []uint64) error {
	if cap(docTermMap) < len(s.results) {
		docTermMap = make([][]byte, len(s.results))
	} else {
		docTermMap = docTermMap[0:len(s.results)]
		for docNum := range docTermMap { // reset the docTermMap
			docTermMap[docNum] = docTermMap[docNum][:0]
		}
	}

	dict := s.Dicts[fieldID]

	for _, term := range terms { // terms are already sorted
		err2 := s.writeDictsTermField(docTermMap, dict, term, tfEncoder, locEncoder, buf)
		if err2 != nil {
			return err2
		}
	}

	err := s.builder.Close()
	if err != nil {
		return err
	}

	// record where this dictionary starts
	dictOffsets[fieldID] = uint64(s.w.Count())

	vellumData := s.builderBuf.Bytes()

	// write out the length of the vellum data
	n := binary.PutUvarint(buf, uint64(len(vellumData)))
	_, err = s.w.Write(buf[:n])
	if err != nil {
		return err
	}

	// write this vellum to disk
	_, err = s.w.Write(vellumData)
	if err != nil {
		return err
	}

	// reset vellum for reuse
	s.builderBuf.Reset()

	err = s.builder.Reset(&s.builderBuf)
	if err != nil {
		return err
	}

	// write the field doc values
	// NOTE: doc values continue to use legacy chunk mode
	chunkSize, err := getChunkSize(legacyChunkMode, 0, 0)
	if err != nil {
		return err
	}
	fdvEncoder := newChunkedContentCoder(chunkSize, uint64(len(s.results)-1), s.w, false)
	if s.IncludeDocValues[fieldID] {
		for docNum, docTerms := range docTermMap {
			if len(docTerms) > 0 {
				err = fdvEncoder.Add(uint64(docNum), docTerms)
				if err != nil {
					return err
				}
			}
		}
		err = fdvEncoder.Close()
		if err != nil {
			return err
		}

		fdvOffsetsStart[fieldID] = uint64(s.w.Count())

		_, err = fdvEncoder.Write()
		if err != nil {
			return err
		}

		fdvOffsetsEnd[fieldID] = uint64(s.w.Count())

		fdvEncoder.Reset()
	} else {
		fdvOffsetsStart[fieldID] = fieldNotUninverted
		fdvOffsetsEnd[fieldID] = fieldNotUninverted
	}
	return nil
}

func (s *interim) writeDictsTermField(docTermMap [][]byte, dict map[string]uint64, term string, tfEncoder,
	locEncoder *chunkedIntCoder, buf []byte) error {
	pid := dict[term] - 1

	postingsBS := s.Postings[pid]

	freqNorms := s.FreqNorms[pid]
	freqNormOffset := 0

	locs := s.Locs[pid]
	locOffset := 0

	chunkSize, err := getChunkSize(s.chunkMode, postingsBS.GetCardinality(), uint64(len(s.results)))
	if err != nil {
		return err
	}
	tfEncoder.SetChunkSize(chunkSize, uint64(len(s.results)-1))
	locEncoder.SetChunkSize(chunkSize, uint64(len(s.results)-1))

	postingsItr := postingsBS.Iterator()
	for postingsItr.HasNext() {
		docNum := uint64(postingsItr.Next())

		freqNorm := freqNorms[freqNormOffset]

		err = tfEncoder.Add(docNum,
			encodeFreqHasLocs(freqNorm.freq, freqNorm.numLocs > 0),
			uint64(math.Float32bits(freqNorm.norm)))
		if err != nil {
			return err
		}

		if freqNorm.numLocs > 0 {
			numBytesLocs := 0
			for _, loc := range locs[locOffset : locOffset+freqNorm.numLocs] {
				numBytesLocs += totalUvarintBytes(
					uint64(loc.fieldID), loc.pos, loc.start, loc.end)
			}

			err = locEncoder.Add(docNum, uint64(numBytesLocs))
			if err != nil {
				return err
			}

			for _, loc := range locs[locOffset : locOffset+freqNorm.numLocs] {
				err = locEncoder.Add(docNum,
					uint64(loc.fieldID), loc.pos, loc.start, loc.end)
				if err != nil {
					return err
				}
			}

			locOffset += freqNorm.numLocs
		}

		freqNormOffset++

		docTermMap[docNum] = append(
			append(docTermMap[docNum], term...),
			termSeparator)
	}

	tfEncoder.Close()
	locEncoder.Close()

	var postingsOffset uint64
	postingsOffset, err =
		writePostings(postingsBS, tfEncoder, locEncoder, nil, s.w, buf)
	if err != nil {
		return err
	}

	if postingsOffset > uint64(0) {
		err = s.builder.Insert([]byte(term), postingsOffset)
		if err != nil {
			return err
		}
	}

	tfEncoder.Reset()
	locEncoder.Reset()
	return nil
}
