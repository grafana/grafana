// Copyright 2023 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package histogram

// GenerateBigTestHistograms generates a slice of histograms with given number of buckets each.
func GenerateBigTestHistograms(numHistograms, numBuckets int) []*Histogram {
	numSpans := numBuckets / 10
	bucketsPerSide := numBuckets / 2
	spanLength := uint32(bucketsPerSide / numSpans)
	// Given all bucket deltas are 1, sum bucketsPerSide + 1.
	observationCount := uint64(bucketsPerSide) * (1 + uint64(bucketsPerSide))

	var histograms []*Histogram
	for i := 0; i < numHistograms; i++ {
		h := &Histogram{
			Count:           uint64(i) + observationCount,
			ZeroCount:       uint64(i),
			ZeroThreshold:   1e-128,
			Sum:             18.4 * float64(i+1),
			Schema:          2,
			NegativeSpans:   make([]Span, numSpans),
			PositiveSpans:   make([]Span, numSpans),
			NegativeBuckets: make([]int64, bucketsPerSide),
			PositiveBuckets: make([]int64, bucketsPerSide),
		}

		for j := 0; j < numSpans; j++ {
			s := Span{Offset: 1, Length: spanLength}
			h.NegativeSpans[j] = s
			h.PositiveSpans[j] = s
		}

		for j := 0; j < bucketsPerSide; j++ {
			h.NegativeBuckets[j] = 1
			h.PositiveBuckets[j] = 1
		}

		histograms = append(histograms, h)
	}
	return histograms
}
