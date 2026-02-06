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
	"fmt"

	"github.com/blevesearch/bleve/v2/search"
)

// formatRRFMessage builds the explanation string for a single component of the
// Reciprocal Rank Fusion calculation.
func formatRRFMessage(weight float64, rank int, rankConstant int) string {
	return fmt.Sprintf("rrf score (weight=%.3f, rank=%d, rank_constant=%d), normalized score of", weight, rank, rankConstant)
}

// ReciprocalRankFusion applies Reciprocal Rank Fusion across the primary FTS
// results and each KNN sub-query. Ranks are limited to `windowSize` per source,
// weighted, and combined into a single fused score, with optional explanation
// details.
func ReciprocalRankFusion(hits search.DocumentMatchCollection, weights []float64, rankConstant int, windowSize int, numKNNQueries int, explain bool) *FusionResult {
	nHits := len(hits)
	if nHits == 0 || windowSize == 0 {
		return &FusionResult{
			Hits:     search.DocumentMatchCollection{},
			Total:    0,
			MaxScore: 0.0,
		}
	}

	limit := min(nHits, windowSize)

	// precompute rank+scores to prevent additional division ops later
	rankReciprocals := make([]float64, limit)
	for i := range rankReciprocals {
		rankReciprocals[i] = 1.0 / float64(rankConstant+i+1)
	}

	// init explanations if required
	var fusionExpl map[*search.DocumentMatch][]*search.Explanation
	if explain {
		fusionExpl = make(map[*search.DocumentMatch][]*search.Explanation, nHits)
	}

	// The code here mainly deals with obtaining rank/score for fts hits.
	// First sort hits by score
	sortDocMatchesByScore(hits)

	// Calculate fts rank+scores
	ftsWeight := weights[0]
	for i := 0; i < nHits; i++ {
		if i < windowSize {
			hit := hits[i]

			// No fts scores from this hit onwards, break loop
			if hit.Score == 0.0 {
				break
			}

			contrib := ftsWeight * rankReciprocals[i]
			hit.Score = contrib

			if explain {
				expl := getFusionExplAt(
					hit,
					0,
					contrib,
					formatRRFMessage(ftsWeight, i+1, rankConstant),
				)
				fusionExpl[hit] = append(fusionExpl[hit], expl)
			}
		} else {
			// These FTS hits are not counted in the results, so set to 0
			hits[i].Score = 0.0
		}
	}

	// Code from here is to calculate knn ranks and scores
	// iterate over each knn query and calculate knn rank+scores
	for queryIdx := 0; queryIdx < numKNNQueries; queryIdx++ {
		knnWeight := weights[queryIdx+1]
		// Sorts hits in decreasing order of hit.ScoreBreakdown[i]
		sortDocMatchesByBreakdown(hits, queryIdx)

		for i := 0; i < nHits; i++ {
			// break if score breakdown doesn't exist (sort function puts these hits at the end)
			// or if we go past the windowSize
			_, scoreBreakdownExists := scoreBreakdownForQuery(hits[i], queryIdx)
			if i >= windowSize || !scoreBreakdownExists {
				break
			}

			hit := hits[i]
			contrib := knnWeight * rankReciprocals[i]
			hit.Score += contrib

			if explain {
				expl := getFusionExplAt(
					hit,
					queryIdx+1,
					contrib,
					formatRRFMessage(knnWeight, i+1, rankConstant),
				)
				fusionExpl[hit] = append(fusionExpl[hit], expl)
			}
		}
	}

	var maxScore float64
	for _, hit := range hits {
		if explain {
			finalizeFusionExpl(hit, fusionExpl[hit])
		}
		hit.ScoreBreakdown = nil

		if hit.Score > maxScore {
			maxScore = hit.Score
		}
	}

	sortDocMatchesByScore(hits)
	if nHits > windowSize {
		hits = hits[:windowSize]
	}
	return &FusionResult{
		Hits:     hits,
		Total:    uint64(len(hits)),
		MaxScore: maxScore,
	}
}
