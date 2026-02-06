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
)

var reflectStaticSizeDisjunctionQueryScorer int

func init() {
	var dqs DisjunctionQueryScorer
	reflectStaticSizeDisjunctionQueryScorer = int(reflect.TypeOf(dqs).Size())
}

type DisjunctionQueryScorer struct {
	options search.SearcherOptions
}

func (s *DisjunctionQueryScorer) Size() int {
	return reflectStaticSizeDisjunctionQueryScorer + size.SizeOfPtr
}

func NewDisjunctionQueryScorer(options search.SearcherOptions) *DisjunctionQueryScorer {
	return &DisjunctionQueryScorer{
		options: options,
	}
}

func (s *DisjunctionQueryScorer) Score(ctx *search.SearchContext, constituents []*search.DocumentMatch, countMatch, countTotal int) *search.DocumentMatch {
	var sum float64
	var childrenExplanations []*search.Explanation
	if s.options.Explain {
		childrenExplanations = make([]*search.Explanation, len(constituents))
	}

	for i, docMatch := range constituents {
		sum += docMatch.Score
		if s.options.Explain {
			childrenExplanations[i] = docMatch.Expl
		}
	}

	var rawExpl *search.Explanation
	if s.options.Explain {
		rawExpl = &search.Explanation{Value: sum, Message: "sum of:", Children: childrenExplanations}
	}

	coord := float64(countMatch) / float64(countTotal)
	newScore := sum * coord
	var newExpl *search.Explanation
	if s.options.Explain {
		ce := make([]*search.Explanation, 2)
		ce[0] = rawExpl
		ce[1] = &search.Explanation{Value: coord, Message: fmt.Sprintf("coord(%d/%d)", countMatch, countTotal)}
		newExpl = &search.Explanation{Value: newScore, Message: "product of:", Children: ce, PartialMatch: countMatch != countTotal}
	}

	// reuse constituents[0] as the return value
	rv := constituents[0]
	rv.Score = newScore
	rv.Expl = newExpl
	rv.FieldTermLocations = search.MergeFieldTermLocations(
		rv.FieldTermLocations, constituents[1:])

	return rv
}

// This method is used only when disjunction searcher is used over multiple
// KNN searchers, where only the score breakdown and the optional explanation breakdown
// is required. The final score and explanation is set when we finalize the KNN hits.
func (s *DisjunctionQueryScorer) ScoreAndExplBreakdown(ctx *search.SearchContext, constituents []*search.DocumentMatch,
	matchingIdxs []int, originalPositions []int, countTotal int) *search.DocumentMatch {

	rv := constituents[0]
	if rv.ScoreBreakdown == nil {
		rv.ScoreBreakdown = make(map[int]float64, len(constituents))
	}
	var childrenExplanations []*search.Explanation
	if s.options.Explain {
		// since we want to notify which expl belongs to which matched searcher within the disjunction searcher
		childrenExplanations = make([]*search.Explanation, countTotal)
	}

	for i, docMatch := range constituents {
		var index int
		if originalPositions != nil {
			// scorer used in disjunction slice searcher
			index = originalPositions[matchingIdxs[i]]
		} else {
			// scorer used in disjunction heap searcher
			index = matchingIdxs[i]
		}
		rv.ScoreBreakdown[index] = docMatch.Score
		if s.options.Explain {
			childrenExplanations[index] = docMatch.Expl
		}
	}
	var explBreakdown *search.Explanation
	if s.options.Explain {
		explBreakdown = &search.Explanation{Children: childrenExplanations}
	}
	rv.Expl = explBreakdown
	rv.FieldTermLocations = search.MergeFieldTermLocations(
		rv.FieldTermLocations, constituents[1:])
	return rv
}
