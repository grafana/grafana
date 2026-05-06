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
	"math"
	"reflect"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeTermQueryScorer int

func init() {
	var tqs TermQueryScorer
	reflectStaticSizeTermQueryScorer = int(reflect.TypeOf(tqs).Size())
}

type TermQueryScorer struct {
	queryTerm              string
	queryField             string
	queryBoost             float64
	docTerm                uint64 // number of documents containing the term
	docTotal               uint64 // total number of documents in the index
	avgDocLength           float64
	idf                    float64
	options                search.SearcherOptions
	idfExplanation         *search.Explanation
	includeScore           bool
	queryNorm              float64
	queryWeight            float64
	queryWeightExplanation *search.Explanation
}

func (s *TermQueryScorer) Size() int {
	sizeInBytes := reflectStaticSizeTermQueryScorer + size.SizeOfPtr +
		len(s.queryTerm) + len(s.queryField)

	if s.idfExplanation != nil {
		sizeInBytes += s.idfExplanation.Size()
	}

	if s.queryWeightExplanation != nil {
		sizeInBytes += s.queryWeightExplanation.Size()
	}

	return sizeInBytes
}

func (s *TermQueryScorer) computeIDF(avgDocLength float64, docTotal, docTerm uint64) float64 {
	var rv float64
	if avgDocLength > 0 {
		// avgDocLength is set only for bm25 scoring
		rv = math.Log(1 + (float64(docTotal)-float64(docTerm)+0.5)/
			(float64(docTerm)+0.5))
	} else {
		rv = 1.0 + math.Log(float64(docTotal)/
			float64(docTerm+1.0))
	}

	return rv
}

// queryTerm - the specific term being scored by this scorer object
// queryField - the field in which the term is being searched
// queryBoost - the boost value for the query term
// docTotal - total number of documents in the index
// docTerm - number of documents containing the term
// avgDocLength - average document length in the index
// options - search options such as explain scoring, include the location of the term etc.
func NewTermQueryScorer(queryTerm []byte, queryField string, queryBoost float64, docTotal,
	docTerm uint64, avgDocLength float64, options search.SearcherOptions) *TermQueryScorer {

	rv := TermQueryScorer{
		queryTerm:    string(queryTerm),
		queryField:   queryField,
		queryBoost:   queryBoost,
		docTerm:      docTerm,
		docTotal:     docTotal,
		avgDocLength: avgDocLength,
		options:      options,
		queryWeight:  1.0,
		includeScore: options.Score != "none",
	}

	rv.idf = rv.computeIDF(avgDocLength, docTotal, docTerm)
	if options.Explain {
		rv.idfExplanation = &search.Explanation{
			Value:   rv.idf,
			Message: fmt.Sprintf("idf(docFreq=%d, maxDocs=%d)", docTerm, docTotal),
		}
	}

	return &rv
}

func (s *TermQueryScorer) Weight() float64 {
	sum := s.queryBoost * s.idf
	return sum * sum
}

func (s *TermQueryScorer) SetQueryNorm(qnorm float64) {
	s.queryNorm = qnorm

	// update the query weight
	s.queryWeight = s.queryBoost * s.idf * s.queryNorm

	if s.options.Explain {
		childrenExplanations := make([]*search.Explanation, 3)
		childrenExplanations[0] = &search.Explanation{
			Value:   s.queryBoost,
			Message: "boost",
		}
		childrenExplanations[1] = s.idfExplanation
		childrenExplanations[2] = &search.Explanation{
			Value:   s.queryNorm,
			Message: "queryNorm",
		}
		s.queryWeightExplanation = &search.Explanation{
			Value:    s.queryWeight,
			Message:  fmt.Sprintf("queryWeight(%s:%s^%f), product of:", s.queryField, s.queryTerm, s.queryBoost),
			Children: childrenExplanations,
		}
	}
}

func (s *TermQueryScorer) docScore(tf, norm float64) (score float64, model string) {
	if s.avgDocLength > 0 {
		// bm25 scoring
		// using the posting's norm value to recompute the field length for the doc num
		fieldLength := 1 / (norm * norm)

		score = s.idf * (tf * search.BM25_k1) /
			(tf + search.BM25_k1*(1-search.BM25_b+(search.BM25_b*fieldLength/s.avgDocLength)))
		model = index.BM25Scoring
	} else {
		// tf-idf scoring by default
		score = tf * norm * s.idf
		model = index.DefaultScoringModel
	}
	return score, model
}

func (s *TermQueryScorer) scoreExplanation(tf float64, termMatch *index.TermFieldDoc) []*search.Explanation {
	var rv []*search.Explanation
	if s.avgDocLength > 0 {
		fieldLength := 1 / (termMatch.Norm * termMatch.Norm)
		fieldNormVal := 1 - search.BM25_b + (search.BM25_b * fieldLength / s.avgDocLength)
		fieldNormalizeExplanation := &search.Explanation{
			Value: fieldNormVal,
			Message: fmt.Sprintf("fieldNorm(field=%s), b=%f, fieldLength=%f, avgFieldLength=%f)",
				s.queryField, search.BM25_b, fieldLength, s.avgDocLength),
		}

		saturationExplanation := &search.Explanation{
			Value: search.BM25_k1 / (tf + search.BM25_k1*fieldNormVal),
			Message: fmt.Sprintf("saturation(term:%s), k1=%f/(tf=%f + k1*fieldNorm=%f))",
				termMatch.Term, search.BM25_k1, tf, fieldNormVal),
			Children: []*search.Explanation{fieldNormalizeExplanation},
		}

		rv = make([]*search.Explanation, 3)
		rv[0] = &search.Explanation{
			Value:   tf,
			Message: fmt.Sprintf("tf(termFreq(%s:%s)=%d", s.queryField, s.queryTerm, termMatch.Freq),
		}
		rv[1] = saturationExplanation
		rv[2] = s.idfExplanation
	} else {
		rv = make([]*search.Explanation, 3)
		rv[0] = &search.Explanation{
			Value:   tf,
			Message: fmt.Sprintf("tf(termFreq(%s:%s)=%d", s.queryField, s.queryTerm, termMatch.Freq),
		}
		rv[1] = &search.Explanation{
			Value:   termMatch.Norm,
			Message: fmt.Sprintf("fieldNorm(field=%s, doc=%s)", s.queryField, termMatch.ID),
		}
		rv[2] = s.idfExplanation
	}
	return rv
}

func (s *TermQueryScorer) Score(ctx *search.SearchContext, termMatch *index.TermFieldDoc) *search.DocumentMatch {
	rv := ctx.DocumentMatchPool.Get()
	// perform any score computations only when needed
	if s.includeScore || s.options.Explain {
		var scoreExplanation *search.Explanation
		var tf float64
		if termMatch.Freq < MaxSqrtCache {
			tf = SqrtCache[int(termMatch.Freq)]
		} else {
			tf = math.Sqrt(float64(termMatch.Freq))
		}

		score, scoringModel := s.docScore(tf, termMatch.Norm)
		if s.options.Explain {
			childrenExplanations := s.scoreExplanation(tf, termMatch)
			scoreExplanation = &search.Explanation{
				Value: score,
				Message: fmt.Sprintf("fieldWeight(%s:%s in %s), as per %s model, "+
					"product of:", s.queryField, s.queryTerm, termMatch.ID, scoringModel),
				Children: childrenExplanations,
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
					Message:  fmt.Sprintf("weight(%s:%s^%f in %s), product of:", s.queryField, s.queryTerm, s.queryBoost, termMatch.ID),
					Children: childExplanations,
				}
			}
		}

		if s.includeScore {
			rv.Score = score
		}

		if s.options.Explain {
			rv.Expl = scoreExplanation
		}
	}

	rv.IndexInternalID = append(rv.IndexInternalID, termMatch.ID...)

	if len(termMatch.Vectors) > 0 {
		if cap(rv.FieldTermLocations) < len(termMatch.Vectors) {
			rv.FieldTermLocations = make([]search.FieldTermLocation, 0, len(termMatch.Vectors))
		}

		for _, v := range termMatch.Vectors {
			var ap search.ArrayPositions
			if len(v.ArrayPositions) > 0 {
				n := len(rv.FieldTermLocations)
				if n < cap(rv.FieldTermLocations) { // reuse ap slice if available
					ap = rv.FieldTermLocations[:n+1][n].Location.ArrayPositions[:0]
				}
				ap = append(ap, v.ArrayPositions...)
			}
			rv.FieldTermLocations =
				append(rv.FieldTermLocations, search.FieldTermLocation{
					Field: v.Field,
					Term:  s.queryTerm,
					Location: search.Location{
						Pos:            v.Pos,
						Start:          v.Start,
						End:            v.End,
						ArrayPositions: ap,
					},
				})
		}
	}
	return rv
}
