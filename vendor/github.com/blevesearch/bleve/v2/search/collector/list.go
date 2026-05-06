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

package collector

import (
	"container/list"

	"github.com/blevesearch/bleve/v2/search"
)

type collectStoreList struct {
	results *list.List
	compare collectorCompare
}

func newStoreList(capacity int, compare collectorCompare) *collectStoreList {
	rv := &collectStoreList{
		results: list.New(),
		compare: compare,
	}

	return rv
}

func (c *collectStoreList) AddNotExceedingSize(doc *search.DocumentMatch, size int) *search.DocumentMatch {
	c.add(doc)
	if c.len() > size {
		return c.removeLast()
	}
	return nil
}

func (c *collectStoreList) add(doc *search.DocumentMatch) {
	for e := c.results.Front(); e != nil; e = e.Next() {
		curr := e.Value.(*search.DocumentMatch)
		if c.compare(doc, curr) >= 0 {
			c.results.InsertBefore(doc, e)
			return
		}
	}
	// if we got to the end, we still have to add it
	c.results.PushBack(doc)
}

func (c *collectStoreList) removeLast() *search.DocumentMatch {
	return c.results.Remove(c.results.Front()).(*search.DocumentMatch)
}

func (c *collectStoreList) Final(skip int, fixup collectorFixup) (search.DocumentMatchCollection, error) {
	if c.results.Len()-skip > 0 {
		rv := make(search.DocumentMatchCollection, c.results.Len()-skip)
		i := 0
		skipped := 0
		for e := c.results.Back(); e != nil; e = e.Prev() {
			if skipped < skip {
				skipped++
				continue
			}

			rv[i] = e.Value.(*search.DocumentMatch)
			err := fixup(rv[i])
			if err != nil {
				return nil, err
			}
			i++
		}
		return rv, nil
	}
	return search.DocumentMatchCollection{}, nil
}

func (c *collectStoreList) Internal() search.DocumentMatchCollection {
	rv := make(search.DocumentMatchCollection, c.results.Len())
	i := 0
	for e := c.results.Front(); e != nil; e = e.Next() {
		rv[i] = e.Value.(*search.DocumentMatch)
		i++
	}
	return rv
}

func (c *collectStoreList) len() int {
	return c.results.Len()
}
