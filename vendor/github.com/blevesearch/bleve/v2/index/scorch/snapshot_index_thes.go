//  Copyright (c) 2024 Couchbase, Inc.
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

package scorch

import (
	"container/heap"

	index "github.com/blevesearch/bleve_index_api"
	segment "github.com/blevesearch/scorch_segment_api/v2"
)

type segmentThesCursor struct {
	thes segment.Thesaurus
	itr  segment.ThesaurusIterator
	curr index.ThesaurusEntry
}

type IndexSnapshotThesaurusKeys struct {
	snapshot *IndexSnapshot
	cursors  []*segmentThesCursor
	entry    index.ThesaurusEntry
}

func (i *IndexSnapshotThesaurusKeys) Len() int { return len(i.cursors) }
func (i *IndexSnapshotThesaurusKeys) Less(a, b int) bool {
	return i.cursors[a].curr.Term < i.cursors[b].curr.Term
}
func (i *IndexSnapshotThesaurusKeys) Swap(a, b int) {
	i.cursors[a], i.cursors[b] = i.cursors[b], i.cursors[a]
}

func (i *IndexSnapshotThesaurusKeys) Push(x interface{}) {
	i.cursors = append(i.cursors, x.(*segmentThesCursor))
}

func (i *IndexSnapshotThesaurusKeys) Pop() interface{} {
	n := len(i.cursors)
	x := i.cursors[n-1]
	i.cursors = i.cursors[0 : n-1]
	return x
}

func (i *IndexSnapshotThesaurusKeys) Next() (*index.ThesaurusEntry, error) {
	if len(i.cursors) == 0 {
		return nil, nil
	}
	i.entry = i.cursors[0].curr
	next, err := i.cursors[0].itr.Next()
	if err != nil {
		return nil, err
	}
	if next == nil {
		// at end of this cursor, remove it
		heap.Pop(i)
	} else {
		// modified heap, fix it
		i.cursors[0].curr = *next
		heap.Fix(i, 0)
	}
	// look for any other entries with the exact same term
	for len(i.cursors) > 0 && i.cursors[0].curr.Term == i.entry.Term {
		next, err := i.cursors[0].itr.Next()
		if err != nil {
			return nil, err
		}
		if next == nil {
			// at end of this cursor, remove it
			heap.Pop(i)
		} else {
			// modified heap, fix it
			i.cursors[0].curr = *next
			heap.Fix(i, 0)
		}
	}

	return &i.entry, nil
}

func (i *IndexSnapshotThesaurusKeys) Close() error {
	return nil
}

func (i *IndexSnapshotThesaurusKeys) Contains(key []byte) (bool, error) {
	if len(i.cursors) == 0 {
		return false, nil
	}

	for _, cursor := range i.cursors {
		if found, _ := cursor.thes.Contains(key); found {
			return true, nil
		}
	}

	return false, nil
}
