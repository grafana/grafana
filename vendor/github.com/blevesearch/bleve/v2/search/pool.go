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
	"reflect"
)

var reflectStaticSizeDocumentMatchPool int

func init() {
	var dmp DocumentMatchPool
	reflectStaticSizeDocumentMatchPool = int(reflect.TypeOf(dmp).Size())
}

// DocumentMatchPoolTooSmall is a callback function that can be executed
// when the DocumentMatchPool does not have sufficient capacity
// By default we just perform just-in-time allocation, but you could log
// a message, or panic, etc.
type DocumentMatchPoolTooSmall func(p *DocumentMatchPool) *DocumentMatch

// DocumentMatchPool manages use/reuse of DocumentMatch instances
// it pre-allocates space from a single large block with the expected
// number of instances.  It is not thread-safe as currently all
// aspects of search take place in a single goroutine.
type DocumentMatchPool struct {
	avail    DocumentMatchCollection
	TooSmall DocumentMatchPoolTooSmall
}

func defaultDocumentMatchPoolTooSmall(p *DocumentMatchPool) *DocumentMatch {
	return &DocumentMatch{}
}

// NewDocumentMatchPool will build a DocumentMatchPool with memory
// pre-allocated to accommodate the requested number of DocumentMatch
// instances
func NewDocumentMatchPool(size, sortsize int) *DocumentMatchPool {
	avail := make(DocumentMatchCollection, size)
	// pre-allocate the expected number of instances
	startBlock := make([]DocumentMatch, size)
	startSorts := make([]string, size*sortsize)
	// make these initial instances available
	i, j := 0, 0
	for i < size {
		avail[i] = &startBlock[i]
		avail[i].Sort = startSorts[j:j]
		i += 1
		j += sortsize
	}
	return &DocumentMatchPool{
		avail:    avail,
		TooSmall: defaultDocumentMatchPoolTooSmall,
	}
}

// Get returns an available DocumentMatch from the pool
// if the pool was not allocated with sufficient size, an allocation will
// occur to satisfy this request.  As a side-effect this will grow the size
// of the pool.
func (p *DocumentMatchPool) Get() *DocumentMatch {
	var rv *DocumentMatch
	if len(p.avail) > 0 {
		rv, p.avail = p.avail[len(p.avail)-1], p.avail[:len(p.avail)-1]
	} else {
		rv = p.TooSmall(p)
	}
	return rv
}

// Put returns a DocumentMatch to the pool
func (p *DocumentMatchPool) Put(d *DocumentMatch) {
	if d == nil {
		return
	}
	// reset DocumentMatch before returning it to available pool
	d.Reset()
	p.avail = append(p.avail, d)
}
