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
	"reflect"

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/RoaringBitmap/roaring/v2/roaring64"
	segment "github.com/blevesearch/scorch_segment_api/v2"
)

var reflectStaticSizeSynonymsList int
var reflectStaticSizeSynonymsIterator int
var reflectStaticSizeSynonym int

func init() {
	var sl SynonymsList
	reflectStaticSizeSynonymsList = int(reflect.TypeOf(sl).Size())
	var si SynonymsIterator
	reflectStaticSizeSynonymsIterator = int(reflect.TypeOf(si).Size())
	var s Synonym
	reflectStaticSizeSynonym = int(reflect.TypeOf(s).Size())
}

// SynonymsList represents a list of synonyms for a term, stored in a Roaring64 bitmap.
type SynonymsList struct {
	sb             *SegmentBase
	synonymsOffset uint64
	synonyms       *roaring64.Bitmap
	except         *roaring.Bitmap

	synIDTermMap map[uint32][]byte

	buffer *bytes.Reader
}

// immutable, empty synonyms list
var emptySynonymsList = &SynonymsList{}

func (p *SynonymsList) Size() int {
	sizeInBytes := reflectStaticSizeSynonymsList + SizeOfPtr

	if p.except != nil {
		sizeInBytes += int(p.except.GetSizeInBytes())
	}

	return sizeInBytes
}

// Iterator creates and returns a SynonymsIterator for the SynonymsList.
// If the synonyms bitmap is nil, it returns an empty iterator.
func (s *SynonymsList) Iterator(prealloc segment.SynonymsIterator) segment.SynonymsIterator {
	if s.synonyms == nil {
		return emptySynonymsIterator
	}

	var preallocSI *SynonymsIterator
	pi, ok := prealloc.(*SynonymsIterator)
	if ok && pi != nil {
		preallocSI = pi
	}
	if preallocSI == emptySynonymsIterator {
		preallocSI = nil
	}

	return s.iterator(preallocSI)
}

// iterator initializes a SynonymsIterator for the SynonymsList and returns it.
// If a preallocated iterator is provided, it resets and reuses it; otherwise, it creates a new one.
func (s *SynonymsList) iterator(rv *SynonymsIterator) *SynonymsIterator {
	if rv == nil {
		rv = &SynonymsIterator{}
	} else {
		*rv = SynonymsIterator{} // clear the struct
	}
	rv.synonyms = s
	rv.except = s.except
	rv.Actual = s.synonyms.Iterator()
	rv.ActualBM = s.synonyms
	rv.synIDTermMap = s.synIDTermMap
	return rv
}

// read initializes a SynonymsList by reading data from the given synonymsOffset in the Thesaurus.
// It reads and parses the Roaring64 bitmap that represents the synonyms.
func (rv *SynonymsList) read(synonymsOffset uint64, t *Thesaurus) error {
	rv.synonymsOffset = synonymsOffset

	var n uint64
	var read int

	var synonymsLen uint64
	synonymsLen, read = binary.Uvarint(t.sb.mem[synonymsOffset+n : synonymsOffset+n+binary.MaxVarintLen64])
	n += uint64(read)

	roaringBytes := t.sb.mem[synonymsOffset+n : synonymsOffset+n+synonymsLen]

	if rv.synonyms == nil {
		rv.synonyms = roaring64.NewBitmap()
	}

	rv.buffer.Reset(roaringBytes)

	_, err := rv.synonyms.ReadFrom(rv.buffer)
	if err != nil {
		return fmt.Errorf("error loading roaring bitmap: %v", err)
	}

	return nil
}

// -----------------------------------------------------------------------------

// SynonymsIterator provides a way to iterate through the synonyms list.
type SynonymsIterator struct {
	synonyms *SynonymsList
	except   *roaring.Bitmap

	Actual   roaring64.IntPeekable64
	ActualBM *roaring64.Bitmap

	synIDTermMap map[uint32][]byte
	nextSyn      Synonym
}

// immutable, empty synonyms iterator
var emptySynonymsIterator = &SynonymsIterator{}

func (i *SynonymsIterator) Size() int {
	sizeInBytes := reflectStaticSizeSynonymsIterator + SizeOfPtr +
		i.nextSyn.Size()

	return sizeInBytes
}

// Next returns the next Synonym in the iteration or an error if the end is reached.
func (i *SynonymsIterator) Next() (segment.Synonym, error) {
	return i.next()
}

// next retrieves the next synonym from the iterator, populates the nextSyn field,
// and returns it. If no valid synonym is found, it returns an error.
func (i *SynonymsIterator) next() (segment.Synonym, error) {
	synID, docNum, exists, err := i.nextSynonym()
	if err != nil || !exists {
		return nil, err
	}

	if i.synIDTermMap == nil {
		return nil, fmt.Errorf("synIDTermMap is nil")
	}

	// If the synonymID is not found in the map, return an error
	term, exists := i.synIDTermMap[synID]
	if !exists {
		return nil, fmt.Errorf("synonymID %d not found in map", synID)
	}

	i.nextSyn = Synonym{} // clear the struct
	rv := &i.nextSyn
	rv.term = string(term)
	rv.docNum = docNum

	return rv, nil
}

// nextSynonym decodes the next synonym from the roaring bitmap iterator,
// ensuring it is not in the "except" set. Returns the synonymID, docNum,
// and a flag indicating success.
func (i *SynonymsIterator) nextSynonym() (uint32, uint32, bool, error) {
	// If no synonyms are available, return early
	if i.Actual == nil || i.synonyms == nil || i.synonyms == emptySynonymsList {
		return 0, 0, false, nil
	}

	var code uint64
	var docNum uint32
	var synID uint32

	// Loop to find the next valid docNum, checking against the except
	for i.Actual.HasNext() {
		code = i.Actual.Next()
		synID, docNum = decodeSynonym(code)

		// If docNum is not in the 'except' set, it's a valid result
		if i.except == nil || !i.except.Contains(docNum) {
			return synID, docNum, true, nil
		}
	}

	// If no valid docNum is found, return false
	return 0, 0, false, nil
}

// Synonym represents a single synonym, containing the term, synonymID, and document number.
type Synonym struct {
	term   string
	docNum uint32
}

// Size returns the memory size of the Synonym, including the length of the term string.
func (p *Synonym) Size() int {
	sizeInBytes := reflectStaticSizeSynonym + SizeOfPtr +
		len(p.term)

	return sizeInBytes
}

// Term returns the term of the Synonym.
func (s *Synonym) Term() string {
	return s.term
}

// Number returns the document number of the Synonym.
func (s *Synonym) Number() uint32 {
	return s.docNum
}

// decodeSynonym decodes a synonymCode into its synonymID and document ID components.
func decodeSynonym(synonymCode uint64) (synonymID uint32, docID uint32) {
	return uint32(synonymCode >> 32), uint32(synonymCode)
}
