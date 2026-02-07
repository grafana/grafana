//  Copyright (c) 2025 Couchbase, Inc.
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

package bleve

import (
	"github.com/blevesearch/bleve/v2/fusion"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
)

const (
	DefaultScoreRankConstant = 60
)

// Rescorer is applied after all the query and knn results are obtained.
// The main use of Rescorer is in hybrid search; all the individual scores
// for query and knn are combined using Rescorer. Makes use of algorithms
// defined in `fusion`
type rescorer struct {
	req *SearchRequest

	// Stores the original From, Size and Boost parameters from the request
	origFrom   int
	origSize   int
	origBoosts []float64

	// Flag variable to make sure that restoreSearchRequest is only run once
	// when it is deferred
	restored bool
}

// Stores information about the hybrid search into FusionRescorer.
// Also mutates the SearchRequest by:
// - Setting boosts to 1: top level boosts only used for rescoring
// - Setting From and Size to 0 and ScoreWindowSize
func (r *rescorer) prepareSearchRequest() error {
	if r.req.Params == nil {
		r.req.Params = NewDefaultParams(r.req.From, r.req.Size)
	}

	r.origFrom = r.req.From
	r.origSize = r.req.Size

	r.req.From = 0
	r.req.Size = r.req.Params.ScoreWindowSize

	// req.Query's top level boost comes first, followed by the KNN queries
	numQueries := numKNNQueries(r.req) + 1
	r.origBoosts = make([]float64, numQueries)

	// only modify queries if it is boostable. If not, ignore
	if bQuery, ok := r.req.Query.(query.BoostableQuery); ok {
		r.origBoosts[0] = bQuery.Boost()
		bQuery.SetBoost(1.0)
	} else {
		r.origBoosts[0] = 1.0
	}

	// for all the knn queries, replace boost values
	r.prepareKnnRequest()

	return nil
}

func (r *rescorer) restoreSearchRequest() {
	// Skip if already restored
	if r.restored {
		return
	}
	r.restored = true

	r.req.From = r.origFrom
	r.req.Size = r.origSize

	if bQuery, ok := r.req.Query.(query.BoostableQuery); ok {
		bQuery.SetBoost(r.origBoosts[0])
	}

	// for all the knn queries, restore boost values
	r.restoreKnnRequest()
}

func (r *rescorer) rescore(ftsHits, knnHits search.DocumentMatchCollection) (search.DocumentMatchCollection, uint64, float64) {
	mergedHits := r.mergeDocs(ftsHits, knnHits)

	var fusionResult *fusion.FusionResult

	switch r.req.Score {
	case ScoreRRF:
		fusionResult = fusion.ReciprocalRankFusion(
			mergedHits,
			r.origBoosts,
			r.req.Params.ScoreRankConstant,
			r.req.Params.ScoreWindowSize,
			numKNNQueries(r.req),
			r.req.Explain,
		)
	case ScoreRSF:
		fusionResult = fusion.RelativeScoreFusion(
			mergedHits,
			r.origBoosts,
			r.req.Params.ScoreWindowSize,
			numKNNQueries(r.req),
			r.req.Explain,
		)
	}

	return fusionResult.Hits, fusionResult.Total, fusionResult.MaxScore
}

// Merge all the FTS and KNN docs along with explanations
func (r *rescorer) mergeDocs(ftsHits, knnHits search.DocumentMatchCollection) search.DocumentMatchCollection {
	if len(knnHits) == 0 {
		return ftsHits
	}

	knnHitMap := make(map[string]*search.DocumentMatch, len(knnHits))

	for _, hit := range knnHits {
		knnHitMap[hit.ID] = hit
	}

	for _, hit := range ftsHits {
		if knnHit, ok := knnHitMap[hit.ID]; ok {
			hit.ScoreBreakdown = knnHit.ScoreBreakdown
			if r.req.Explain {
				hit.Expl = &search.Explanation{Value: 0.0, Message: "", Children: append([]*search.Explanation{hit.Expl}, knnHit.Expl.Children...)}
			}
			delete(knnHitMap, hit.ID)
		}
	}

	for _, hit := range knnHitMap {
		hit.Score = 0
		ftsHits = append(ftsHits, hit)
		if r.req.Explain {
			hit.Expl = &search.Explanation{Value: 0.0, Message: "", Children: append([]*search.Explanation{nil}, hit.Expl.Children...)}
		}
	}

	return ftsHits
}

func newRescorer(req *SearchRequest) *rescorer {
	return &rescorer{
		req: req,
	}
}
