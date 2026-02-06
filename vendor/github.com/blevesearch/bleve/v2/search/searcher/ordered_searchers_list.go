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

package searcher

import (
	"github.com/blevesearch/bleve/v2/search"
)

type OrderedSearcherList []search.Searcher

// sort.Interface

func (otrl OrderedSearcherList) Len() int {
	return len(otrl)
}

func (otrl OrderedSearcherList) Less(i, j int) bool {
	return otrl[i].Count() < otrl[j].Count()
}

func (otrl OrderedSearcherList) Swap(i, j int) {
	otrl[i], otrl[j] = otrl[j], otrl[i]
}

type OrderedPositionalSearcherList struct {
	searchers []search.Searcher
	index     []int
}

// sort.Interface

func (otrl OrderedPositionalSearcherList) Len() int {
	return len(otrl.searchers)
}

func (otrl OrderedPositionalSearcherList) Less(i, j int) bool {
	return otrl.searchers[i].Count() < otrl.searchers[j].Count()
}

func (otrl OrderedPositionalSearcherList) Swap(i, j int) {
	otrl.searchers[i], otrl.searchers[j] = otrl.searchers[j], otrl.searchers[i]
	otrl.index[i], otrl.index[j] = otrl.index[j], otrl.index[i]
}
