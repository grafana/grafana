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

package storage

import (
	"math"
)

// BufferedSeriesIterator wraps an iterator with a look-back buffer.
type BufferedSeriesIterator struct {
	it    SeriesIterator
	buf   *sampleRing
	delta int64

	lastTime int64
	ok       bool
}

// NewBuffer returns a new iterator that buffers the values within the time range
// of the current element and the duration of delta before, initialized with an
// empty iterator. Use Reset() to set an actual iterator to be buffered.
func NewBuffer(delta int64) *BufferedSeriesIterator {
	return NewBufferIterator(&NoopSeriesIt, delta)
}

// NewBufferIterator returns a new iterator that buffers the values within the
// time range of the current element and the duration of delta before.
func NewBufferIterator(it SeriesIterator, delta int64) *BufferedSeriesIterator {
	bit := &BufferedSeriesIterator{
		buf:   newSampleRing(delta, 16),
		delta: delta,
	}
	bit.Reset(it)

	return bit
}

// Reset re-uses the buffer with a new iterator, resetting the buffered time
// delta to its original value.
func (b *BufferedSeriesIterator) Reset(it SeriesIterator) {
	b.it = it
	b.lastTime = math.MinInt64
	b.ok = true
	b.buf.reset()
	b.buf.delta = b.delta
	it.Next()
}

// ReduceDelta lowers the buffered time delta, for the current SeriesIterator only.
func (b *BufferedSeriesIterator) ReduceDelta(delta int64) bool {
	return b.buf.reduceDelta(delta)
}

// PeekBack returns the nth previous element of the iterator. If there is none buffered,
// ok is false.
func (b *BufferedSeriesIterator) PeekBack(n int) (t int64, v float64, ok bool) {
	return b.buf.nthLast(n)
}

// Buffer returns an iterator over the buffered data. Invalidates previously
// returned iterators.
func (b *BufferedSeriesIterator) Buffer() SeriesIterator {
	return b.buf.iterator()
}

// Seek advances the iterator to the element at time t or greater.
func (b *BufferedSeriesIterator) Seek(t int64) bool {
	t0 := t - b.buf.delta

	// If the delta would cause us to seek backwards, preserve the buffer
	// and just continue regular advancement while filling the buffer on the way.
	if t0 > b.lastTime {
		b.buf.reset()

		b.ok = b.it.Seek(t0)
		if !b.ok {
			return false
		}
		b.lastTime, _ = b.Values()
	}

	if b.lastTime >= t {
		return true
	}
	for b.Next() {
		if b.lastTime >= t {
			return true
		}
	}

	return false
}

// Next advances the iterator to the next element.
func (b *BufferedSeriesIterator) Next() bool {
	if !b.ok {
		return false
	}

	// Add current element to buffer before advancing.
	b.buf.add(b.it.At())

	b.ok = b.it.Next()
	if b.ok {
		b.lastTime, _ = b.Values()
	}

	return b.ok
}

// Values returns the current element of the iterator.
func (b *BufferedSeriesIterator) Values() (int64, float64) {
	return b.it.At()
}

// Err returns the last encountered error.
func (b *BufferedSeriesIterator) Err() error {
	return b.it.Err()
}

type sample struct {
	t int64
	v float64
}

type sampleRing struct {
	delta int64

	buf []sample // lookback buffer
	i   int      // position of most recent element in ring buffer
	f   int      // position of first element in ring buffer
	l   int      // number of elements in buffer

	it sampleRingIterator
}

func newSampleRing(delta int64, sz int) *sampleRing {
	r := &sampleRing{delta: delta, buf: make([]sample, sz)}
	r.reset()

	return r
}

func (r *sampleRing) reset() {
	r.l = 0
	r.i = -1
	r.f = 0
}

// Returns the current iterator. Invalidates previously returned iterators.
func (r *sampleRing) iterator() SeriesIterator {
	r.it.r = r
	r.it.i = -1
	return &r.it
}

type sampleRingIterator struct {
	r *sampleRing
	i int
}

func (it *sampleRingIterator) Next() bool {
	it.i++
	return it.i < it.r.l
}

func (it *sampleRingIterator) Seek(int64) bool {
	return false
}

func (it *sampleRingIterator) Err() error {
	return nil
}

func (it *sampleRingIterator) At() (int64, float64) {
	return it.r.at(it.i)
}

func (r *sampleRing) at(i int) (int64, float64) {
	j := (r.f + i) % len(r.buf)
	s := r.buf[j]
	return s.t, s.v
}

// add adds a sample to the ring buffer and frees all samples that fall
// out of the delta range.
func (r *sampleRing) add(t int64, v float64) {
	l := len(r.buf)
	// Grow the ring buffer if it fits no more elements.
	if l == r.l {
		buf := make([]sample, 2*l)
		copy(buf[l+r.f:], r.buf[r.f:])
		copy(buf, r.buf[:r.f])

		r.buf = buf
		r.i = r.f
		r.f += l
		l = 2 * l
	} else {
		r.i++
		if r.i >= l {
			r.i -= l
		}
	}

	r.buf[r.i] = sample{t: t, v: v}
	r.l++

	// Free head of the buffer of samples that just fell out of the range.
	tmin := t - r.delta
	for r.buf[r.f].t < tmin {
		r.f++
		if r.f >= l {
			r.f -= l
		}
		r.l--
	}
}

// reduceDelta lowers the buffered time delta, dropping any samples that are
// out of the new delta range.
func (r *sampleRing) reduceDelta(delta int64) bool {
	if delta > r.delta {
		return false
	}
	r.delta = delta

	if r.l == 0 {
		return true
	}

	// Free head of the buffer of samples that just fell out of the range.
	l := len(r.buf)
	tmin := r.buf[r.i].t - delta
	for r.buf[r.f].t < tmin {
		r.f++
		if r.f >= l {
			r.f -= l
		}
		r.l--
	}
	return true
}

// nthLast returns the nth most recent element added to the ring.
func (r *sampleRing) nthLast(n int) (int64, float64, bool) {
	if n > r.l {
		return 0, 0, false
	}
	t, v := r.at(r.l - n)
	return t, v, true
}

func (r *sampleRing) samples() []sample {
	res := make([]sample, r.l)

	var k = r.f + r.l
	var j int
	if k > len(r.buf) {
		k = len(r.buf)
		j = r.l - k + r.f
	}

	n := copy(res, r.buf[r.f:k])
	copy(res[n:], r.buf[:j])

	return res
}
