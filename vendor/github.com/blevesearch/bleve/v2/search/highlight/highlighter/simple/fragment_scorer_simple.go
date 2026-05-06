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

package simple

import (
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/highlight"
)

// FragmentScorer will score fragments by how many
// unique terms occur in the fragment with no regard for
// any boost values used in the original query
type FragmentScorer struct {
	tlm search.TermLocationMap
}

func NewFragmentScorer(tlm search.TermLocationMap) *FragmentScorer {
	return &FragmentScorer{
		tlm: tlm,
	}
}

func (s *FragmentScorer) Score(f *highlight.Fragment) {
	score := 0.0
OUTER:
	for _, locations := range s.tlm {
		for _, location := range locations {
			if location.ArrayPositions.Equals(f.ArrayPositions) && int(location.Start) >= f.Start && int(location.End) <= f.End {
				score += 1.0
				// once we find a term in the fragment
				// don't care about additional matches
				continue OUTER
			}
		}
	}
	f.Score = score
}
