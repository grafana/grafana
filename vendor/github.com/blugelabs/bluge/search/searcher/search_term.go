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

package searcher

import (
	"github.com/blugelabs/bluge/search"
	segment "github.com/blugelabs/bluge_segment_api"
)

type TermSearcher struct {
	indexReader search.Reader
	reader      segment.PostingsIterator
	options     search.SearcherOptions
	scorer      search.Scorer
	queryTerm   string
}

func NewTermSearcher(indexReader search.Reader, term, field string, boost float64, scorer search.Scorer,
	options search.SearcherOptions) (*TermSearcher, error) {
	return NewTermSearcherBytes(indexReader, []byte(term), field, boost, scorer, options)
}

func NewTermSearcherBytes(indexReader search.Reader, term []byte, field string, boost float64, scorer search.Scorer,
	options search.SearcherOptions) (*TermSearcher, error) {
	needFreqNorm := options.Score != "none"
	reader, err := indexReader.PostingsIterator(term, field, needFreqNorm, needFreqNorm, options.IncludeTermVectors)
	if err != nil {
		return nil, err
	}
	return newTermSearcherFromReader(indexReader, reader, term, field, boost, scorer, options)
}

type termStatsWrapper struct {
	docFreq uint64
}

func (t *termStatsWrapper) DocumentFrequency() uint64 {
	return t.docFreq
}

func newTermSearcherFromReader(indexReader search.Reader, reader segment.PostingsIterator,
	term []byte, field string, boost float64, scorer search.Scorer, options search.SearcherOptions) (*TermSearcher, error) {
	if scorer == nil {
		collStats, err := indexReader.CollectionStats(field)
		if err != nil {
			return nil, err
		}
		scorer = options.SimilarityForField(field).Scorer(boost, collStats, &termStatsWrapper{docFreq: reader.Count()})
	}
	return &TermSearcher{
		indexReader: indexReader,
		reader:      reader,
		scorer:      scorer,
		options:     options,
		queryTerm:   string(term),
	}, nil
}

func (s *TermSearcher) Size() int {
	return reflectStaticSizeTermSearcher + sizeOfPtr + s.reader.Size()
}

func (s *TermSearcher) Count() uint64 {
	return s.reader.Count()
}

func (s *TermSearcher) Next(ctx *search.Context) (*search.DocumentMatch, error) {
	termMatch, err := s.reader.Next()
	if err != nil {
		return nil, err
	}

	if termMatch == nil {
		return nil, nil
	}

	// score match
	docMatch := s.buildDocumentMatch(ctx, termMatch)

	// return doc match
	return docMatch, nil
}

func (s *TermSearcher) Advance(ctx *search.Context, number uint64) (*search.DocumentMatch, error) {
	termMatch, err := s.reader.Advance(number)
	if err != nil {
		return nil, err
	}

	if termMatch == nil {
		return nil, nil
	}

	// score match
	docMatch := s.buildDocumentMatch(ctx, termMatch)

	// return doc match
	return docMatch, nil
}

func (s *TermSearcher) Close() error {
	return s.reader.Close()
}

func (s *TermSearcher) Min() int {
	return 0
}

func (s *TermSearcher) DocumentMatchPoolSize() int {
	return 1
}

func (s *TermSearcher) Optimize(kind string, octx segment.OptimizableContext) (
	segment.OptimizableContext, error) {
	o, ok := s.reader.(segment.Optimizable)
	if ok {
		return o.Optimize(kind, octx)
	}

	return nil, nil
}

func (s *TermSearcher) buildDocumentMatch(ctx *search.Context, termMatch segment.Posting) *search.DocumentMatch {
	rv := ctx.DocumentMatchPool.Get()
	rv.SetReader(s.indexReader)
	rv.Number = termMatch.Number()

	if s.options.Explain {
		rv.Explanation = s.scorer.Explain(termMatch.Frequency(), termMatch.Norm())
		rv.Score = rv.Explanation.Value
	} else {
		rv.Score = s.scorer.Score(termMatch.Frequency(), termMatch.Norm())
	}

	if len(termMatch.Locations()) > 0 {
		if cap(rv.FieldTermLocations) < len(termMatch.Locations()) {
			rv.FieldTermLocations = make([]search.FieldTermLocation, 0, len(termMatch.Locations()))
		}

		for _, v := range termMatch.Locations() {
			rv.FieldTermLocations =
				append(rv.FieldTermLocations, search.FieldTermLocation{
					Field: v.Field(),
					Term:  s.queryTerm,
					Location: search.Location{
						Pos:   v.Pos(),
						Start: v.Start(),
						End:   v.End(),
					},
				})
		}
	}

	return rv
}
