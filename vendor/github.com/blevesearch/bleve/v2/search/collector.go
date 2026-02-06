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

package search

import (
	"context"
	"time"

	index "github.com/blevesearch/bleve_index_api"
)

type Collector interface {
	Collect(ctx context.Context, searcher Searcher, reader index.IndexReader) error
	Results() DocumentMatchCollection
	Total() uint64
	MaxScore() float64
	Took() time.Duration
	SetFacetsBuilder(facetsBuilder *FacetsBuilder)
	FacetResults() FacetResults
}

// DocumentMatchHandler is the type of document match callback
// bleve will invoke during the search.
// Eventually, bleve will indicate the completion of an ongoing search,
// by passing a nil value for the document match callback.
// The application should take a copy of the hit/documentMatch
// if it wish to own it or need prolonged access to it.
type DocumentMatchHandler func(hit *DocumentMatch) error

type MakeDocumentMatchHandlerKeyType string

var MakeDocumentMatchHandlerKey = MakeDocumentMatchHandlerKeyType(
	"MakeDocumentMatchHandlerKey")

var MakeKNNDocumentMatchHandlerKey = MakeDocumentMatchHandlerKeyType(
	"MakeKNNDocumentMatchHandlerKey")

// MakeDocumentMatchHandler is an optional DocumentMatchHandler
// builder function which the applications can pass to bleve.
// These builder methods gives a DocumentMatchHandler function
// to bleve, which it will invoke on every document matches.
type MakeDocumentMatchHandler func(ctx *SearchContext) (
	callback DocumentMatchHandler, loadID bool, err error)

type MakeKNNDocumentMatchHandler func(ctx *SearchContext) (
	callback DocumentMatchHandler, err error)
