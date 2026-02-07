// Copyright 2017 The Prometheus Authors
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

package chunkenc

import (
	"fmt"
	"math"
	"sync"

	"github.com/prometheus/prometheus/model/histogram"
)

// Encoding is the identifier for a chunk encoding.
type Encoding uint8

// The different available chunk encodings.
const (
	EncNone Encoding = iota
	EncXOR
	EncHistogram
	EncFloatHistogram
)

func (e Encoding) String() string {
	switch e {
	case EncNone:
		return "none"
	case EncXOR:
		return "XOR"
	case EncHistogram:
		return "histogram"
	case EncFloatHistogram:
		return "floathistogram"
	}
	return "<unknown>"
}

// IsValidEncoding returns true for supported encodings.
func IsValidEncoding(e Encoding) bool {
	return e == EncXOR || e == EncHistogram || e == EncFloatHistogram
}

const (
	// MaxBytesPerXORChunk is the maximum size an XOR chunk can be.
	MaxBytesPerXORChunk = 1024
	// TargetBytesPerHistogramChunk sets a size target for each histogram chunk.
	TargetBytesPerHistogramChunk = 1024
	// MinSamplesPerHistogramChunk sets a minimum sample count for histogram chunks. This is desirable because a single
	// histogram sample can be larger than TargetBytesPerHistogramChunk but we want to avoid too-small sample count
	// chunks so we can achieve some measure of compression advantage even while dealing with really large histograms.
	// Note that this minimum sample count is not enforced across chunk range boundaries (for example, if the chunk
	// range is 100 and the first sample in the chunk range is 99, the next sample will be included in a new chunk
	// resulting in the old chunk containing only a single sample).
	MinSamplesPerHistogramChunk = 10
)

// Chunk holds a sequence of sample pairs that can be iterated over and appended to.
type Chunk interface {
	Iterable

	// Bytes returns the underlying byte slice of the chunk.
	Bytes() []byte

	// Encoding returns the encoding type of the chunk.
	Encoding() Encoding

	// Appender returns an appender to append samples to the chunk.
	Appender() (Appender, error)

	// NumSamples returns the number of samples in the chunk.
	NumSamples() int

	// Compact is called whenever a chunk is expected to be complete (no more
	// samples appended) and the underlying implementation can eventually
	// optimize the chunk.
	// There's no strong guarantee that no samples will be appended once
	// Compact() is called. Implementing this function is optional.
	Compact()

	// Reset resets the chunk given stream.
	Reset(stream []byte)
}

type Iterable interface {
	// The iterator passed as argument is for re-use.
	// Depending on implementation, the iterator can
	// be re-used or a new iterator can be allocated.
	Iterator(Iterator) Iterator
}

// Appender adds sample pairs to a chunk.
type Appender interface {
	Append(int64, float64)

	// AppendHistogram and AppendFloatHistogram append a histogram sample to a histogram or float histogram chunk.
	// Appending a histogram may require creating a completely new chunk or recoding (changing) the current chunk.
	// The Appender prev is used to determine if there is a counter reset between the previous Appender and the current Appender.
	// The Appender prev is optional and only taken into account when the first sample is being appended.
	// The bool appendOnly governs what happens when a sample cannot be appended to the current chunk. If appendOnly is true, then
	// in such case an error is returned without modifying the chunk. If appendOnly is false, then a new chunk is created or the
	// current chunk is recoded to accommodate the sample.
	// The returned Chunk c is nil if sample could be appended to the current Chunk, otherwise c is the new Chunk.
	// The returned bool isRecoded can be used to distinguish between the new Chunk c being a completely new Chunk
	// or the current Chunk recoded to a new Chunk.
	// The Appender app that can be used for the next append is always returned.
	AppendHistogram(prev *HistogramAppender, t int64, h *histogram.Histogram, appendOnly bool) (c Chunk, isRecoded bool, app Appender, err error)
	AppendFloatHistogram(prev *FloatHistogramAppender, t int64, h *histogram.FloatHistogram, appendOnly bool) (c Chunk, isRecoded bool, app Appender, err error)
}

// Iterator is a simple iterator that can only get the next value.
// Iterator iterates over the samples of a time series, in timestamp-increasing order.
type Iterator interface {
	// Next advances the iterator by one and returns the type of the value
	// at the new position (or ValNone if the iterator is exhausted).
	Next() ValueType
	// Seek advances the iterator forward to the first sample with a
	// timestamp equal or greater than t. If the current sample found by a
	// previous `Next` or `Seek` operation already has this property, Seek
	// has no effect. If a sample has been found, Seek returns the type of
	// its value. Otherwise, it returns ValNone, after which the iterator is
	// exhausted.
	Seek(t int64) ValueType
	// At returns the current timestamp/value pair if the value is a float.
	// Before the iterator has advanced, the behaviour is unspecified.
	At() (int64, float64)
	// AtHistogram returns the current timestamp/value pair if the value is a
	// histogram with integer counts. Before the iterator has advanced, the behaviour
	// is unspecified.
	// The method accepts an optional Histogram object which will be
	// reused when not nil. Otherwise, a new Histogram object will be allocated.
	AtHistogram(*histogram.Histogram) (int64, *histogram.Histogram)
	// AtFloatHistogram returns the current timestamp/value pair if the
	// value is a histogram with floating-point counts. It also works if the
	// value is a histogram with integer counts, in which case a
	// FloatHistogram copy of the histogram is returned. Before the iterator
	// has advanced, the behaviour is unspecified.
	// The method accepts an optional FloatHistogram object which will be
	// reused when not nil. Otherwise, a new FloatHistogram object will be allocated.
	AtFloatHistogram(*histogram.FloatHistogram) (int64, *histogram.FloatHistogram)
	// AtT returns the current timestamp.
	// Before the iterator has advanced, the behaviour is unspecified.
	AtT() int64
	// Err returns the current error. It should be used only after the
	// iterator is exhausted, i.e. `Next` or `Seek` have returned ValNone.
	Err() error
}

// ValueType defines the type of a value an Iterator points to.
type ValueType uint8

// Possible values for ValueType.
const (
	ValNone           ValueType = iota // No value at the current position.
	ValFloat                           // A simple float, retrieved with At.
	ValHistogram                       // A histogram, retrieve with AtHistogram, but AtFloatHistogram works, too.
	ValFloatHistogram                  // A floating-point histogram, retrieve with AtFloatHistogram.
)

func (v ValueType) String() string {
	switch v {
	case ValNone:
		return "none"
	case ValFloat:
		return "float"
	case ValHistogram:
		return "histogram"
	case ValFloatHistogram:
		return "floathistogram"
	default:
		return "unknown"
	}
}

func (v ValueType) ChunkEncoding() Encoding {
	switch v {
	case ValFloat:
		return EncXOR
	case ValHistogram:
		return EncHistogram
	case ValFloatHistogram:
		return EncFloatHistogram
	default:
		return EncNone
	}
}

func (v ValueType) NewChunk() (Chunk, error) {
	switch v {
	case ValFloat:
		return NewXORChunk(), nil
	case ValHistogram:
		return NewHistogramChunk(), nil
	case ValFloatHistogram:
		return NewFloatHistogramChunk(), nil
	default:
		return nil, fmt.Errorf("value type %v unsupported", v)
	}
}

// MockSeriesIterator returns an iterator for a mock series with custom timeStamps and values.
func MockSeriesIterator(timestamps []int64, values []float64) Iterator {
	return &mockSeriesIterator{
		timeStamps: timestamps,
		values:     values,
		currIndex:  -1,
	}
}

type mockSeriesIterator struct {
	timeStamps []int64
	values     []float64
	currIndex  int
}

func (it *mockSeriesIterator) Seek(int64) ValueType { return ValNone }

func (it *mockSeriesIterator) At() (int64, float64) {
	return it.timeStamps[it.currIndex], it.values[it.currIndex]
}

func (it *mockSeriesIterator) AtHistogram(*histogram.Histogram) (int64, *histogram.Histogram) {
	return math.MinInt64, nil
}

func (it *mockSeriesIterator) AtFloatHistogram(*histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	return math.MinInt64, nil
}

func (it *mockSeriesIterator) AtT() int64 {
	return it.timeStamps[it.currIndex]
}

func (it *mockSeriesIterator) Next() ValueType {
	if it.currIndex < len(it.timeStamps)-1 {
		it.currIndex++
		return ValFloat
	}

	return ValNone
}
func (it *mockSeriesIterator) Err() error { return nil }

// NewNopIterator returns a new chunk iterator that does not hold any data.
func NewNopIterator() Iterator {
	return nopIterator{}
}

type nopIterator struct{}

func (nopIterator) Next() ValueType      { return ValNone }
func (nopIterator) Seek(int64) ValueType { return ValNone }
func (nopIterator) At() (int64, float64) { return math.MinInt64, 0 }
func (nopIterator) AtHistogram(*histogram.Histogram) (int64, *histogram.Histogram) {
	return math.MinInt64, nil
}

func (nopIterator) AtFloatHistogram(*histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	return math.MinInt64, nil
}
func (nopIterator) AtT() int64 { return math.MinInt64 }
func (nopIterator) Err() error { return nil }

// Pool is used to create and reuse chunk references to avoid allocations.
type Pool interface {
	Put(Chunk) error
	Get(e Encoding, b []byte) (Chunk, error)
}

// pool is a memory pool of chunk objects.
type pool struct {
	xor            sync.Pool
	histogram      sync.Pool
	floatHistogram sync.Pool
}

// NewPool returns a new pool.
func NewPool() Pool {
	return &pool{
		xor: sync.Pool{
			New: func() interface{} {
				return &XORChunk{b: bstream{}}
			},
		},
		histogram: sync.Pool{
			New: func() interface{} {
				return &HistogramChunk{b: bstream{}}
			},
		},
		floatHistogram: sync.Pool{
			New: func() interface{} {
				return &FloatHistogramChunk{b: bstream{}}
			},
		},
	}
}

func (p *pool) Get(e Encoding, b []byte) (Chunk, error) {
	var c Chunk
	switch e {
	case EncXOR:
		c = p.xor.Get().(*XORChunk)
	case EncHistogram:
		c = p.histogram.Get().(*HistogramChunk)
	case EncFloatHistogram:
		c = p.floatHistogram.Get().(*FloatHistogramChunk)
	default:
		return nil, fmt.Errorf("invalid chunk encoding %q", e)
	}

	c.Reset(b)
	return c, nil
}

func (p *pool) Put(c Chunk) error {
	var sp *sync.Pool
	var ok bool
	switch c.Encoding() {
	case EncXOR:
		_, ok = c.(*XORChunk)
		sp = &p.xor
	case EncHistogram:
		_, ok = c.(*HistogramChunk)
		sp = &p.histogram
	case EncFloatHistogram:
		_, ok = c.(*FloatHistogramChunk)
		sp = &p.floatHistogram
	default:
		return fmt.Errorf("invalid chunk encoding %q", c.Encoding())
	}
	if !ok {
		// This may happen often with wrapped chunks. Nothing we can really do about
		// it but returning an error would cause a lot of allocations again. Thus,
		// we just skip it.
		return nil
	}

	c.Reset(nil)
	sp.Put(c)
	return nil
}

// FromData returns a chunk from a byte slice of chunk data.
// This is there so that users of the library can easily create chunks from
// bytes.
func FromData(e Encoding, d []byte) (Chunk, error) {
	switch e {
	case EncXOR:
		return &XORChunk{b: bstream{count: 0, stream: d}}, nil
	case EncHistogram:
		return &HistogramChunk{b: bstream{count: 0, stream: d}}, nil
	case EncFloatHistogram:
		return &FloatHistogramChunk{b: bstream{count: 0, stream: d}}, nil
	}
	return nil, fmt.Errorf("invalid chunk encoding %q", e)
}

// NewEmptyChunk returns an empty chunk for the given encoding.
func NewEmptyChunk(e Encoding) (Chunk, error) {
	switch e {
	case EncXOR:
		return NewXORChunk(), nil
	case EncHistogram:
		return NewHistogramChunk(), nil
	case EncFloatHistogram:
		return NewFloatHistogramChunk(), nil
	}
	return nil, fmt.Errorf("invalid chunk encoding %q", e)
}
