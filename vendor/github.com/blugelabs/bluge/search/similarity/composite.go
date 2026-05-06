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

package similarity

import (
	"github.com/blugelabs/bluge/search"
)

type CompositeSumScorer struct {
	boost float64
}

func NewCompositeSumScorer() *CompositeSumScorer {
	return &CompositeSumScorer{
		boost: 1.0,
	}
}

func NewCompositeSumScorerWithBoost(boost float64) *CompositeSumScorer {
	return &CompositeSumScorer{
		boost: boost,
	}
}

func (c *CompositeSumScorer) ScoreComposite(constituents []*search.DocumentMatch) float64 {
	var rv float64
	for _, constituent := range constituents {
		rv += constituent.Score
	}
	return rv * c.boost
}

func (c *CompositeSumScorer) ExplainComposite(constituents []*search.DocumentMatch) *search.Explanation {
	var sum float64
	var children []*search.Explanation
	for _, constituent := range constituents {
		sum += constituent.Score
		children = append(children, constituent.Explanation)
	}
	if c.boost == 1 {
		return search.NewExplanation(sum,
			"sum of:",
			children...)
	}

	return search.NewExplanation(sum*c.boost,
		"computed as boost * sum",
		search.NewExplanation(c.boost, "boost"),
		search.NewExplanation(sum,
			"sum of:",
			children...))
}
