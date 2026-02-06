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

package query

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/searcher"
	index "github.com/blevesearch/bleve_index_api"
)

type KNNQuery struct {
	VectorField string    `json:"field"`
	Vector      []float32 `json:"vector"`
	K           int64     `json:"k"`
	BoostVal    *Boost    `json:"boost,omitempty"`

	// see KNNRequest.Params for description
	Params json.RawMessage `json:"params"`
	// elegibleSelector is used to filter out documents that are
	// eligible for the KNN search from a pre-filter query.
	elegibleSelector index.EligibleDocumentSelector
}

func NewKNNQuery(vector []float32) *KNNQuery {
	return &KNNQuery{Vector: vector}
}

func (q *KNNQuery) Field() string {
	return q.VectorField
}

func (q *KNNQuery) SetK(k int64) {
	q.K = k
}

func (q *KNNQuery) SetField(field string) {
	q.VectorField = field
}

func (q *KNNQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *KNNQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *KNNQuery) SetParams(params json.RawMessage) {
	q.Params = params
}

func (q *KNNQuery) SetEligibleSelector(eligibleSelector index.EligibleDocumentSelector) {
	q.elegibleSelector = eligibleSelector
}

func (q *KNNQuery) Searcher(ctx context.Context, i index.IndexReader,
	m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	fieldMapping := m.FieldMappingForPath(q.VectorField)
	similarityMetric := fieldMapping.Similarity
	if similarityMetric == "" {
		similarityMetric = index.DefaultVectorSimilarityMetric
	}
	if q.K <= 0 || len(q.Vector) == 0 {
		return nil, fmt.Errorf("k must be greater than 0 and vector must be non-empty")
	}
	if similarityMetric == index.CosineSimilarity {
		// normalize the vector
		q.Vector = mapping.NormalizeVector(q.Vector)
	}

	return searcher.NewKNNSearcher(ctx, i, m, options, q.VectorField,
		q.Vector, q.K, q.BoostVal.Value(), similarityMetric, q.Params,
		q.elegibleSelector)
}
