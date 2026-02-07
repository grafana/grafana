// Copyright 2020 The Prometheus Authors
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

package storage

import (
	"fmt"
	"math"
	"sort"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
	"github.com/prometheus/prometheus/tsdb/chunks"
)

type SeriesEntry struct {
	Lset             labels.Labels
	SampleIteratorFn func(chunkenc.Iterator) chunkenc.Iterator
}

func (s *SeriesEntry) Labels() labels.Labels                           { return s.Lset }
func (s *SeriesEntry) Iterator(it chunkenc.Iterator) chunkenc.Iterator { return s.SampleIteratorFn(it) }

type ChunkSeriesEntry struct {
	Lset            labels.Labels
	ChunkIteratorFn func(chunks.Iterator) chunks.Iterator
}

func (s *ChunkSeriesEntry) Labels() labels.Labels                       { return s.Lset }
func (s *ChunkSeriesEntry) Iterator(it chunks.Iterator) chunks.Iterator { return s.ChunkIteratorFn(it) }

// NewListSeries returns series entry with iterator that allows to iterate over provided samples.
func NewListSeries(lset labels.Labels, s []chunks.Sample) *SeriesEntry {
	samplesS := Samples(samples(s))
	return &SeriesEntry{
		Lset: lset,
		SampleIteratorFn: func(it chunkenc.Iterator) chunkenc.Iterator {
			if lsi, ok := it.(*listSeriesIterator); ok {
				lsi.Reset(samplesS)
				return lsi
			}
			return NewListSeriesIterator(samplesS)
		},
	}
}

// NewListChunkSeriesFromSamples returns a chunk series entry that allows to iterate over provided samples.
// NOTE: It uses an inefficient chunks encoding implementation, not caring about chunk size.
// Use only for testing.
func NewListChunkSeriesFromSamples(lset labels.Labels, samples ...[]chunks.Sample) *ChunkSeriesEntry {
	chksFromSamples := make([]chunks.Meta, 0, len(samples))
	for _, s := range samples {
		cfs, err := chunks.ChunkFromSamples(s)
		if err != nil {
			return &ChunkSeriesEntry{
				Lset: lset,
				ChunkIteratorFn: func(_ chunks.Iterator) chunks.Iterator {
					return errChunksIterator{err: err}
				},
			}
		}
		chksFromSamples = append(chksFromSamples, cfs)
	}
	return &ChunkSeriesEntry{
		Lset: lset,
		ChunkIteratorFn: func(it chunks.Iterator) chunks.Iterator {
			lcsi, existing := it.(*listChunkSeriesIterator)
			var chks []chunks.Meta
			if existing {
				chks = lcsi.chks[:0]
			} else {
				chks = make([]chunks.Meta, 0, len(samples))
			}
			chks = append(chks, chksFromSamples...)
			if existing {
				lcsi.Reset(chks...)
				return lcsi
			}
			return NewListChunkSeriesIterator(chks...)
		},
	}
}

type listSeriesIterator struct {
	samples Samples
	idx     int
}

type samples []chunks.Sample

func (s samples) Get(i int) chunks.Sample { return s[i] }
func (s samples) Len() int                { return len(s) }

// Samples interface allows to work on arrays of types that are compatible with chunks.Sample.
type Samples interface {
	Get(i int) chunks.Sample
	Len() int
}

// NewListSeriesIterator returns listSeriesIterator that allows to iterate over provided samples.
func NewListSeriesIterator(samples Samples) chunkenc.Iterator {
	return &listSeriesIterator{samples: samples, idx: -1}
}

func (it *listSeriesIterator) Reset(samples Samples) {
	it.samples = samples
	it.idx = -1
}

func (it *listSeriesIterator) At() (int64, float64) {
	s := it.samples.Get(it.idx)
	return s.T(), s.F()
}

func (it *listSeriesIterator) AtHistogram(*histogram.Histogram) (int64, *histogram.Histogram) {
	s := it.samples.Get(it.idx)
	return s.T(), s.H()
}

func (it *listSeriesIterator) AtFloatHistogram(*histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	s := it.samples.Get(it.idx)
	return s.T(), s.FH()
}

func (it *listSeriesIterator) AtT() int64 {
	s := it.samples.Get(it.idx)
	return s.T()
}

func (it *listSeriesIterator) Next() chunkenc.ValueType {
	it.idx++
	if it.idx >= it.samples.Len() {
		return chunkenc.ValNone
	}
	return it.samples.Get(it.idx).Type()
}

func (it *listSeriesIterator) Seek(t int64) chunkenc.ValueType {
	if it.idx == -1 {
		it.idx = 0
	}
	if it.idx >= it.samples.Len() {
		return chunkenc.ValNone
	}
	// No-op check.
	if s := it.samples.Get(it.idx); s.T() >= t {
		return s.Type()
	}
	// Do binary search between current position and end.
	it.idx += sort.Search(it.samples.Len()-it.idx, func(i int) bool {
		s := it.samples.Get(i + it.idx)
		return s.T() >= t
	})

	if it.idx >= it.samples.Len() {
		return chunkenc.ValNone
	}
	return it.samples.Get(it.idx).Type()
}

func (it *listSeriesIterator) Err() error { return nil }

type listSeriesIteratorWithCopy struct {
	*listSeriesIterator
}

func NewListSeriesIteratorWithCopy(samples Samples) chunkenc.Iterator {
	return &listSeriesIteratorWithCopy{
		listSeriesIterator: &listSeriesIterator{samples: samples, idx: -1},
	}
}

func (it *listSeriesIteratorWithCopy) AtHistogram(h *histogram.Histogram) (int64, *histogram.Histogram) {
	t, ih := it.listSeriesIterator.AtHistogram(nil)
	if h == nil || ih == nil {
		return t, ih
	}
	ih.CopyTo(h)
	return t, h
}

func (it *listSeriesIteratorWithCopy) AtFloatHistogram(fh *histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	t, ih := it.listSeriesIterator.AtFloatHistogram(nil)
	if fh == nil || ih == nil {
		return t, ih
	}
	ih.CopyTo(fh)
	return t, fh
}

type listChunkSeriesIterator struct {
	chks []chunks.Meta
	idx  int
}

// NewListChunkSeriesIterator returns listChunkSeriesIterator that allows to iterate over provided chunks.
func NewListChunkSeriesIterator(chks ...chunks.Meta) chunks.Iterator {
	return &listChunkSeriesIterator{chks: chks, idx: -1}
}

func (it *listChunkSeriesIterator) Reset(chks ...chunks.Meta) {
	it.chks = chks
	it.idx = -1
}

func (it *listChunkSeriesIterator) At() chunks.Meta {
	return it.chks[it.idx]
}

func (it *listChunkSeriesIterator) Next() bool {
	it.idx++
	return it.idx < len(it.chks)
}

func (it *listChunkSeriesIterator) Err() error { return nil }

type chunkSetToSeriesSet struct {
	ChunkSeriesSet

	iter             chunks.Iterator
	chkIterErr       error
	sameSeriesChunks []Series
}

// NewSeriesSetFromChunkSeriesSet converts ChunkSeriesSet to SeriesSet by decoding chunks one by one.
func NewSeriesSetFromChunkSeriesSet(chk ChunkSeriesSet) SeriesSet {
	return &chunkSetToSeriesSet{ChunkSeriesSet: chk}
}

func (c *chunkSetToSeriesSet) Next() bool {
	if c.Err() != nil || !c.ChunkSeriesSet.Next() {
		return false
	}

	c.iter = c.ChunkSeriesSet.At().Iterator(c.iter)
	c.sameSeriesChunks = nil

	for c.iter.Next() {
		c.sameSeriesChunks = append(
			c.sameSeriesChunks,
			newChunkToSeriesDecoder(c.ChunkSeriesSet.At().Labels(), c.iter.At()),
		)
	}

	if c.iter.Err() != nil {
		c.chkIterErr = c.iter.Err()
		return false
	}
	return true
}

func (c *chunkSetToSeriesSet) At() Series {
	// Series composed of same chunks for the same series.
	return ChainedSeriesMerge(c.sameSeriesChunks...)
}

func (c *chunkSetToSeriesSet) Err() error {
	if c.chkIterErr != nil {
		return c.chkIterErr
	}
	return c.ChunkSeriesSet.Err()
}

func newChunkToSeriesDecoder(labels labels.Labels, chk chunks.Meta) Series {
	return &SeriesEntry{
		Lset: labels,
		SampleIteratorFn: func(it chunkenc.Iterator) chunkenc.Iterator {
			// TODO(bwplotka): Can we provide any chunkenc buffer?
			return chk.Chunk.Iterator(it)
		},
	}
}

type seriesSetToChunkSet struct {
	SeriesSet
}

// NewSeriesSetToChunkSet converts SeriesSet to ChunkSeriesSet by encoding chunks from samples.
func NewSeriesSetToChunkSet(chk SeriesSet) ChunkSeriesSet {
	return &seriesSetToChunkSet{SeriesSet: chk}
}

func (c *seriesSetToChunkSet) Next() bool {
	if c.Err() != nil || !c.SeriesSet.Next() {
		return false
	}
	return true
}

func (c *seriesSetToChunkSet) At() ChunkSeries {
	return NewSeriesToChunkEncoder(c.SeriesSet.At())
}

func (c *seriesSetToChunkSet) Err() error {
	return c.SeriesSet.Err()
}

type seriesToChunkEncoder struct {
	Series
}

const seriesToChunkEncoderSplit = 120

// NewSeriesToChunkEncoder encodes samples to chunks with 120 samples limit.
func NewSeriesToChunkEncoder(series Series) ChunkSeries {
	return &seriesToChunkEncoder{series}
}

func (s *seriesToChunkEncoder) Iterator(it chunks.Iterator) chunks.Iterator {
	var (
		chk, newChk chunkenc.Chunk
		app         chunkenc.Appender
		err         error
		recoded     bool
	)
	mint := int64(math.MaxInt64)
	maxt := int64(math.MinInt64)

	var chks []chunks.Meta
	lcsi, existing := it.(*listChunkSeriesIterator)
	if existing {
		chks = lcsi.chks[:0]
	}

	i := 0
	seriesIter := s.Series.Iterator(nil)
	lastType := chunkenc.ValNone
	for typ := seriesIter.Next(); typ != chunkenc.ValNone; typ = seriesIter.Next() {
		if typ != lastType || i >= seriesToChunkEncoderSplit {
			// Create a new chunk if the sample type changed or too many samples in the current one.
			chks = appendChunk(chks, mint, maxt, chk)
			chk, err = chunkenc.NewEmptyChunk(typ.ChunkEncoding())
			if err != nil {
				return errChunksIterator{err: err}
			}
			app, err = chk.Appender()
			if err != nil {
				return errChunksIterator{err: err}
			}
			mint = int64(math.MaxInt64)
			// maxt is immediately overwritten below which is why setting it here won't make a difference.
			i = 0
		}
		lastType = typ

		var (
			t  int64
			v  float64
			h  *histogram.Histogram
			fh *histogram.FloatHistogram
		)
		switch typ {
		case chunkenc.ValFloat:
			t, v = seriesIter.At()
			app.Append(t, v)
		case chunkenc.ValHistogram:
			t, h = seriesIter.AtHistogram(nil)
			newChk, recoded, app, err = app.AppendHistogram(nil, t, h, false)
			if err != nil {
				return errChunksIterator{err: err}
			}
			if newChk != nil {
				if !recoded {
					chks = appendChunk(chks, mint, maxt, chk)
					mint = int64(math.MaxInt64)
					// maxt is immediately overwritten below which is why setting it here won't make a difference.
					i = 0
				}
				chk = newChk
			}
		case chunkenc.ValFloatHistogram:
			t, fh = seriesIter.AtFloatHistogram(nil)
			newChk, recoded, app, err = app.AppendFloatHistogram(nil, t, fh, false)
			if err != nil {
				return errChunksIterator{err: err}
			}
			if newChk != nil {
				if !recoded {
					chks = appendChunk(chks, mint, maxt, chk)
					mint = int64(math.MaxInt64)
					// maxt is immediately overwritten below which is why setting it here won't make a difference.
					i = 0
				}
				chk = newChk
			}
		default:
			return errChunksIterator{err: fmt.Errorf("unknown sample type %s", typ.String())}
		}

		maxt = t
		if mint == math.MaxInt64 {
			mint = t
		}
		i++
	}
	if err := seriesIter.Err(); err != nil {
		return errChunksIterator{err: err}
	}

	chks = appendChunk(chks, mint, maxt, chk)

	if existing {
		lcsi.Reset(chks...)
		return lcsi
	}
	return NewListChunkSeriesIterator(chks...)
}

func appendChunk(chks []chunks.Meta, mint, maxt int64, chk chunkenc.Chunk) []chunks.Meta {
	if chk != nil {
		chks = append(chks, chunks.Meta{
			MinTime: mint,
			MaxTime: maxt,
			Chunk:   chk,
		})
	}
	return chks
}

type errChunksIterator struct {
	err error
}

func (e errChunksIterator) At() chunks.Meta { return chunks.Meta{} }
func (e errChunksIterator) Next() bool      { return false }
func (e errChunksIterator) Err() error      { return e.err }

// ExpandSamples iterates over all samples in the iterator, buffering all in slice.
// Optionally it takes samples constructor, useful when you want to compare sample slices with different
// sample implementations. if nil, sample type from this package will be used.
func ExpandSamples(iter chunkenc.Iterator, newSampleFn func(t int64, f float64, h *histogram.Histogram, fh *histogram.FloatHistogram) chunks.Sample) ([]chunks.Sample, error) {
	if newSampleFn == nil {
		newSampleFn = func(t int64, f float64, h *histogram.Histogram, fh *histogram.FloatHistogram) chunks.Sample {
			switch {
			case h != nil:
				return hSample{t, h}
			case fh != nil:
				return fhSample{t, fh}
			default:
				return fSample{t, f}
			}
		}
	}

	var result []chunks.Sample
	for {
		switch iter.Next() {
		case chunkenc.ValNone:
			return result, iter.Err()
		case chunkenc.ValFloat:
			t, f := iter.At()
			// NaNs can't be compared normally, so substitute for another value.
			if math.IsNaN(f) {
				f = -42
			}
			result = append(result, newSampleFn(t, f, nil, nil))
		case chunkenc.ValHistogram:
			t, h := iter.AtHistogram(nil)
			result = append(result, newSampleFn(t, 0, h, nil))
		case chunkenc.ValFloatHistogram:
			t, fh := iter.AtFloatHistogram(nil)
			result = append(result, newSampleFn(t, 0, nil, fh))
		}
	}
}

// ExpandChunks iterates over all chunks in the iterator, buffering all in slice.
func ExpandChunks(iter chunks.Iterator) ([]chunks.Meta, error) {
	var result []chunks.Meta
	for iter.Next() {
		result = append(result, iter.At())
	}
	return result, iter.Err()
}
