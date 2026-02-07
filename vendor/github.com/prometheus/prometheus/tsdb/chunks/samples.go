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

package chunks

import (
	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
)

type Samples interface {
	Get(i int) Sample
	Len() int
}

type Sample interface {
	T() int64
	F() float64
	H() *histogram.Histogram
	FH() *histogram.FloatHistogram
	Type() chunkenc.ValueType
	Copy() Sample // Returns a deep copy.
}

type SampleSlice []Sample

func (s SampleSlice) Get(i int) Sample { return s[i] }
func (s SampleSlice) Len() int         { return len(s) }

type sample struct {
	t  int64
	f  float64
	h  *histogram.Histogram
	fh *histogram.FloatHistogram
}

func (s sample) T() int64 {
	return s.t
}

func (s sample) F() float64 {
	return s.f
}

func (s sample) H() *histogram.Histogram {
	return s.h
}

func (s sample) FH() *histogram.FloatHistogram {
	return s.fh
}

func (s sample) Type() chunkenc.ValueType {
	switch {
	case s.h != nil:
		return chunkenc.ValHistogram
	case s.fh != nil:
		return chunkenc.ValFloatHistogram
	default:
		return chunkenc.ValFloat
	}
}

func (s sample) Copy() Sample {
	c := sample{t: s.t, f: s.f}
	if s.h != nil {
		c.h = s.h.Copy()
	}
	if s.fh != nil {
		c.fh = s.fh.Copy()
	}
	return c
}

// GenerateSamples starting at start and counting up numSamples.
func GenerateSamples(start, numSamples int) []Sample {
	return generateSamples(start, numSamples, func(i int) Sample {
		return sample{
			t: int64(i),
			f: float64(i),
		}
	})
}

func generateSamples(start, numSamples int, gen func(int) Sample) []Sample {
	samples := make([]Sample, 0, numSamples)
	for i := start; i < start+numSamples; i++ {
		samples = append(samples, gen(i))
	}
	return samples
}
