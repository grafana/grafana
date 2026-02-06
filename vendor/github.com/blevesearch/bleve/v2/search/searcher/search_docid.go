//  Copyright (c) 2015 Couchbase, Inc.
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

var reflectStaticSizeDocIDSearcher int

func init() {
	var ds DocIDSearcher
	reflectStaticSizeDocIDSearcher = int(reflect.TypeOf(ds).Size())
}

// DocIDSearcher returns documents matching a predefined set of identifiers.
type DocIDSearcher struct {
	reader index.DocIDReader
	scorer *scorer.ConstantScorer
	count  int
}

func NewDocIDSearcher(ctx context.Context, indexReader index.IndexReader, ids []string, boost float64,
	options search.SearcherOptions) (searcher *DocIDSearcher, err error) {

	reader, err := indexReader.DocIDReaderOnly(ids)
	if err != nil {
		return nil, err
	}
	scorer := scorer.NewConstantScorer(1.0, boost, options)
	return &DocIDSearcher{
		scorer: scorer,
		reader: reader,
		count:  len(ids),
	}, nil
}

func (s *DocIDSearcher) Size() int {
	return reflectStaticSizeDocIDSearcher + size.SizeOfPtr +
		s.reader.Size() +
		s.scorer.Size()
}

func (s *DocIDSearcher) Count() uint64 {
	return uint64(s.count)
}

func (s *DocIDSearcher) Weight() float64 {
	return s.scorer.Weight()
}

func (s *DocIDSearcher) SetQueryNorm(qnorm float64) {
	s.scorer.SetQueryNorm(qnorm)
}

func (s *DocIDSearcher) Next(ctx *search.SearchContext) (*search.DocumentMatch, error) {
	docidMatch, err := s.reader.Next()
	if err != nil {
		return nil, err
	}
	if docidMatch == nil {
		return nil, nil
	}

	docMatch := s.scorer.Score(ctx, docidMatch)
	return docMatch, nil
}

func (s *DocIDSearcher) Advance(ctx *search.SearchContext, ID index.IndexInternalID) (*search.DocumentMatch, error) {
	docidMatch, err := s.reader.Advance(ID)
	if err != nil {
		return nil, err
	}
	if docidMatch == nil {
		return nil, nil
	}

	docMatch := s.scorer.Score(ctx, docidMatch)
	return docMatch, nil
}

func (s *DocIDSearcher) Close() error {
	return s.reader.Close()
}

func (s *DocIDSearcher) Min() int {
	return 0
}

func (s *DocIDSearcher) DocumentMatchPoolSize() int {
	return 1
}
