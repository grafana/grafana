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
)

type MatchNoneSearcher struct{}

func NewMatchNoneSearcher(indexReader search.Reader, options search.SearcherOptions) (*MatchNoneSearcher, error) {
	return &MatchNoneSearcher{}, nil
}

func (s *MatchNoneSearcher) Size() int {
	return reflectStaticSizeMatchNoneSearcher + sizeOfPtr
}

func (s *MatchNoneSearcher) Count() uint64 {
	return uint64(0)
}

func (s *MatchNoneSearcher) Weight() float64 {
	return 0
}

func (s *MatchNoneSearcher) SetQueryNorm(_ float64) {}

func (s *MatchNoneSearcher) Next(ctx *search.Context) (*search.DocumentMatch, error) {
	return nil, nil
}

func (s *MatchNoneSearcher) Advance(ctx *search.Context, number uint64) (*search.DocumentMatch, error) {
	return nil, nil
}

func (s *MatchNoneSearcher) Close() error {
	return nil
}

func (s *MatchNoneSearcher) Min() int {
	return 0
}

func (s *MatchNoneSearcher) DocumentMatchPoolSize() int {
	return 0
}
