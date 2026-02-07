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

package scorer

import (
	"fmt"
	"reflect"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeConstantScorer int

func init() {
	var cs ConstantScorer
	reflectStaticSizeConstantScorer = int(reflect.TypeOf(cs).Size())
}

type ConstantScorer struct {
	constant               float64
	boost                  float64
	options                search.SearcherOptions
	queryNorm              float64
	queryWeight            float64
	queryWeightExplanation *search.Explanation
	includeScore           bool
}

func (s *ConstantScorer) Size() int {
	sizeInBytes := reflectStaticSizeConstantScorer + size.SizeOfPtr

	if s.queryWeightExplanation != nil {
		sizeInBytes += s.queryWeightExplanation.Size()
	}

	return sizeInBytes
}

func NewConstantScorer(constant float64, boost float64, options search.SearcherOptions) *ConstantScorer {
	rv := ConstantScorer{
		options:      options,
		queryWeight:  1.0,
		constant:     constant,
		boost:        boost,
		includeScore: options.Score != "none",
	}

	return &rv
}

func (s *ConstantScorer) Weight() float64 {
	sum := s.boost
	return sum * sum
}

func (s *ConstantScorer) SetQueryNorm(qnorm float64) {
	s.queryNorm = qnorm

	// update the query weight
	s.queryWeight = s.boost * s.queryNorm

	if s.options.Explain {
		childrenExplanations := make([]*search.Explanation, 2)
		childrenExplanations[0] = &search.Explanation{
			Value:   s.boost,
			Message: "boost",
		}
		childrenExplanations[1] = &search.Explanation{
			Value:   s.queryNorm,
			Message: "queryNorm",
		}
		s.queryWeightExplanation = &search.Explanation{
			Value:    s.queryWeight,
			Message:  fmt.Sprintf("ConstantScore()^%f, product of:", s.boost),
			Children: childrenExplanations,
		}
	}
}

func (s *ConstantScorer) Score(ctx *search.SearchContext, id index.IndexInternalID) *search.DocumentMatch {
	var scoreExplanation *search.Explanation

	rv := ctx.DocumentMatchPool.Get()
	rv.IndexInternalID = id

	if s.includeScore {
		score := s.constant

		if s.options.Explain {
			scoreExplanation = &search.Explanation{
				Value:   score,
				Message: "ConstantScore()",
			}
		}

		// if the query weight isn't 1, multiply
		if s.queryWeight != 1.0 {
			score = score * s.queryWeight
			if s.options.Explain {
				childExplanations := make([]*search.Explanation, 2)
				childExplanations[0] = s.queryWeightExplanation
				childExplanations[1] = scoreExplanation
				scoreExplanation = &search.Explanation{
					Value:    score,
					Message:  fmt.Sprintf("weight(^%f), product of:", s.boost),
					Children: childExplanations,
				}
			}
		}

		rv.Score = score
		if s.options.Explain {
			rv.Expl = scoreExplanation
		}
	}

	return rv
}
