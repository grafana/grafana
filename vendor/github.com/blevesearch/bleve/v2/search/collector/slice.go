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
	"github.com/blevesearch/bleve/v2/search"
)

type collectStoreSlice struct {
	slice   search.DocumentMatchCollection
	compare collectorCompare
}

func newStoreSlice(capacity int, compare collectorCompare) *collectStoreSlice {
	rv := &collectStoreSlice{
		slice:   make(search.DocumentMatchCollection, 0, capacity),
		compare: compare,
	}
	return rv
}

func (c *collectStoreSlice) AddNotExceedingSize(doc *search.DocumentMatch,
	size int) *search.DocumentMatch {
	c.add(doc)
	if c.len() > size {
		return c.removeLast()
	}
	return nil
}

func (c *collectStoreSlice) add(doc *search.DocumentMatch) {
	// find where to insert, starting at end (lowest)
	i := len(c.slice)
	for ; i > 0; i-- {
		cmp := c.compare(doc, c.slice[i-1])
		if cmp >= 0 {
			break
		}
	}
	// insert at i
	c.slice = append(c.slice, nil)
	copy(c.slice[i+1:], c.slice[i:])
	c.slice[i] = doc
}

func (c *collectStoreSlice) removeLast() *search.DocumentMatch {
	var rv *search.DocumentMatch
	rv, c.slice = c.slice[len(c.slice)-1], c.slice[:len(c.slice)-1]
	return rv
}

func (c *collectStoreSlice) Final(skip int, fixup collectorFixup) (search.DocumentMatchCollection, error) {
	for i := skip; i < len(c.slice); i++ {
		err := fixup(c.slice[i])
		if err != nil {
			return nil, err
		}
	}
	if skip <= len(c.slice) {
		return c.slice[skip:], nil
	}
	return search.DocumentMatchCollection{}, nil
}

func (c *collectStoreSlice) Internal() search.DocumentMatchCollection {
	return c.slice
}

func (c *collectStoreSlice) len() int {
	return len(c.slice)
}
