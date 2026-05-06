//  Copyright (c) 2023 Couchbase, Inc.
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

//go:build vectors
// +build vectors

package scorer

import (
	"fmt"
	"math"
	"reflect"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeKNNQueryScorer int

func init() {
	var sqs KNNQueryScorer
	reflectStaticSizeKNNQueryScorer = int(reflect.TypeOf(sqs).Size())
}

type KNNQueryScorer struct {
	queryVector            []float32
	queryField             string
	queryWeight            float64
	queryBoost             float64
	queryNorm              float64
	options                search.SearcherOptions
	similarityMetric       string
	queryWeightExplanation *search.Explanation
}

func (s *KNNQueryScorer) Size() int {
	sizeInBytes := reflectStaticSizeKNNQueryScorer + size.SizeOfPtr +
		(len(s.queryVector) * size.SizeOfFloat32) + len(s.queryField) +
		len(s.similarityMetric)

	if s.queryWeightExplanation != nil {
		sizeInBytes += s.queryWeightExplanation.Size()
	}

	return sizeInBytes
}

func NewKNNQueryScorer(queryVector []float32, queryField string, queryBoost float64,
	options search.SearcherOptions,
	similarityMetric string) *KNNQueryScorer {
	return &KNNQueryScorer{
		queryVector:      queryVector,
		queryField:       queryField,
		queryBoost:       queryBoost,
		queryWeight:      1.0,
		options:          options,
		similarityMetric: similarityMetric,
	}
}

// Score used when the knnMatch.Score = 0 ->
// the query and indexed vector are exactly the same.
const maxKNNScore = math.MaxFloat32

func (sqs *KNNQueryScorer) Score(ctx *search.SearchContext,
	knnMatch *index.VectorDoc) *search.DocumentMatch {
	rv := ctx.DocumentMatchPool.Get()
	var scoreExplanation *search.Explanation
	score := knnMatch.Score
	if sqs.similarityMetric == index.EuclideanDistance {
		// in case of euclidean distance being the distance metric,
		// an exact vector (perfect match), would return distance = 0
		if score == 0 {
			score = maxKNNScore
		} else {
			// euclidean distances need to be inverted to work with
			// tf-idf scoring
			score = 1.0 / score
		}
	}
	if sqs.options.Explain {
		scoreExplanation = &search.Explanation{
			Value: score,
			Message: fmt.Sprintf("fieldWeight(%s in doc %s), score of:",
				sqs.queryField, knnMatch.ID),
			Children: []*search.Explanation{
				{
					Value: score,
					Message: fmt.Sprintf("vector(field(%s:%s) with similarity_metric(%s)=%e",
						sqs.queryField, knnMatch.ID, sqs.similarityMetric, score),
				},
			},
		}
	}
	// if the query weight isn't 1, multiply
	if sqs.queryWeight != 1.0 && score != maxKNNScore {
		score = score * sqs.queryWeight
		if sqs.options.Explain {
			scoreExplanation = &search.Explanation{
				Value: score,
				// Product of score * weight
				// Avoid adding the query vector to the explanation since vectors
				// can get quite large.
				Message: fmt.Sprintf("weight(%s:query Vector^%f in %s), product of:",
					sqs.queryField, sqs.queryBoost, knnMatch.ID),
				Children: []*search.Explanation{sqs.queryWeightExplanation, scoreExplanation},
			}
		}
	}
	rv.Score = score
	if sqs.options.Explain {
		rv.Expl = scoreExplanation
	}
	rv.IndexInternalID = append(rv.IndexInternalID, knnMatch.ID...)
	return rv
}

func (sqs *KNNQueryScorer) Weight() float64 {
	return 1.0
}

func (sqs *KNNQueryScorer) SetQueryNorm(qnorm float64) {
	sqs.queryNorm = qnorm

	// update the query weight
	sqs.queryWeight = sqs.queryBoost * sqs.queryNorm

	if sqs.options.Explain {
		childrenExplanations := make([]*search.Explanation, 2)
		childrenExplanations[0] = &search.Explanation{
			Value:   sqs.queryBoost,
			Message: "boost",
		}
		childrenExplanations[1] = &search.Explanation{
			Value:   sqs.queryNorm,
			Message: "queryNorm",
		}
		sqs.queryWeightExplanation = &search.Explanation{
			Value: sqs.queryWeight,
			Message: fmt.Sprintf("queryWeight(%s:query Vector^%f), product of:",
				sqs.queryField, sqs.queryBoost),
			Children: childrenExplanations,
		}
	}
}
