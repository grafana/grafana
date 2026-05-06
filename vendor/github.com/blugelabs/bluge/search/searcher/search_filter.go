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

// FilterFunc defines a function which can filter documents
// returning true means keep the document
// returning false means do not keep the document
type FilterFunc func(d *search.DocumentMatch) bool

// FilteringSearcher wraps any other searcher, but checks any Next/Advance
// call against the supplied FilterFunc
type FilteringSearcher struct {
	child  search.Searcher
	accept FilterFunc
}

func NewFilteringSearcher(s search.Searcher, filter FilterFunc) *FilteringSearcher {
	return &FilteringSearcher{
		child:  s,
		accept: filter,
	}
}

func (f *FilteringSearcher) Size() int {
	return reflectStaticSizeFilteringSearcher + sizeOfPtr +
		f.child.Size()
}

func (f *FilteringSearcher) Next(ctx *search.Context) (*search.DocumentMatch, error) {
	next, err := f.child.Next(ctx)
	for next != nil && err == nil {
		if f.accept(next) {
			return next, nil
		}
		next, err = f.child.Next(ctx)
	}
	return nil, err
}

func (f *FilteringSearcher) Advance(ctx *search.Context, number uint64) (*search.DocumentMatch, error) {
	adv, err := f.child.Advance(ctx, number)
	if err != nil {
		return nil, err
	}
	if adv == nil {
		return nil, nil
	}
	if f.accept(adv) {
		return adv, nil
	}
	return f.Next(ctx)
}

func (f *FilteringSearcher) Close() error {
	return f.child.Close()
}

func (f *FilteringSearcher) Count() uint64 {
	return f.child.Count()
}

func (f *FilteringSearcher) Min() int {
	return f.child.Min()
}

func (f *FilteringSearcher) DocumentMatchPoolSize() int {
	return f.child.DocumentMatchPoolSize()
}
