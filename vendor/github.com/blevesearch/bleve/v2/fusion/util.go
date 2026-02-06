//  Copyright (c) 2025 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package fusion

import (
	"sort"

	"github.com/blevesearch/bleve/v2/search"
)

// sortDocMatchesByScore orders the provided collection in-place by the primary
// score in descending order, breaking ties with the original `HitNumber` to
// ensure deterministic output.
func sortDocMatchesByScore(hits search.DocumentMatchCollection) {
	if len(hits) < 2 {
		return
	}

	sort.Slice(hits, func(a, b int) bool {
		i := hits[a]
		j := hits[b]
		if i.Score == j.Score {
			return i.HitNumber < j.HitNumber
		}
		return i.Score > j.Score
	})
}

// scoreBreakdownForQuery fetches the score for a specific KNN query index from
// the provided hit. The boolean return indicates whether the score is present.
func scoreBreakdownForQuery(hit *search.DocumentMatch, idx int) (float64, bool) {
	if hit == nil || hit.ScoreBreakdown == nil {
		return 0, false
	}

	score, ok := hit.ScoreBreakdown[idx]
	return score, ok
}

// sortDocMatchesByBreakdown orders the hits in-place using the KNN score for
// the supplied query index (descending), breaking ties with `HitNumber` and
// placing hits without a score at the end.
func sortDocMatchesByBreakdown(hits search.DocumentMatchCollection, queryIdx int) {
	if len(hits) < 2 {
		return
	}

	sort.SliceStable(hits, func(a, b int) bool {
		left := hits[a]
		right := hits[b]

		var leftScore float64
		leftOK := false
		if left != nil && left.ScoreBreakdown != nil {
			leftScore, leftOK = left.ScoreBreakdown[queryIdx]
		}

		var rightScore float64
		rightOK := false
		if right != nil && right.ScoreBreakdown != nil {
			rightScore, rightOK = right.ScoreBreakdown[queryIdx]
		}

		if leftOK && rightOK {
			if leftScore == rightScore {
				return left.HitNumber < right.HitNumber
			}
			return leftScore > rightScore
		}

		if leftOK != rightOK {
			return leftOK
		}

		return left.HitNumber < right.HitNumber
	})
}

// getFusionExplAt copies the existing explanation child at the requested index
// and wraps it in a new node describing how the fusion algorithm adjusted the
// score.
func getFusionExplAt(hit *search.DocumentMatch, i int, value float64, message string) *search.Explanation {
	return &search.Explanation{
		Value:    value,
		Message:  message,
		Children: []*search.Explanation{hit.Expl.Children[i]},
	}
}

// finalizeFusionExpl installs the collection of fusion explanation children and
// updates the root message so the caller sees the fused score as the sum of its
// parts.
func finalizeFusionExpl(hit *search.DocumentMatch, explChildren []*search.Explanation) {
	hit.Expl.Children = explChildren

	hit.Expl.Value = hit.Score
	hit.Expl.Message = "sum of"
}
