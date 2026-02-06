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
	"fmt"

	"github.com/RoaringBitmap/roaring/v2"
	index "github.com/blevesearch/bleve_index_api"
	segment "github.com/blevesearch/scorch_segment_api/v2"
	"github.com/blevesearch/vellum"
)

// Dictionary is the zap representation of the term dictionary
type Dictionary struct {
	sb        *SegmentBase
	field     string
	fieldID   uint16
	fst       *vellum.FST
	fstReader *vellum.Reader

	bytesRead uint64
}

// represents an immutable, empty dictionary
var emptyDictionary = &Dictionary{}

// PostingsList returns the postings list for the specified term
func (d *Dictionary) PostingsList(term []byte, except *roaring.Bitmap,
	prealloc segment.PostingsList) (segment.PostingsList, error) {
	var preallocPL *PostingsList
	pl, ok := prealloc.(*PostingsList)
	if ok && pl != nil {
		preallocPL = pl
	}
	return d.postingsList(term, except, preallocPL)
}

func (d *Dictionary) Cardinality() int {
	if d.fst != nil {
		return d.fst.Len()
	}
	return 0
}

func (d *Dictionary) postingsList(term []byte, except *roaring.Bitmap, rv *PostingsList) (*PostingsList, error) {
	if d.fstReader == nil {
		if rv == nil || rv == emptyPostingsList {
			return emptyPostingsList, nil
		}
		return d.postingsListInit(rv, except), nil
	}

	postingsOffset, exists, err := d.fstReader.Get(term)
	if err != nil {
		return nil, fmt.Errorf("vellum err: %v", err)
	}
	if !exists {
		if rv == nil || rv == emptyPostingsList {
			return emptyPostingsList, nil
		}
		return d.postingsListInit(rv, except), nil
	}

	return d.postingsListFromOffset(postingsOffset, except, rv)
}

func (d *Dictionary) postingsListFromOffset(postingsOffset uint64, except *roaring.Bitmap, rv *PostingsList) (*PostingsList, error) {
	rv = d.postingsListInit(rv, except)

	err := rv.read(postingsOffset, d)
	if err != nil {
		return nil, err
	}

	return rv, nil
}

func (d *Dictionary) postingsListInit(rv *PostingsList, except *roaring.Bitmap) *PostingsList {
	if rv == nil || rv == emptyPostingsList {
		rv = &PostingsList{}
	} else {
		postings := rv.postings
		if postings != nil {
			postings.Clear()
		}

		*rv = PostingsList{} // clear the struct

		rv.postings = postings
	}
	rv.sb = d.sb
	rv.except = except
	return rv
}

func (d *Dictionary) Contains(key []byte) (bool, error) {
	if d.fst != nil {
		return d.fst.Contains(key)
	}
	return false, nil
}

// AutomatonIterator returns an iterator which only visits terms
// having the the vellum automaton and start/end key range
func (d *Dictionary) AutomatonIterator(a segment.Automaton,
	startKeyInclusive, endKeyExclusive []byte) segment.DictionaryIterator {
	if d.fst != nil {
		rv := &DictionaryIterator{
			d: d,
		}

		itr, err := d.fst.Search(a, startKeyInclusive, endKeyExclusive)
		if err == nil {
			rv.itr = itr
		} else if err != vellum.ErrIteratorDone {
			rv.err = err
		}

		return rv
	}
	return emptyDictionaryIterator
}

func (d *Dictionary) incrementBytesRead(val uint64) {
	d.bytesRead += val
}

func (d *Dictionary) BytesRead() uint64 {
	return d.bytesRead
}

func (d *Dictionary) ResetBytesRead(val uint64) {
	d.bytesRead = val
}

func (d *Dictionary) BytesWritten() uint64 {
	return 0
}

// DictionaryIterator is an iterator for term dictionary
type DictionaryIterator struct {
	d         *Dictionary
	itr       vellum.Iterator
	err       error
	tmp       PostingsList
	entry     index.DictEntry
	omitCount bool
}

var emptyDictionaryIterator = &DictionaryIterator{}

// Next returns the next entry in the dictionary
func (i *DictionaryIterator) Next() (*index.DictEntry, error) {
	if i.err != nil && i.err != vellum.ErrIteratorDone {
		return nil, i.err
	} else if i.itr == nil || i.err == vellum.ErrIteratorDone {
		return nil, nil
	}
	term, postingsOffset := i.itr.Current()
	i.entry.Term = string(term)
	if !i.omitCount {
		i.err = i.tmp.read(postingsOffset, i.d)
		if i.err != nil {
			return nil, i.err
		}
		i.entry.Count = i.tmp.Count()
	}
	i.err = i.itr.Next()
	return &i.entry, nil
}
