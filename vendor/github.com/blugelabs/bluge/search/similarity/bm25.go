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
	"fmt"
	"math"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/blugelabs/bluge/search"
)

const defaultB = 0.75
const defaultK1 = 1.2

type BM25Similarity struct {
	b  float64
	k1 float64
}

func NewBM25Similarity() *BM25Similarity {
	return NewBM25SimilarityBK1(defaultB, defaultK1)
}

func NewBM25SimilarityBK1(b, k1 float64) *BM25Similarity {
	return &BM25Similarity{
		b:  b,
		k1: k1,
	}
}

// fixme chec normbits1hit in zap

func (b *BM25Similarity) ComputeNorm(numTerms int) float32 {
	return math.Float32frombits(uint32(numTerms))
}

func (b *BM25Similarity) Idf(docFreq, docCount uint64) float64 {
	return math.Log(1.0 + float64(docCount-docFreq) + 0.5/(float64(docFreq)+0.5))
}

func (b *BM25Similarity) IdfExplainTerm(collectionStats segment.CollectionStats, termStats segment.TermStats) *search.Explanation {
	docFreq := termStats.DocumentFrequency()
	var docCount uint64
	if collectionStats != nil {
		docCount = collectionStats.DocumentCount()
	}
	idf := b.Idf(docFreq, docCount)
	return search.NewExplanation(idf, "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
		search.NewExplanation(float64(docFreq), "n, number of documents containing term"),
		search.NewExplanation(float64(docCount), "N, total number of documents with field"))
}

func (b *BM25Similarity) AverageFieldLength(stats segment.CollectionStats) float64 {
	if stats != nil {
		return float64(stats.SumTotalTermFrequency()) / float64(stats.DocumentCount())
	}
	return 0
}

func (b *BM25Similarity) Scorer(boost float64, collectionStats segment.CollectionStats, termStats segment.TermStats) search.Scorer {
	idf := b.IdfExplainTerm(collectionStats, termStats)
	return NewBM25Scorer(boost, b.k1, b.b, b.AverageFieldLength(collectionStats), idf)
}

type BM25Scorer struct {
	boost     float64
	k1        float64
	b         float64
	avgDocLen float64
	weight    float64
	idf       *search.Explanation
}

func NewBM25Scorer(boost, k1, b, avgDocLen float64, idf *search.Explanation) *BM25Scorer {
	return &BM25Scorer{
		boost:     boost,
		k1:        k1,
		b:         b,
		avgDocLen: avgDocLen,
		idf:       idf,
		weight:    boost * idf.Value,
	}
}

func (b *BM25Scorer) Score(freq int, norm float64) float64 {
	docLen := math.Float32bits(float32(norm))
	normInverse := 1 / (b.k1 * ((1 - b.b) + b.b*float64(docLen)/b.avgDocLen))
	return b.weight - b.weight/(1+float64(freq)*normInverse)
}

func (b *BM25Scorer) explainTf(freq int, norm float64) *search.Explanation {
	docLen := math.Float32bits(float32(norm))
	normInverse := 1 / (b.k1 * ((1 - b.b) + b.b*float64(docLen)/b.avgDocLen))
	var children []*search.Explanation
	children = append(children,
		search.NewExplanation(float64(freq), "freq, occurrences of term within document"),
		search.NewExplanation(b.k1, "k1, term saturation parameter"),
		search.NewExplanation(b.b, "b, length normalization parameter"),
		search.NewExplanation(float64(docLen), "dl, length of field"),
		search.NewExplanation(b.avgDocLen, "avgdl, average length of field"))
	score := 1.0 - 1.0/(1.0+float64(freq)*normInverse)
	return search.NewExplanation(score,
		"tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
		children...)
}

const noBoost = 1.0

func (b *BM25Scorer) Explain(freq int, norm float64) *search.Explanation {
	var children = []*search.Explanation{
		b.idf,
	}
	if b.boost != noBoost {
		children = append(children, search.NewExplanation(b.boost, "boost"))
	}
	children = append(children, b.explainTf(freq, norm))
	docLen := math.Float32bits(float32(norm))
	normInverse := 1 / (b.k1 * ((1 - b.b) + b.b*float64(docLen)/b.avgDocLen))
	score := b.weight - b.weight/(1.0+float64(freq)*normInverse)
	return search.NewExplanation(score,
		fmt.Sprintf("score(freq=%d), computed as boost * idf * tf from:", freq),
		children...)
}
