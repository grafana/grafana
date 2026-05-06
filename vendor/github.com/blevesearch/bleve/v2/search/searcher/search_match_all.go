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
	"reflect"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/scorer"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeMatchAllSearcher int

func init() {
	var mas MatchAllSearcher
	reflectStaticSizeMatchAllSearcher = int(reflect.TypeOf(mas).Size())
}

type MatchAllSearcher struct {
	indexReader index.IndexReader
	reader      index.DocIDReader
	scorer      *scorer.ConstantScorer
	count       uint64
}

func NewMatchAllSearcher(ctx context.Context, indexReader index.IndexReader, boost float64, options search.SearcherOptions) (*MatchAllSearcher, error) {
	reader, err := indexReader.DocIDReaderAll()
	if err != nil {
		return nil, err
	}
	count, err := indexReader.DocCount()
	if err != nil {
		_ = reader.Close()
		return nil, err
	}
	scorer := scorer.NewConstantScorer(1.0, boost, options)

	return &MatchAllSearcher{
		indexReader: indexReader,
		reader:      reader,
		scorer:      scorer,
		count:       count,
	}, nil
}

func (s *MatchAllSearcher) Size() int {
	return reflectStaticSizeMatchAllSearcher + size.SizeOfPtr +
		s.reader.Size() +
		s.scorer.Size()
}

func (s *MatchAllSearcher) Count() uint64 {
	return s.count
}

func (s *MatchAllSearcher) Weight() float64 {
	return s.scorer.Weight()
}

func (s *MatchAllSearcher) SetQueryNorm(qnorm float64) {
	s.scorer.SetQueryNorm(qnorm)
}

func (s *MatchAllSearcher) Next(ctx *search.SearchContext) (*search.DocumentMatch, error) {
	id, err := s.reader.Next()
	if err != nil {
		return nil, err
	}

	if id == nil {
		return nil, nil
	}

	// score match
	docMatch := s.scorer.Score(ctx, id)
	// return doc match
	return docMatch, nil

}

func (s *MatchAllSearcher) Advance(ctx *search.SearchContext, ID index.IndexInternalID) (*search.DocumentMatch, error) {
	id, err := s.reader.Advance(ID)
	if err != nil {
		return nil, err
	}

	if id == nil {
		return nil, nil
	}

	// score match
	docMatch := s.scorer.Score(ctx, id)

	// return doc match
	return docMatch, nil
}

func (s *MatchAllSearcher) Close() error {
	return s.reader.Close()
}

func (s *MatchAllSearcher) Min() int {
	return 0
}

func (s *MatchAllSearcher) DocumentMatchPoolSize() int {
	return 1
}
