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

type MatchAllSearcher struct {
	reader      segment.PostingsIterator
	scorer      search.Scorer
	indexReader search.Reader
	options     search.SearcherOptions
}

func NewMatchAllSearcher(indexReader search.Reader, boost float64, scorer search.Scorer,
	options search.SearcherOptions) (*MatchAllSearcher, error) {
	reader, err := indexReader.PostingsIterator(nil, "",
		false, false, false)
	if err != nil {
		return nil, err
	}
	return &MatchAllSearcher{
		indexReader: indexReader,
		reader:      reader,
		scorer:      scorer,
		options:     options,
	}, nil
}

func (s *MatchAllSearcher) Size() int {
	return reflectStaticSizeMatchAllSearcher + sizeOfPtr +
		s.reader.Size()
}

func (s *MatchAllSearcher) Count() uint64 {
	return s.reader.Count()
}

func (s *MatchAllSearcher) Next(ctx *search.Context) (*search.DocumentMatch, error) {
	tfd, err := s.reader.Next()
	if err != nil {
		return nil, err
	}

	if tfd == nil {
		return nil, nil
	}

	// score match
	docMatch := s.buildDocumentMatch(ctx, tfd)

	// return doc match
	return docMatch, nil
}

func (s *MatchAllSearcher) Advance(ctx *search.Context, number uint64) (*search.DocumentMatch, error) {
	tfd, err := s.reader.Advance(number)
	if err != nil {
		return nil, err
	}

	if tfd == nil {
		return nil, nil
	}

	// score match
	docMatch := s.buildDocumentMatch(ctx, tfd)

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

func (s *MatchAllSearcher) buildDocumentMatch(ctx *search.Context, termMatch segment.Posting) *search.DocumentMatch {
	rv := ctx.DocumentMatchPool.Get()
	rv.SetReader(s.indexReader)
	rv.Number = termMatch.Number()

	if s.options.Explain {
		rv.Explanation = s.scorer.Explain(termMatch.Frequency(), termMatch.Norm())
		rv.Score = rv.Explanation.Value
	} else {
		rv.Score = s.scorer.Score(termMatch.Frequency(), termMatch.Norm())
	}

	return rv
}
