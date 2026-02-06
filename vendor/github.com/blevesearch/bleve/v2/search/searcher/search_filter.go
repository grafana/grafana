//  Copyright (c) 2017 Couchbase, Inc.
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
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeFilteringSearcher int

func init() {
	var fs FilteringSearcher
	reflectStaticSizeFilteringSearcher = int(reflect.TypeOf(fs).Size())
}

// FilterFunc defines a function which can filter documents
// returning true means keep the document
// returning false means do not keep the document
type FilterFunc func(sctx *search.SearchContext, d *search.DocumentMatch) bool

// FilteringSearcher wraps any other searcher, but checks any Next/Advance
// call against the supplied FilterFunc
type FilteringSearcher struct {
	child  search.Searcher
	accept FilterFunc
}

func NewFilteringSearcher(ctx context.Context, s search.Searcher, filter FilterFunc) *FilteringSearcher {
	return &FilteringSearcher{
		child:  s,
		accept: filter,
	}
}

func (f *FilteringSearcher) Size() int {
	return reflectStaticSizeFilteringSearcher + size.SizeOfPtr +
		f.child.Size()
}

func (f *FilteringSearcher) Next(ctx *search.SearchContext) (*search.DocumentMatch, error) {
	next, err := f.child.Next(ctx)
	for next != nil && err == nil {
		if f.accept(ctx, next) {
			return next, nil
		}
		next, err = f.child.Next(ctx)
	}
	return nil, err
}

func (f *FilteringSearcher) Advance(ctx *search.SearchContext, ID index.IndexInternalID) (*search.DocumentMatch, error) {
	adv, err := f.child.Advance(ctx, ID)
	if err != nil {
		return nil, err
	}
	if adv == nil {
		return nil, nil
	}
	if f.accept(ctx, adv) {
		return adv, nil
	}
	return f.Next(ctx)
}

func (f *FilteringSearcher) Close() error {
	return f.child.Close()
}

func (f *FilteringSearcher) Weight() float64 {
	return f.child.Weight()
}

func (f *FilteringSearcher) SetQueryNorm(n float64) {
	f.child.SetQueryNorm(n)
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
