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

package searcher

import (
	"context"
	"fmt"
	"math"
	"reflect"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/scorer"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeTermSearcher int

func init() {
	var ts TermSearcher
	reflectStaticSizeTermSearcher = int(reflect.TypeOf(ts).Size())
}

type TermSearcher struct {
	indexReader index.IndexReader
	reader      index.TermFieldReader
	scorer      *scorer.TermQueryScorer
	tfd         index.TermFieldDoc
}

func NewTermSearcher(ctx context.Context, indexReader index.IndexReader,
	term string, field string, boost float64, options search.SearcherOptions) (search.Searcher, error) {
	if isTermQuery(ctx) {
		ctx = context.WithValue(ctx, search.QueryTypeKey, search.Term)
	}
	return NewTermSearcherBytes(ctx, indexReader, []byte(term), field, boost, options)
}

func NewTermSearcherBytes(ctx context.Context, indexReader index.IndexReader,
	term []byte, field string, boost float64, options search.SearcherOptions) (search.Searcher, error) {
	if ctx != nil {
		if fts, ok := ctx.Value(search.FieldTermSynonymMapKey).(search.FieldTermSynonymMap); ok {
			if ts, exists := fts[field]; exists {
				if s, found := ts[string(term)]; found {
					return NewSynonymSearcher(ctx, indexReader, term, s, field, boost, options)
				}
			}
		}
	}
	needFreqNorm := options.Score != "none"
	reader, err := indexReader.TermFieldReader(ctx, term, field, needFreqNorm, needFreqNorm, options.IncludeTermVectors)
	if err != nil {
		return nil, err
	}
	return newTermSearcherFromReader(ctx, indexReader, reader, term, field, boost, options)
}

func tfIDFScoreMetrics(indexReader index.IndexReader) (uint64, error) {
	// default tf-idf stats
	count, err := indexReader.DocCount()
	if err != nil {
		return 0, err
	}

	if count == 0 {
		return 0, nil
	}
	return count, nil
}

func bm25ScoreMetrics(ctx context.Context, field string,
	indexReader index.IndexReader) (uint64, float64, error) {
	var count uint64
	var fieldCardinality int
	var err error

	bm25Stats, ok := ctx.Value(search.BM25StatsKey).(*search.BM25Stats)
	if !ok {
		count, err = indexReader.DocCount()
		if err != nil {
			return 0, 0, err
		}
		if bm25Reader, ok := indexReader.(index.BM25Reader); ok {
			fieldCardinality, err = bm25Reader.FieldCardinality(field)
			if err != nil {
				return 0, 0, err
			}
		}
	} else {
		count = uint64(bm25Stats.DocCount)
		fieldCardinality, ok = bm25Stats.FieldCardinality[field]
		if !ok {
			return 0, 0, fmt.Errorf("field stat for bm25 not present %s", field)
		}
	}

	if count == 0 && fieldCardinality == 0 {
		return 0, 0, nil
	}
	return count, math.Ceil(float64(fieldCardinality) / float64(count)), nil
}

func newTermSearcherFromReader(ctx context.Context, indexReader index.IndexReader,
	reader index.TermFieldReader, term []byte, field string, boost float64,
	options search.SearcherOptions) (*TermSearcher, error) {
	var count uint64
	var avgDocLength float64
	var err error
	var similarityModel string

	// as a fallback case we track certain stats for tf-idf scoring
	if ctx != nil {
		if similarityModelCallback, ok := ctx.Value(search.
			GetScoringModelCallbackKey).(search.GetScoringModelCallbackFn); ok {
			similarityModel = similarityModelCallback()
		}
	}
	switch similarityModel {
	case index.BM25Scoring:
		count, avgDocLength, err = bm25ScoreMetrics(ctx, field, indexReader)
		if err != nil {
			_ = reader.Close()
			return nil, err
		}
	case index.TFIDFScoring:
		fallthrough
	default:
		count, err = tfIDFScoreMetrics(indexReader)
		if err != nil {
			_ = reader.Close()
			return nil, err
		}
	}
	scorer := scorer.NewTermQueryScorer(term, field, boost, count, reader.Count(), avgDocLength, options)
	return &TermSearcher{
		indexReader: indexReader,
		reader:      reader,
		scorer:      scorer,
	}, nil
}

func NewSynonymSearcher(ctx context.Context, indexReader index.IndexReader, term []byte, synonyms []string, field string, boost float64, options search.SearcherOptions) (search.Searcher, error) {
	createTermSearcher := func(term []byte, boostVal float64) (search.Searcher, error) {
		needFreqNorm := options.Score != "none"
		reader, err := indexReader.TermFieldReader(ctx, term, field, needFreqNorm, needFreqNorm, options.IncludeTermVectors)
		if err != nil {
			return nil, err
		}
		return newTermSearcherFromReader(ctx, indexReader, reader, term, field, boostVal, options)
	}
	// create a searcher for the term itself
	termSearcher, err := createTermSearcher(term, boost)
	if err != nil {
		return nil, err
	}
	// constituent searchers of the disjunction
	qsearchers := make([]search.Searcher, 0, len(synonyms)+1)
	// helper method to close all the searchers we've created
	// in case of an error
	qsearchersClose := func() {
		for _, searcher := range qsearchers {
			if searcher != nil {
				_ = searcher.Close()
			}
		}
	}
	qsearchers = append(qsearchers, termSearcher)
	// create a searcher for each synonym
	for _, synonym := range synonyms {
		synonymSearcher, err := createTermSearcher([]byte(synonym), boost/2.0)
		if err != nil {
			qsearchersClose()
			return nil, err
		}
		qsearchers = append(qsearchers, synonymSearcher)
	}
	// create a disjunction searcher
	rv, err := NewDisjunctionSearcher(ctx, indexReader, qsearchers, 0, options)
	if err != nil {
		qsearchersClose()
		return nil, err
	}
	return rv, nil
}

func (s *TermSearcher) Size() int {
	return reflectStaticSizeTermSearcher + size.SizeOfPtr +
		s.reader.Size() +
		s.tfd.Size() +
		s.scorer.Size()
}

func (s *TermSearcher) Count() uint64 {
	return s.reader.Count()
}

func (s *TermSearcher) Weight() float64 {
	return s.scorer.Weight()
}

func (s *TermSearcher) SetQueryNorm(qnorm float64) {
	s.scorer.SetQueryNorm(qnorm)
}

func (s *TermSearcher) Next(ctx *search.SearchContext) (*search.DocumentMatch, error) {
	termMatch, err := s.reader.Next(s.tfd.Reset())
	if err != nil {
		return nil, err
	}

	if termMatch == nil {
		return nil, nil
	}

	// score match
	docMatch := s.scorer.Score(ctx, termMatch)
	// return doc match
	return docMatch, nil

}

func (s *TermSearcher) Advance(ctx *search.SearchContext, ID index.IndexInternalID) (*search.DocumentMatch, error) {
	termMatch, err := s.reader.Advance(ID, s.tfd.Reset())
	if err != nil {
		return nil, err
	}

	if termMatch == nil {
		return nil, nil
	}

	// score match
	docMatch := s.scorer.Score(ctx, termMatch)

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

func (s *TermSearcher) Optimize(kind string, octx index.OptimizableContext) (
	index.OptimizableContext, error) {
	o, ok := s.reader.(index.Optimizable)
	if ok {
		return o.Optimize(kind, octx)
	}

	return nil, nil
}

func isTermQuery(ctx context.Context) bool {
	if ctx != nil {
		// if the ctx already has a value set for query type
		// it would've been done at a non term searcher level.
		_, ok := ctx.Value(search.QueryTypeKey).(string)
		return !ok
	}
	// if the context is nil, then don't set the query type
	return false
}
