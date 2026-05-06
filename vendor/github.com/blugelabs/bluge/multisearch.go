//  Copyright (c) 2020 The Bluge Authors.
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

package bluge

import (
	"context"

	"github.com/blugelabs/bluge/search"
)

type MultiSearcherList struct {
	searchers []search.Searcher
	index     int
	err       error
}

func NewMultiSearcherList(searchers []search.Searcher) *MultiSearcherList {
	return &MultiSearcherList{
		searchers: searchers,
	}
}

func (m *MultiSearcherList) Next(ctx *search.Context) (*search.DocumentMatch, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.index < len(m.searchers) {
		var dm *search.DocumentMatch
		dm, m.err = m.searchers[m.index].Next(ctx)
		if m.err != nil {
			return nil, m.err
		}
		if dm == nil {
			m.index++
			return m.Next(ctx)
		}
		return dm, nil
	}
	return nil, nil
}

func (m *MultiSearcherList) DocumentMatchPoolSize() int {
	// we search sequentially, so just use largest
	var rv int
	for _, searcher := range m.searchers {
		ps := searcher.DocumentMatchPoolSize()
		if ps > rv {
			rv = ps
		}
	}
	return rv
}

func (m *MultiSearcherList) Close() (err error) {
	for _, searcher := range m.searchers {
		cerr := searcher.Close()
		if err == nil {
			err = cerr
		}
	}
	return err
}

func MultiSearch(ctx context.Context, req SearchRequest, readers ...*Reader) (search.DocumentMatchIterator, error) {
	collector := req.Collector()

	var searchers []search.Searcher
	for _, reader := range readers {
		searcher, err := req.Searcher(reader.reader, reader.config)
		if err != nil {
			return nil, err
		}
		searchers = append(searchers, searcher)
	}

	msl := NewMultiSearcherList(searchers)
	dmItr, err := collector.Collect(ctx, req.Aggregations(), msl)
	if err != nil {
		return nil, err
	}

	return dmItr, nil
}
