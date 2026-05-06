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

package collector

import (
	"context"

	"github.com/blugelabs/bluge/search"
)

type AllCollector struct {
}

func NewAllCollector() *AllCollector {
	return &AllCollector{}
}

func (a *AllCollector) Collect(ctx context.Context, aggs search.Aggregations,
	searcher search.Collectible) (search.DocumentMatchIterator, error) {
	return &AllIterator{
		ctx:           ctx,
		neededFields:  aggs.Fields(),
		bucket:        search.NewBucket("", aggs),
		searcher:      searcher,
		searchContext: search.NewSearchContext(searcher.DocumentMatchPoolSize(), 0),
	}, nil
}

func (a *AllCollector) Size() int {
	return 0
}

func (a *AllCollector) BackingSize() int {
	return 0
}

type AllIterator struct {
	ctx           context.Context
	neededFields  []string
	bucket        *search.Bucket
	hitNumber     int
	searcher      search.Collectible
	searchContext *search.Context
	done          bool
}

func (a *AllIterator) doneCleanup() {
	a.done = true
	_ = a.searcher.Close()
}

func (a *AllIterator) Next() (next *search.DocumentMatch, err error) {
	if a.done {
		return nil, nil
	}
	if a.hitNumber%CheckDoneEvery == 0 {
		select {
		case <-a.ctx.Done():
			a.doneCleanup()
			return nil, a.ctx.Err()
		default:
		}
	}

	next, err = a.searcher.Next(a.searchContext)
	if err != nil {
		a.doneCleanup()
		return nil, err
	}

	if next == nil {
		a.bucket.Finish()
		a.doneCleanup()
		return nil, nil
	}

	a.hitNumber++
	next.HitNumber = a.hitNumber

	if len(a.neededFields) > 0 {
		err = next.LoadDocumentValues(a.searchContext, a.neededFields)
		if err != nil {
			a.doneCleanup()
			return nil, err
		}
	}
	// calculate aggregations
	a.bucket.Consume(next)

	return next, nil
}

func (a *AllIterator) Aggregations() *search.Bucket {
	return a.bucket
}
