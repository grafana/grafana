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

package highlight

import (
	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

type Fragment struct {
	Orig           []byte
	ArrayPositions []uint64
	Start          int
	End            int
	Score          float64
	Index          int // used by heap
}

func (f *Fragment) Overlaps(other *Fragment) bool {
	if other.Start >= f.Start && other.Start < f.End {
		return true
	} else if f.Start >= other.Start && f.Start < other.End {
		return true
	}
	return false
}

type Fragmenter interface {
	Fragment([]byte, TermLocations) []*Fragment
}

type FragmentFormatter interface {
	Format(f *Fragment, orderedTermLocations TermLocations) string
}

type FragmentScorer interface {
	Score(f *Fragment) float64
}

type Highlighter interface {
	Fragmenter() Fragmenter
	SetFragmenter(Fragmenter)

	FragmentFormatter() FragmentFormatter
	SetFragmentFormatter(FragmentFormatter)

	Separator() string
	SetSeparator(string)

	BestFragmentInField(*search.DocumentMatch, index.Document, string) string
	BestFragmentsInField(*search.DocumentMatch, index.Document, string, int) []string
}
