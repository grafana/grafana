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

package search

import (
	"fmt"
	"sort"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/blugelabs/bluge/analysis"
)

type Location struct {
	Pos   int
	Start int
	End   int
}

func (l *Location) Size() int {
	return reflectStaticSizeLocation
}

type Locations []*Location

func (p Locations) Len() int      { return len(p) }
func (p Locations) Swap(i, j int) { p[i], p[j] = p[j], p[i] }

func (p Locations) Less(i, j int) bool {
	return p[i].Pos < p[j].Pos
}

func (p Locations) Dedupe() Locations { // destructive!
	if len(p) <= 1 {
		return p
	}

	sort.Sort(p)

	slow := 0

	for _, pfast := range p {
		pslow := p[slow]
		if pslow.Pos == pfast.Pos &&
			pslow.Start == pfast.Start &&
			pslow.End == pfast.End {
			continue // duplicate, so only move fast ahead
		}

		slow++

		p[slow] = pfast
	}

	return p[:slow+1]
}

type TermLocationMap map[string]Locations

func (t TermLocationMap) AddLocation(term string, location *Location) {
	t[term] = append(t[term], location)
}

type FieldTermLocationMap map[string]TermLocationMap

type FieldTermLocation struct {
	Field    string
	Term     string
	Location Location
}

type FieldFragmentMap map[string][]string

type DocumentMatch struct {
	reader      MatchReader
	Number      uint64
	Score       float64
	Explanation *Explanation
	Locations   FieldTermLocationMap
	SortValue   [][]byte

	docValues map[string][][]byte

	// used to maintain natural index order
	HitNumber int

	// used to temporarily hold field term location information during
	// search processing in an efficient, recycle-friendly manner, to
	// be later incorporated into the Locations map when search
	// results are completed
	FieldTermLocations []FieldTermLocation
}

func (dm *DocumentMatch) SetReader(r MatchReader) {
	dm.reader = r
}

func (dm *DocumentMatch) addDocValue(name string, value []byte) {
	if dm.docValues == nil {
		dm.docValues = make(map[string][][]byte)
	}
	dm.docValues[name] = append(dm.docValues[name], value)
}

func (dm *DocumentMatch) LoadDocumentValues(ctx *Context, fields []string) error {
	dvReader, err := ctx.DocValueReaderForReader(dm.reader, fields)
	if err != nil {
		return err
	}

	return dvReader.VisitDocumentValues(dm.Number, dm.addDocValue)
}

func (dm *DocumentMatch) DocValues(field string) [][]byte {
	if dm.docValues != nil {
		return dm.docValues[field]
	}
	return nil
}

func (dm *DocumentMatch) VisitStoredFields(visitor segment.StoredFieldVisitor) error {
	return dm.reader.VisitStoredFields(dm.Number, visitor)
}

// Reset allows an already allocated DocumentMatch to be reused
func (dm *DocumentMatch) Reset() *DocumentMatch {
	// remember the [][]byte used for sort
	sortValue := dm.SortValue
	// remember the FieldTermLocations backing array
	ftls := dm.FieldTermLocations
	// idiom to copy over from empty DocumentMatch (0 allocations)
	*dm = DocumentMatch{}
	// reuse the [][]byte already allocated (and reset len to 0)
	dm.SortValue = sortValue[:0]
	// reuse the FieldTermLocations already allocated (and reset len to 0)
	dm.FieldTermLocations = ftls[:0]
	return dm
}

func (dm *DocumentMatch) Size() int {
	sizeInBytes := reflectStaticSizeDocumentMatch + sizeOfPtr

	if dm.Explanation != nil {
		sizeInBytes += dm.Explanation.Size()
	}

	for k, v := range dm.Locations {
		sizeInBytes += sizeOfString + len(k)
		for k1, v1 := range v {
			sizeInBytes += sizeOfString + len(k1) +
				sizeOfSlice
			for _, entry := range v1 {
				sizeInBytes += entry.Size()
			}
		}
	}

	for _, entry := range dm.SortValue {
		sizeInBytes += sizeOfSlice + len(entry)
	}

	return sizeInBytes
}

// Complete performs final preparation & transformation of the
// DocumentMatch at the end of search processing, also allowing the
// caller to provide an optional preallocated locations slice
func (dm *DocumentMatch) Complete(prealloc []Location) []Location {
	// transform the FieldTermLocations slice into the Locations map
	nlocs := len(dm.FieldTermLocations)
	if nlocs > 0 {
		if cap(prealloc) < nlocs {
			prealloc = make([]Location, nlocs)
		}
		prealloc = prealloc[:nlocs]

		var lastField string
		var tlm TermLocationMap
		var needsDedupe bool

		for i, ftl := range dm.FieldTermLocations {
			if lastField != ftl.Field {
				lastField = ftl.Field

				if dm.Locations == nil {
					dm.Locations = make(FieldTermLocationMap)
				}

				tlm = dm.Locations[ftl.Field]
				if tlm == nil {
					tlm = make(TermLocationMap)
					dm.Locations[ftl.Field] = tlm
				}
			}

			loc := &prealloc[i]
			*loc = ftl.Location

			locs := tlm[ftl.Term]

			// if the loc is before or at the last location, then there
			// might be duplicates that need to be deduplicated
			if !needsDedupe && len(locs) > 0 {
				last := locs[len(locs)-1]
				if loc.Pos <= last.Pos {
					needsDedupe = true
				}
			}

			tlm[ftl.Term] = append(locs, loc)

			dm.FieldTermLocations[i] = FieldTermLocation{ // recycle
				Location: Location{},
			}
		}

		if needsDedupe {
			for _, tlm := range dm.Locations {
				for term, locs := range tlm {
					tlm[term] = locs.Dedupe()
				}
			}
		}
	}

	dm.FieldTermLocations = dm.FieldTermLocations[:0] // recycle

	return prealloc
}

func (dm *DocumentMatch) String() string {
	return fmt.Sprintf("[%d-%f]", dm.Number, dm.Score)
}

type DocumentMatchCollection []*DocumentMatch

func (c DocumentMatchCollection) Len() int           { return len(c) }
func (c DocumentMatchCollection) Swap(i, j int)      { c[i], c[j] = c[j], c[i] }
func (c DocumentMatchCollection) Less(i, j int) bool { return c[i].Score > c[j].Score }

type Searcher interface {
	Next(ctx *Context) (*DocumentMatch, error)
	Advance(ctx *Context, number uint64) (*DocumentMatch, error)
	Close() error
	Count() uint64
	Min() int
	Size() int

	DocumentMatchPoolSize() int
}

type SearcherOptions struct {
	SimilarityForField func(field string) Similarity
	DefaultSearchField string
	DefaultAnalyzer    *analysis.Analyzer
	Explain            bool
	IncludeTermVectors bool
	Score              string
}

// Context represents the context around a single search
type Context struct {
	DocumentMatchPool *DocumentMatchPool
	dvReaders         map[DocumentValueReadable]segment.DocumentValueReader
}

func NewSearchContext(size, sortSize int) *Context {
	return &Context{
		DocumentMatchPool: NewDocumentMatchPool(size, sortSize),
		dvReaders:         make(map[DocumentValueReadable]segment.DocumentValueReader),
	}
}

func (sc *Context) DocValueReaderForReader(r DocumentValueReadable, fields []string) (segment.DocumentValueReader, error) {
	dvReader := sc.dvReaders[r]
	if dvReader == nil {
		var err error
		dvReader, err = r.DocumentValueReader(fields)
		if err != nil {
			return nil, err
		}
		sc.dvReaders[r] = dvReader
	}
	return dvReader, nil
}

func (sc *Context) Size() int {
	sizeInBytes := reflectStaticSizeSearchContext + sizeOfPtr +
		reflectStaticSizeDocumentMatchPool + sizeOfPtr

	if sc.DocumentMatchPool != nil {
		for _, entry := range sc.DocumentMatchPool.avail {
			if entry != nil {
				sizeInBytes += entry.Size()
			}
		}
	}

	return sizeInBytes
}

type DocumentValueReadable interface {
	// DocumentValueReader provides a way to find all of the document
	// values stored in the specified fields.  The returned
	// DocumentValueReader provides a means to visit specific document
	// numbers.
	DocumentValueReader(fields []string) (segment.DocumentValueReader, error)
}

type StoredFieldVisitable interface {
	// VisitStoredFields will call the visitor for each stored field
	// of the specified document number.
	VisitStoredFields(number uint64, visitor segment.StoredFieldVisitor) error
}

type MatchReader interface {
	DocumentValueReadable
	StoredFieldVisitable
}

type Reader interface {
	DocumentValueReadable

	StoredFieldVisitable

	CollectionStats(field string) (segment.CollectionStats, error)

	// DictionaryLookup provides a way to quickly determine if a term is
	// in the dictionary for the specified field.
	DictionaryLookup(field string) (segment.DictionaryLookup, error)

	// DictionaryIterator provides a way to explore the terms used in the
	// specified field.  You can optionally filter these terms
	// by the provided Automaton, or start/end terms.
	DictionaryIterator(field string, automaton segment.Automaton, start,
		end []byte) (segment.DictionaryIterator, error)

	// PostingsIterator provides a way to find information about all documents
	// that use the specified term in the specified field.
	PostingsIterator(term []byte, field string, includeFreq, includeNorm,
		includeTermVectors bool) (segment.PostingsIterator, error)

	// Close releases all resources associated with this Reader
	Close() error
}

type Similarity interface {
	ComputeNorm(numTerms int) float32
	Scorer(boost float64, collectionStats segment.CollectionStats, termStats segment.TermStats) Scorer
}

type Scorer interface {
	Score(freq int, norm float64) float64
	Explain(freq int, norm float64) *Explanation
}

type CompositeScorer interface {
	ScoreComposite(constituents []*DocumentMatch) float64
	ExplainComposite(constituents []*DocumentMatch) *Explanation
}
