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

package segment

import (
	"fmt"

	"github.com/RoaringBitmap/roaring/v2"
	index "github.com/blevesearch/bleve_index_api"
)

var ErrClosed = fmt.Errorf("index closed")

// StoredFieldValueVisitor defines a callback to be visited for each
// stored field value.  The return value determines if the visitor
// should keep going.  Returning true continues visiting, false stops.
type StoredFieldValueVisitor func(field string, typ byte, value []byte, pos []uint64) bool

type Segment interface {
	DiskStatsReporter

	Dictionary(field string) (TermDictionary, error)

	VisitStoredFields(num uint64, visitor StoredFieldValueVisitor) error

	DocID(num uint64) ([]byte, error)

	Count() uint64

	DocNumbers([]string) (*roaring.Bitmap, error)

	Fields() []string

	Close() error

	Size() int

	AddRef()
	DecRef() error
}

type UnpersistedSegment interface {
	Segment
	Persist(path string) error
}

type PersistedSegment interface {
	Segment
	Path() string
}

type UpdatableSegment interface {
	Segment
	GetUpdatedFields() map[string]*index.UpdateFieldInfo
	SetUpdatedFields(fieldInfo map[string]*index.UpdateFieldInfo)
}

type TermDictionary interface {
	PostingsList(term []byte, except *roaring.Bitmap, prealloc PostingsList) (PostingsList, error)

	AutomatonIterator(a Automaton,
		startKeyInclusive, endKeyExclusive []byte) DictionaryIterator

	Contains(key []byte) (bool, error)

	// returns total number of terms in the term dictionary
	Cardinality() int
}

type DictionaryIterator interface {
	Next() (*index.DictEntry, error)
}

type PostingsList interface {
	DiskStatsReporter

	Iterator(includeFreq, includeNorm, includeLocations bool, prealloc PostingsIterator) PostingsIterator

	Size() int

	Count() uint64

	// NOTE deferred for future work

	// And(other PostingsList) PostingsList
	// Or(other PostingsList) PostingsList
}

type PostingsIterator interface {
	DiskStatsReporter

	// The caller is responsible for copying whatever it needs from
	// the returned Posting instance before calling Next(), as some
	// implementations may return a shared instance to reduce memory
	// allocations.
	Next() (Posting, error)

	// Advance will return the posting with the specified doc number
	// or if there is no such posting, the next posting.
	// Callers MUST NOT attempt to pass a docNum that is less than or
	// equal to the currently visited posting doc Num.
	Advance(docNum uint64) (Posting, error)

	Size() int
}

type DiskStatsReporter interface {
	// BytesRead returns the bytes read from the disk as
	// part of the current running query.
	BytesRead() uint64

	// ResetBytesRead is used by the parent layer
	// to reset the bytes read value to a consistent
	// value during operations such as merging of segments.
	ResetBytesRead(uint64)

	// BytesWritten returns the bytes written to disk while
	// building an index
	BytesWritten() uint64
}

type OptimizablePostingsIterator interface {
	ActualBitmap() *roaring.Bitmap
	DocNum1Hit() (uint64, bool)
	ReplaceActual(*roaring.Bitmap)
}

type Posting interface {
	Number() uint64

	Frequency() uint64
	Norm() float64

	Locations() []Location

	Size() int
}

type Location interface {
	Field() string
	Start() uint64
	End() uint64
	Pos() uint64
	ArrayPositions() []uint64
	Size() int
}

// DocValueVisitable is implemented by various scorch segment
// implementations with persistence for the un inverting of the
// postings or other indexed values.
type DocValueVisitable interface {
	VisitDocValues(localDocNum uint64, fields []string,
		visitor index.DocValueVisitor, optional DocVisitState) (DocVisitState, error)

	// VisitableDocValueFields implementation should return
	// the list of fields which are document value persisted and
	// therefore visitable by the above VisitDocValues method.
	VisitableDocValueFields() ([]string, error)
}

type DocVisitState interface {
	DiskStatsReporter
}

type StatsReporter interface {
	ReportBytesWritten(bytesWritten uint64)
}

type FieldStatsReporter interface {
	UpdateFieldStats(FieldStats)
}

type FieldStats interface {
	Store(statName, fieldName string, value uint64)
	Aggregate(stats FieldStats)
	Fetch() map[string]map[string]uint64
}

// ThesaurusSegment provides access to a thesaurus within a specific segment of the index.
type ThesaurusSegment interface {
	Segment
	// Thesaurus returns the Thesaurus with the specified name.
	Thesaurus(name string) (Thesaurus, error)
}

// Thesaurus encapsulates a structured collection of terms and their associated synonyms.
type Thesaurus interface {
	// SynonymsList retrieves a list of synonyms for the specified term. The `except` parameter
	// excludes specific synonyms, such as those originating from deleted documents. The `prealloc`
	// parameter allows the use of preallocated memory to optimize performance.
	SynonymsList(term []byte, except *roaring.Bitmap, prealloc SynonymsList) (SynonymsList, error)

	// AutomatonIterator creates an iterator over the thesaurus keys/terms using the provided automaton.
	// The iteration is constrained by the specified key range [startKeyInclusive, endKeyExclusive).
	// These terms or keys are the ones that have a SynonymsList associated with them, in the thesaurus.
	AutomatonIterator(a Automaton, startKeyInclusive, endKeyExclusive []byte) ThesaurusIterator

	// Contains checks if the given key exists in the thesaurus.
	Contains(key []byte) (bool, error)
}

// ThesaurusIterator iterates over terms in a thesaurus.
type ThesaurusIterator interface {
	// Next returns the next entry in the thesaurus or an error if iteration fails.
	Next() (*index.ThesaurusEntry, error)
}

// SynonymsList represents a list of synonyms for a term.
type SynonymsList interface {
	// Iterator returns an iterator to traverse the list of synonyms.
	// The `prealloc` parameter can be used to reuse existing memory for the iterator.
	Iterator(prealloc SynonymsIterator) SynonymsIterator

	Size() int
}

// SynonymsIterator provides a mechanism to iterate over a list of synonyms.
type SynonymsIterator interface {
	// Next returns the next synonym in the list or an error if iteration fails.
	Next() (Synonym, error)

	Size() int
}

// Synonym represents a single synonym for a term in the thesaurus.
type Synonym interface {
	// Number returns the document number from which the synonym originates.
	Number() uint32
	// Term returns the textual representation of the synonym.
	Term() string

	Size() int
}
