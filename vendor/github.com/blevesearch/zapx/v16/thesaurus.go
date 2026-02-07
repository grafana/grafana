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
	"fmt"

	"github.com/RoaringBitmap/roaring/v2"
	index "github.com/blevesearch/bleve_index_api"
	segment "github.com/blevesearch/scorch_segment_api/v2"
	"github.com/blevesearch/vellum"
)

// Thesaurus is the zap representation of a Thesaurus
type Thesaurus struct {
	sb           *SegmentBase
	name         string
	fieldID      uint16
	synIDTermMap map[uint32][]byte
	fst          *vellum.FST

	fstReader *vellum.Reader
}

// represents an immutable, empty Thesaurus
var emptyThesaurus = &Thesaurus{}

// SynonymsList returns the synonyms list for the specified term
func (t *Thesaurus) SynonymsList(term []byte, except *roaring.Bitmap, prealloc segment.SynonymsList) (segment.SynonymsList, error) {
	var preallocSL *SynonymsList
	sl, ok := prealloc.(*SynonymsList)
	if ok && sl != nil {
		preallocSL = sl
	}
	return t.synonymsList(term, except, preallocSL)
}

func (t *Thesaurus) synonymsList(term []byte, except *roaring.Bitmap, rv *SynonymsList) (*SynonymsList, error) {
	if t.fstReader == nil {
		if rv == nil || rv == emptySynonymsList {
			return emptySynonymsList, nil
		}
		return t.synonymsListInit(rv, except), nil
	}

	synonymsOffset, exists, err := t.fstReader.Get(term)

	if err != nil {
		return nil, fmt.Errorf("vellum err: %v", err)
	}
	if !exists {
		if rv == nil || rv == emptySynonymsList {
			return emptySynonymsList, nil
		}
		return t.synonymsListInit(rv, except), nil
	}

	return t.synonymsListFromOffset(synonymsOffset, except, rv)
}

func (t *Thesaurus) synonymsListFromOffset(synonymsOffset uint64, except *roaring.Bitmap, rv *SynonymsList) (*SynonymsList, error) {
	rv = t.synonymsListInit(rv, except)

	err := rv.read(synonymsOffset, t)
	if err != nil {
		return nil, err
	}

	return rv, nil
}

func (t *Thesaurus) synonymsListInit(rv *SynonymsList, except *roaring.Bitmap) *SynonymsList {
	if rv == nil || rv == emptySynonymsList {
		rv = &SynonymsList{}
		rv.buffer = bytes.NewReader(nil)
	} else {
		synonyms := rv.synonyms
		buf := rv.buffer
		if synonyms != nil {
			synonyms.Clear()
		}
		if buf != nil {
			buf.Reset(nil)
		}

		*rv = SynonymsList{} // clear the struct

		rv.synonyms = synonyms
		rv.buffer = buf
	}
	rv.sb = t.sb
	rv.except = except
	rv.synIDTermMap = t.synIDTermMap
	return rv
}

func (t *Thesaurus) Contains(key []byte) (bool, error) {
	if t.fst != nil {
		return t.fst.Contains(key)
	}
	return false, nil
}

// AutomatonIterator returns an iterator which only visits terms
// having the the vellum automaton and start/end key range
func (t *Thesaurus) AutomatonIterator(a segment.Automaton,
	startKeyInclusive, endKeyExclusive []byte) segment.ThesaurusIterator {
	if t.fst != nil {
		rv := &ThesaurusIterator{
			t: t,
		}

		itr, err := t.fst.Search(a, startKeyInclusive, endKeyExclusive)
		if err == nil {
			rv.itr = itr
		} else if err != vellum.ErrIteratorDone {
			rv.err = err
		}

		return rv
	}
	return emptyThesaurusIterator
}

var emptyThesaurusIterator = &ThesaurusIterator{}

// ThesaurusIterator is an iterator for term dictionary
type ThesaurusIterator struct {
	t     *Thesaurus
	itr   vellum.Iterator
	err   error
	entry index.ThesaurusEntry
}

// Next returns the next entry in the dictionary
func (i *ThesaurusIterator) Next() (*index.ThesaurusEntry, error) {
	if i.err != nil && i.err != vellum.ErrIteratorDone {
		return nil, i.err
	} else if i.itr == nil || i.err == vellum.ErrIteratorDone {
		return nil, nil
	}
	term, _ := i.itr.Current()
	i.entry.Term = string(term)
	i.err = i.itr.Next()
	return &i.entry, nil
}
