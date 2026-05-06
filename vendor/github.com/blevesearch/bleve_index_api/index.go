//  Copyright (c) 2014 Couchbase, Inc.
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
	"bytes"
	"context"
	"reflect"
)

var reflectStaticSizeTermFieldDoc int
var reflectStaticSizeTermFieldVector int

func init() {
	var tfd TermFieldDoc
	reflectStaticSizeTermFieldDoc = int(reflect.TypeOf(tfd).Size())
	var tfv TermFieldVector
	reflectStaticSizeTermFieldVector = int(reflect.TypeOf(tfv).Size())
}

type Index interface {
	Open() error
	Close() error

	Update(doc Document) error
	Delete(id string) error
	Batch(batch *Batch) error

	SetInternal(key, val []byte) error
	DeleteInternal(key []byte) error

	// Reader returns a low-level accessor on the index data. Close it to
	// release associated resources.
	Reader() (IndexReader, error)

	StatsMap() map[string]interface{}
}

// CopyIndex is an extended index that supports copying to a new location online.
// Use the CopyReader method to obtain a reader for initiating the copy operation.
type CopyIndex interface {
	Index
	// Obtain a copy reader for the online copy/backup operation,
	// to handle necessary bookkeeping, instead of using the regular IndexReader.
	CopyReader() CopyReader
}

// EventIndex is an optional interface for exposing the support for firing event
// callbacks for various events in the index.
type EventIndex interface {
	// FireIndexEvent is used to fire an event callback when Index() is called,
	// to notify the caller that a document has been added to the index.
	FireIndexEvent()
}

type IndexReader interface {
	TermFieldReader(ctx context.Context, term []byte, field string, includeFreq, includeNorm, includeTermVectors bool) (TermFieldReader, error)

	// DocIDReader returns an iterator over all doc ids
	// The caller must close returned instance to release associated resources.
	DocIDReaderAll() (DocIDReader, error)

	DocIDReaderOnly(ids []string) (DocIDReader, error)

	FieldDict(field string) (FieldDict, error)

	// FieldDictRange is currently defined to include the start and end terms
	FieldDictRange(field string, startTerm []byte, endTerm []byte) (FieldDict, error)
	FieldDictPrefix(field string, termPrefix []byte) (FieldDict, error)

	Document(id string) (Document, error)

	DocValueReader(fields []string) (DocValueReader, error)

	Fields() ([]string, error)

	GetInternal(key []byte) ([]byte, error)

	DocCount() (uint64, error)

	ExternalID(id IndexInternalID) (string, error)
	InternalID(id string) (IndexInternalID, error)

	Close() error
}

// CopyReader is an extended index reader for backup or online copy operations, replacing the regular index reader.
type CopyReader interface {
	IndexReader
	// CopyTo performs an online copy or backup of the index to the specified directory.
	CopyTo(d Directory) error
	// CloseCopyReader must be used instead of Close() to close the copy reader.
	CloseCopyReader() error
}

// RegexAutomaton abstracts an automaton built using a regex pattern.
type RegexAutomaton interface {
	// MatchesRegex returns true if the given string matches the regex pattern
	// used to build the automaton.
	MatchesRegex(string) bool
}

// IndexReaderRegexp provides functionality to work with regex-based field dictionaries.
type IndexReaderRegexp interface {
	// FieldDictRegexp returns a FieldDict for terms matching the specified regex pattern
	// in the dictionary of the given field.
	FieldDictRegexp(field string, regex string) (FieldDict, error)

	// FieldDictRegexpAutomaton returns a FieldDict and a RegexAutomaton that can be used
	// to match strings against the regex pattern.
	FieldDictRegexpAutomaton(field string, regex string) (FieldDict, RegexAutomaton, error)
}

// FuzzyAutomaton abstracts a Levenshtein automaton built using a term and a fuzziness value.
type FuzzyAutomaton interface {
	// MatchAndDistance checks if the given string is within the fuzziness distance
	// of the term used to build the automaton. It also returns the edit (Levenshtein)
	// distance between the string and the term.
	MatchAndDistance(term string) (bool, uint8)
}

// IndexReaderFuzzy provides functionality to work with fuzzy matching in field dictionaries.
type IndexReaderFuzzy interface {
	// FieldDictFuzzy returns a FieldDict for terms that are within the specified fuzziness
	// distance of the given term and match the specified prefix in the given field.
	FieldDictFuzzy(field string, term string, fuzziness int, prefix string) (FieldDict, error)

	// FieldDictFuzzyAutomaton returns a FieldDict and a FuzzyAutomaton that can be used
	// to calculate the edit distance between the term and other strings.
	FieldDictFuzzyAutomaton(field string, term string, fuzziness int, prefix string) (FieldDict, FuzzyAutomaton, error)
}

type IndexReaderContains interface {
	FieldDictContains(field string) (FieldDictContains, error)
}

// SpatialIndexPlugin is an optional interface for exposing the
// support for any custom analyzer plugins that are capable of
// generating hierarchial spatial tokens for both indexing and
// query purposes from the geo location data.
type SpatialIndexPlugin interface {
	GetSpatialAnalyzerPlugin(typ string) (SpatialAnalyzerPlugin, error)
}

type TermFieldVector struct {
	Field          string
	ArrayPositions []uint64
	Pos            uint64
	Start          uint64
	End            uint64
}

func (tfv *TermFieldVector) Size() int {
	return reflectStaticSizeTermFieldVector + sizeOfPtr +
		len(tfv.Field) + len(tfv.ArrayPositions)*sizeOfUint64
}

// IndexInternalID is an opaque document identifier interal to the index impl
type IndexInternalID []byte

func (id IndexInternalID) Equals(other IndexInternalID) bool {
	return id.Compare(other) == 0
}

func (id IndexInternalID) Compare(other IndexInternalID) int {
	return bytes.Compare(id, other)
}

type TermFieldDoc struct {
	Term    string
	ID      IndexInternalID
	Freq    uint64
	Norm    float64
	Vectors []*TermFieldVector
}

func (tfd *TermFieldDoc) Size() int {
	sizeInBytes := reflectStaticSizeTermFieldDoc + sizeOfPtr +
		len(tfd.Term) + len(tfd.ID)

	for _, entry := range tfd.Vectors {
		sizeInBytes += entry.Size()
	}

	return sizeInBytes
}

// Reset allows an already allocated TermFieldDoc to be reused
func (tfd *TermFieldDoc) Reset() *TermFieldDoc {
	// remember the []byte used for the ID
	id := tfd.ID
	vectors := tfd.Vectors
	// idiom to copy over from empty TermFieldDoc (0 allocations)
	*tfd = TermFieldDoc{}
	// reuse the []byte already allocated (and reset len to 0)
	tfd.ID = id[:0]
	tfd.Vectors = vectors[:0]
	return tfd
}

// TermFieldReader is the interface exposing the enumeration of documents
// containing a given term in a given field. Documents are returned in byte
// lexicographic order over their identifiers.
type TermFieldReader interface {
	// Next returns the next document containing the term in this field, or nil
	// when it reaches the end of the enumeration.  The preAlloced TermFieldDoc
	// is optional, and when non-nil, will be used instead of allocating memory.
	Next(preAlloced *TermFieldDoc) (*TermFieldDoc, error)

	// Advance resets the enumeration at specified document or its immediate
	// follower.
	Advance(ID IndexInternalID, preAlloced *TermFieldDoc) (*TermFieldDoc, error)

	// Count returns the number of documents contains the term in this field.
	Count() uint64
	Close() error

	Size() int
}

type DictEntry struct {
	Term         string
	Count        uint64
	EditDistance uint8
}

type FieldDict interface {
	Next() (*DictEntry, error)
	Close() error

	Cardinality() int
	BytesRead() uint64
}

type FieldDictContains interface {
	Contains(key []byte) (bool, error)

	BytesRead() uint64
}

// DocIDReader is the interface exposing enumeration of documents identifiers.
// Close the reader to release associated resources.
type DocIDReader interface {
	// Next returns the next document internal identifier in the natural
	// index order, nil when the end of the sequence is reached.
	Next() (IndexInternalID, error)

	// Advance resets the iteration to the first internal identifier greater than
	// or equal to ID. If ID is smaller than the start of the range, the iteration
	// will start there instead. If ID is greater than or equal to the end of
	// the range, Next() call will return io.EOF.
	Advance(ID IndexInternalID) (IndexInternalID, error)

	Size() int

	Close() error
}

type DocValueVisitor func(field string, term []byte)

type DocValueReader interface {
	VisitDocValues(id IndexInternalID, visitor DocValueVisitor) error

	BytesRead() uint64
}

// IndexBuilder is an interface supported by some index schemes
// to allow direct write-only index building
type IndexBuilder interface {
	Index(doc Document) error
	Close() error
}

// ThesaurusTermReader is an interface for enumerating synonyms of a term in a thesaurus.
type ThesaurusTermReader interface {
	// Next returns the next synonym of the term, or an error if something goes wrong.
	// Returns nil when the enumeration is complete.
	Next() (string, error)

	// Close releases any resources associated with the reader.
	Close() error

	Size() int
}

// ThesaurusEntry represents a term in the thesaurus for which synonyms are stored.
type ThesaurusEntry struct {
	Term string
}

// ThesaurusKeys is an interface for enumerating terms (keys) in a thesaurus.
type ThesaurusKeys interface {
	// Next returns the next key in the thesaurus, or an error if something goes wrong.
	// Returns nil when the enumeration is complete.
	Next() (*ThesaurusEntry, error)

	// Close releases any resources associated with the reader.
	Close() error
}

// ThesaurusReader is an interface for accessing a thesaurus in the index.
type ThesaurusReader interface {
	IndexReader

	// ThesaurusTermReader returns a reader for the synonyms of a given term in the
	// specified thesaurus.
	ThesaurusTermReader(ctx context.Context, name string, term []byte) (ThesaurusTermReader, error)

	// ThesaurusKeys returns a reader for all terms in the specified thesaurus.
	ThesaurusKeys(name string) (ThesaurusKeys, error)

	// ThesaurusKeysFuzzy returns a reader for terms in the specified thesaurus that
	// match the given prefix and are within the specified fuzziness distance from
	// the provided term.
	ThesaurusKeysFuzzy(name string, term string, fuzziness int, prefix string) (ThesaurusKeys, error)

	// ThesaurusKeysRegexp returns a reader for terms in the specified thesaurus that
	// match the given regular expression pattern.
	ThesaurusKeysRegexp(name string, regex string) (ThesaurusKeys, error)

	// ThesaurusKeysPrefix returns a reader for terms in the specified thesaurus that
	// start with the given prefix.
	ThesaurusKeysPrefix(name string, termPrefix []byte) (ThesaurusKeys, error)
}

// EligibleDocumentSelector filters documents based on specific eligibility criteria.
// It can be extended with additional methods for filtering and retrieval.
type EligibleDocumentSelector interface {
	// AddEligibleDocumentMatch marks a document as eligible for selection.
	// id is the internal identifier of the document to be added.
	AddEligibleDocumentMatch(id IndexInternalID) error

	// SegmentEligibleDocs returns a list of eligible document IDs within a given segment.
	// segmentID identifies the segment for which eligible documents are retrieved.
	// This must be called after all eligible documents have been added.
	SegmentEligibleDocs(segmentID int) []uint64
}
