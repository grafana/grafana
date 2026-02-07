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
	"fmt"
	"math"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
	"github.com/prometheus/prometheus/tsdb/chunks"
)

// BufferedSeriesIterator wraps an iterator with a look-back buffer.
type BufferedSeriesIterator struct {
	hReader  histogram.Histogram
	fhReader histogram.FloatHistogram

	it    chunkenc.Iterator
	buf   *sampleRing
	delta int64

	lastTime  int64
	valueType chunkenc.ValueType
}

// NewBuffer returns a new iterator that buffers the values within the time range
// of the current element and the duration of delta before, initialized with an
// empty iterator. Use Reset() to set an actual iterator to be buffered.
func NewBuffer(delta int64) *BufferedSeriesIterator {
	return NewBufferIterator(chunkenc.NewNopIterator(), delta)
}

// NewBufferIterator returns a new iterator that buffers the values within the
// time range of the current element and the duration of delta before.
func NewBufferIterator(it chunkenc.Iterator, delta int64) *BufferedSeriesIterator {
	bit := &BufferedSeriesIterator{
		buf:   newSampleRing(delta, 0, chunkenc.ValNone),
		delta: delta,
	}
	bit.Reset(it)

	return bit
}

// Reset re-uses the buffer with a new iterator, resetting the buffered time
// delta to its original value.
func (b *BufferedSeriesIterator) Reset(it chunkenc.Iterator) {
	b.it = it
	b.lastTime = math.MinInt64
	b.buf.reset()
	b.buf.delta = b.delta
	b.valueType = it.Next()
}

// ReduceDelta lowers the buffered time delta, for the current SeriesIterator only.
func (b *BufferedSeriesIterator) ReduceDelta(delta int64) bool {
	return b.buf.reduceDelta(delta)
}

// PeekBack returns the nth previous element of the iterator. If there is none buffered,
// ok is false.
func (b *BufferedSeriesIterator) PeekBack(n int) (sample chunks.Sample, ok bool) {
	return b.buf.nthLast(n)
}

// Buffer returns an iterator over the buffered data. Invalidates previously
// returned iterators.
func (b *BufferedSeriesIterator) Buffer() *SampleRingIterator {
	return b.buf.iterator()
}

// Seek advances the iterator to the element at time t or greater.
func (b *BufferedSeriesIterator) Seek(t int64) chunkenc.ValueType {
	t0 := t - b.buf.delta

	// If the delta would cause us to seek backwards, preserve the buffer
	// and just continue regular advancement while filling the buffer on the way.
	if b.valueType != chunkenc.ValNone && t0 > b.lastTime {
		b.buf.reset()

		b.valueType = b.it.Seek(t0)
		switch b.valueType {
		case chunkenc.ValNone:
			return chunkenc.ValNone
		case chunkenc.ValFloat, chunkenc.ValHistogram, chunkenc.ValFloatHistogram:
			b.lastTime = b.AtT()
		default:
			panic(fmt.Errorf("BufferedSeriesIterator: unknown value type %v", b.valueType))
		}
	}

	if b.lastTime >= t {
		return b.valueType
	}
	for {
		if b.valueType = b.Next(); b.valueType == chunkenc.ValNone || b.lastTime >= t {
			return b.valueType
		}
	}
}

// Next advances the iterator to the next element.
func (b *BufferedSeriesIterator) Next() chunkenc.ValueType {
	// Add current element to buffer before advancing.
	switch b.valueType {
	case chunkenc.ValNone:
		return chunkenc.ValNone
	case chunkenc.ValFloat:
		t, f := b.it.At()
		b.buf.addF(fSample{t: t, f: f})
	case chunkenc.ValHistogram:
		t, h := b.it.AtHistogram(&b.hReader)
		b.buf.addH(hSample{t: t, h: h})
	case chunkenc.ValFloatHistogram:
		t, fh := b.it.AtFloatHistogram(&b.fhReader)
		b.buf.addFH(fhSample{t: t, fh: fh})
	default:
		panic(fmt.Errorf("BufferedSeriesIterator: unknown value type %v", b.valueType))
	}

	b.valueType = b.it.Next()
	if b.valueType != chunkenc.ValNone {
		b.lastTime = b.AtT()
	}
	return b.valueType
}

// At returns the current float element of the iterator.
func (b *BufferedSeriesIterator) At() (int64, float64) {
	return b.it.At()
}

// AtHistogram returns the current histogram element of the iterator.
func (b *BufferedSeriesIterator) AtHistogram(fh *histogram.Histogram) (int64, *histogram.Histogram) {
	return b.it.AtHistogram(fh)
}

// AtFloatHistogram returns the current float-histogram element of the iterator.
func (b *BufferedSeriesIterator) AtFloatHistogram(fh *histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	return b.it.AtFloatHistogram(fh)
}

// AtT returns the current timestamp of the iterator.
func (b *BufferedSeriesIterator) AtT() int64 {
	return b.it.AtT()
}

// Err returns the last encountered error.
func (b *BufferedSeriesIterator) Err() error {
	return b.it.Err()
}

type fSample struct {
	t int64
	f float64
}

func (s fSample) T() int64 {
	return s.t
}

func (s fSample) F() float64 {
	return s.f
}

func (s fSample) H() *histogram.Histogram {
	panic("H() called for fSample")
}

func (s fSample) FH() *histogram.FloatHistogram {
	panic("FH() called for fSample")
}

func (s fSample) Type() chunkenc.ValueType {
	return chunkenc.ValFloat
}

func (s fSample) Copy() chunks.Sample {
	return s
}

type hSample struct {
	t int64
	h *histogram.Histogram
}

func (s hSample) T() int64 {
	return s.t
}

func (s hSample) F() float64 {
	panic("F() called for hSample")
}

func (s hSample) H() *histogram.Histogram {
	return s.h
}

func (s hSample) FH() *histogram.FloatHistogram {
	return s.h.ToFloat(nil)
}

func (s hSample) Type() chunkenc.ValueType {
	return chunkenc.ValHistogram
}

func (s hSample) Copy() chunks.Sample {
	return hSample{t: s.t, h: s.h.Copy()}
}

type fhSample struct {
	t  int64
	fh *histogram.FloatHistogram
}

func (s fhSample) T() int64 {
	return s.t
}

func (s fhSample) F() float64 {
	panic("F() called for fhSample")
}

func (s fhSample) H() *histogram.Histogram {
	panic("H() called for fhSample")
}

func (s fhSample) FH() *histogram.FloatHistogram {
	return s.fh
}

func (s fhSample) Type() chunkenc.ValueType {
	return chunkenc.ValFloatHistogram
}

func (s fhSample) Copy() chunks.Sample {
	return fhSample{t: s.t, fh: s.fh.Copy()}
}

type sampleRing struct {
	delta int64

	// Lookback buffers. We use iBuf for mixed samples, but one of the three
	// concrete ones for homogeneous samples. (Only one of the four bufs is
	// allowed to be populated!) This avoids the overhead of the interface
	// wrapper for the happy (and by far most common) case of homogeneous
	// samples.
	iBuf     []chunks.Sample
	fBuf     []fSample
	hBuf     []hSample
	fhBuf    []fhSample
	bufInUse bufType

	i int // Position of most recent element in ring buffer.
	f int // Position of first element in ring buffer.
	l int // Number of elements in buffer.

	it SampleRingIterator
}

type bufType int

const (
	noBuf bufType = iota // Nothing yet stored in sampleRing.
	iBuf
	fBuf
	hBuf
	fhBuf
)

// newSampleRing creates a new sampleRing. If you do not know the preferred
// value type yet, use a size of 0 (in which case the provided typ doesn't
// matter). On the first add, a buffer of size 16 will be allocated with the
// preferred type being the type of the first added sample.
func newSampleRing(delta int64, size int, typ chunkenc.ValueType) *sampleRing {
	r := &sampleRing{delta: delta}
	r.reset()
	if size <= 0 {
		// Will initialize on first add.
		return r
	}
	switch typ {
	case chunkenc.ValFloat:
		r.fBuf = make([]fSample, size)
	case chunkenc.ValHistogram:
		r.hBuf = make([]hSample, size)
	case chunkenc.ValFloatHistogram:
		r.fhBuf = make([]fhSample, size)
	default:
		// Do not initialize anything because the 1st sample will be
		// added to one of the other bufs anyway.
	}
	return r
}

func (r *sampleRing) reset() {
	r.l = 0
	r.i = -1
	r.f = 0
	r.bufInUse = noBuf

	// The first sample after the reset will always go to a specialized
	// buffer. If we later need to change to the interface buffer, we'll
	// copy from the specialized buffer to the interface buffer. For that to
	// work properly, we have to reset the interface buffer here, too.
	r.iBuf = r.iBuf[:0]
}

// Resets and returns the iterator. Invalidates previously returned iterators.
func (r *sampleRing) iterator() *SampleRingIterator {
	r.it.reset(r)
	return &r.it
}

// SampleRingIterator is returned by BufferedSeriesIterator.Buffer() and can be
// used to iterate samples buffered in the lookback window.
type SampleRingIterator struct {
	r  *sampleRing
	i  int
	t  int64
	f  float64
	h  *histogram.Histogram
	fh *histogram.FloatHistogram
}

func (it *SampleRingIterator) reset(r *sampleRing) {
	it.r = r
	it.i = -1
	it.h = nil
	it.fh = nil
}

func (it *SampleRingIterator) Next() chunkenc.ValueType {
	it.i++
	if it.i >= it.r.l {
		return chunkenc.ValNone
	}
	switch it.r.bufInUse {
	case fBuf:
		s := it.r.atF(it.i)
		it.t = s.t
		it.f = s.f
		return chunkenc.ValFloat
	case hBuf:
		s := it.r.atH(it.i)
		it.t = s.t
		it.h = s.h
		return chunkenc.ValHistogram
	case fhBuf:
		s := it.r.atFH(it.i)
		it.t = s.t
		it.fh = s.fh
		return chunkenc.ValFloatHistogram
	}
	s := it.r.at(it.i)
	it.t = s.T()
	switch s.Type() {
	case chunkenc.ValHistogram:
		it.h = s.H()
		it.fh = nil
		return chunkenc.ValHistogram
	case chunkenc.ValFloatHistogram:
		it.fh = s.FH()
		it.h = nil
		return chunkenc.ValFloatHistogram
	default:
		it.f = s.F()
		return chunkenc.ValFloat
	}
}

// At returns the current float element of the iterator.
func (it *SampleRingIterator) At() (int64, float64) {
	return it.t, it.f
}

// AtHistogram returns the current histogram element of the iterator.
func (it *SampleRingIterator) AtHistogram() (int64, *histogram.Histogram) {
	return it.t, it.h
}

// AtFloatHistogram returns the current histogram element of the iterator. If the
// current sample is an integer histogram, it will be converted to a float histogram.
// An optional histogram.FloatHistogram can be provided to avoid allocating a new
// object for the conversion.
func (it *SampleRingIterator) AtFloatHistogram(fh *histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	if it.fh == nil {
		return it.t, it.h.ToFloat(fh)
	}
	if fh != nil {
		it.fh.CopyTo(fh)
		return it.t, fh
	}
	return it.t, it.fh.Copy()
}

func (it *SampleRingIterator) AtT() int64 {
	return it.t
}

func (r *sampleRing) at(i int) chunks.Sample {
	j := (r.f + i) % len(r.iBuf)
	return r.iBuf[j]
}

func (r *sampleRing) atF(i int) fSample {
	j := (r.f + i) % len(r.fBuf)
	return r.fBuf[j]
}

func (r *sampleRing) atH(i int) hSample {
	j := (r.f + i) % len(r.hBuf)
	return r.hBuf[j]
}

func (r *sampleRing) atFH(i int) fhSample {
	j := (r.f + i) % len(r.fhBuf)
	return r.fhBuf[j]
}

// add adds a sample to the ring buffer and frees all samples that fall out of
// the delta range. Note that this method works for any sample
// implementation. If you know you are dealing with one of the implementations
// from this package (fSample, hSample, fhSample), call one of the specialized
// methods addF, addH, or addFH for better performance.
func (r *sampleRing) add(s chunks.Sample) {
	if r.bufInUse == noBuf {
		// First sample.
		switch s := s.(type) {
		case fSample:
			r.bufInUse = fBuf
			r.fBuf = addF(s, r.fBuf, r)
		case hSample:
			r.bufInUse = hBuf
			r.hBuf = addH(s, r.hBuf, r)
		case fhSample:
			r.bufInUse = fhBuf
			r.fhBuf = addFH(s, r.fhBuf, r)
		}
		return
	}
	if r.bufInUse != iBuf {
		// Nothing added to the interface buf yet. Let's check if we can
		// stay specialized.
		switch s := s.(type) {
		case fSample:
			if r.bufInUse == fBuf {
				r.fBuf = addF(s, r.fBuf, r)
				return
			}
		case hSample:
			if r.bufInUse == hBuf {
				r.hBuf = addH(s, r.hBuf, r)
				return
			}
		case fhSample:
			if r.bufInUse == fhBuf {
				r.fhBuf = addFH(s, r.fhBuf, r)
				return
			}
		}
		// The new sample isn't a fit for the already existing
		// ones. Copy the latter into the interface buffer where needed.
		// The interface buffer is assumed to be of length zero at this point.
		switch r.bufInUse {
		case fBuf:
			for _, s := range r.fBuf {
				r.iBuf = append(r.iBuf, s)
			}
			r.fBuf = nil
		case hBuf:
			for _, s := range r.hBuf {
				r.iBuf = append(r.iBuf, s)
			}
			r.hBuf = nil
		case fhBuf:
			for _, s := range r.fhBuf {
				r.iBuf = append(r.iBuf, s)
			}
			r.fhBuf = nil
		}
		r.bufInUse = iBuf
	}
	r.iBuf = addSample(s, r.iBuf, r)
}

// addF is a version of the add method specialized for fSample.
func (r *sampleRing) addF(s fSample) {
	switch r.bufInUse {
	case fBuf: // Add to existing fSamples.
		r.fBuf = addF(s, r.fBuf, r)
	case noBuf: // Add first sample.
		r.fBuf = addF(s, r.fBuf, r)
		r.bufInUse = fBuf
	case iBuf: // Already have interface samples. Add to the interface buf.
		r.iBuf = addSample(s, r.iBuf, r)
	default:
		// Already have specialized samples that are not fSamples.
		// Need to call the checked add method for conversion.
		r.add(s)
	}
}

// addH is a version of the add method specialized for hSample.
func (r *sampleRing) addH(s hSample) {
	switch r.bufInUse {
	case hBuf: // Add to existing hSamples.
		r.hBuf = addH(s, r.hBuf, r)
	case noBuf: // Add first sample.
		r.hBuf = addH(s, r.hBuf, r)
		r.bufInUse = hBuf
	case iBuf: // Already have interface samples. Add to the interface buf.
		r.iBuf = addSample(s, r.iBuf, r)
	default:
		// Already have specialized samples that are not hSamples.
		// Need to call the checked add method for conversion.
		r.add(s)
	}
}

// addFH is a version of the add method specialized for fhSample.
func (r *sampleRing) addFH(s fhSample) {
	switch r.bufInUse {
	case fhBuf: // Add to existing fhSamples.
		r.fhBuf = addFH(s, r.fhBuf, r)
	case noBuf: // Add first sample.
		r.fhBuf = addFH(s, r.fhBuf, r)
		r.bufInUse = fhBuf
	case iBuf: // Already have interface samples. Add to the interface buf.
		r.iBuf = addSample(s, r.iBuf, r)
	default:
		// Already have specialized samples that are not fhSamples.
		// Need to call the checked add method for conversion.
		r.add(s)
	}
}

// addSample adds a sample to a buffer of chunks.Sample, i.e. the general case
// using an interface as the type.
func addSample(s chunks.Sample, buf []chunks.Sample, r *sampleRing) []chunks.Sample {
	l := len(buf)
	// Grow the ring buffer if it fits no more elements.
	if l == 0 {
		buf = make([]chunks.Sample, 16)
		l = 16
	}
	if l == r.l {
		newBuf := make([]chunks.Sample, 2*l)
		copy(newBuf[l+r.f:], buf[r.f:])
		copy(newBuf, buf[:r.f])

		buf = newBuf
		r.i = r.f
		r.f += l
		l = 2 * l
	} else {
		r.i++
		if r.i >= l {
			r.i -= l
		}
	}

	buf[r.i] = s.Copy()
	r.l++

	// Free head of the buffer of samples that just fell out of the range.
	tmin := s.T() - r.delta
	for buf[r.f].T() < tmin {
		r.f++
		if r.f >= l {
			r.f -= l
		}
		r.l--
	}
	return buf
}

// addF adds an fSample to a (specialized) fSample buffer.
func addF(s fSample, buf []fSample, r *sampleRing) []fSample {
	l := len(buf)
	// Grow the ring buffer if it fits no more elements.
	if l == 0 {
		buf = make([]fSample, 16)
		l = 16
	}
	if l == r.l {
		newBuf := make([]fSample, 2*l)
		copy(newBuf[l+r.f:], buf[r.f:])
		copy(newBuf, buf[:r.f])

		buf = newBuf
		r.i = r.f
		r.f += l
		l = 2 * l
	} else {
		r.i++
		if r.i >= l {
			r.i -= l
		}
	}

	buf[r.i] = s
	r.l++

	// Free head of the buffer of samples that just fell out of the range.
	tmin := s.T() - r.delta
	for buf[r.f].T() < tmin {
		r.f++
		if r.f >= l {
			r.f -= l
		}
		r.l--
	}
	return buf
}

// addH adds an hSample to a (specialized) hSample buffer.
func addH(s hSample, buf []hSample, r *sampleRing) []hSample {
	l := len(buf)
	// Grow the ring buffer if it fits no more elements.
	if l == 0 {
		buf = make([]hSample, 16)
		l = 16
	}
	if l == r.l {
		newBuf := make([]hSample, 2*l)
		copy(newBuf[l+r.f:], buf[r.f:])
		copy(newBuf, buf[:r.f])

		buf = newBuf
		r.i = r.f
		r.f += l
		l = 2 * l
	} else {
		r.i++
		if r.i >= l {
			r.i -= l
		}
	}

	buf[r.i].t = s.t
	if buf[r.i].h == nil {
		buf[r.i].h = s.h.Copy()
	} else {
		s.h.CopyTo(buf[r.i].h)
	}
	r.l++

	// Free head of the buffer of samples that just fell out of the range.
	tmin := s.T() - r.delta
	for buf[r.f].T() < tmin {
		r.f++
		if r.f >= l {
			r.f -= l
		}
		r.l--
	}
	return buf
}

// addFH adds an fhSample to a (specialized) fhSample buffer.
func addFH(s fhSample, buf []fhSample, r *sampleRing) []fhSample {
	l := len(buf)
	// Grow the ring buffer if it fits no more elements.
	if l == 0 {
		buf = make([]fhSample, 16)
		l = 16
	}
	if l == r.l {
		newBuf := make([]fhSample, 2*l)
		copy(newBuf[l+r.f:], buf[r.f:])
		copy(newBuf, buf[:r.f])

		buf = newBuf
		r.i = r.f
		r.f += l
		l = 2 * l
	} else {
		r.i++
		if r.i >= l {
			r.i -= l
		}
	}

	buf[r.i].t = s.t
	if buf[r.i].fh == nil {
		buf[r.i].fh = s.fh.Copy()
	} else {
		s.fh.CopyTo(buf[r.i].fh)
	}
	r.l++

	// Free head of the buffer of samples that just fell out of the range.
	tmin := s.T() - r.delta
	for buf[r.f].T() < tmin {
		r.f++
		if r.f >= l {
			r.f -= l
		}
		r.l--
	}
	return buf
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

	switch r.bufInUse {
	case fBuf:
		genericReduceDelta(r.fBuf, r)
	case hBuf:
		genericReduceDelta(r.hBuf, r)
	case fhBuf:
		genericReduceDelta(r.fhBuf, r)
	default:
		genericReduceDelta(r.iBuf, r)
	}
	return true
}

func genericReduceDelta[T chunks.Sample](buf []T, r *sampleRing) {
	// Free head of the buffer of samples that just fell out of the range.
	l := len(buf)
	tmin := buf[r.i].T() - r.delta
	for buf[r.f].T() < tmin {
		r.f++
		if r.f >= l {
			r.f -= l
		}
		r.l--
	}
}

// nthLast returns the nth most recent element added to the ring.
func (r *sampleRing) nthLast(n int) (chunks.Sample, bool) {
	if n > r.l {
		return fSample{}, false
	}
	i := r.l - n
	switch r.bufInUse {
	case fBuf:
		return r.atF(i), true
	case hBuf:
		return r.atH(i), true
	case fhBuf:
		return r.atFH(i), true
	default:
		return r.at(i), true
	}
}

func (r *sampleRing) samples() []chunks.Sample {
	res := make([]chunks.Sample, r.l)

	k := r.f + r.l
	var j int

	switch r.bufInUse {
	case iBuf:
		if k > len(r.iBuf) {
			k = len(r.iBuf)
			j = r.l - k + r.f
		}
		n := copy(res, r.iBuf[r.f:k])
		copy(res[n:], r.iBuf[:j])
	case fBuf:
		if k > len(r.fBuf) {
			k = len(r.fBuf)
			j = r.l - k + r.f
		}
		resF := make([]fSample, r.l)
		n := copy(resF, r.fBuf[r.f:k])
		copy(resF[n:], r.fBuf[:j])
		for i, s := range resF {
			res[i] = s
		}
	case hBuf:
		if k > len(r.hBuf) {
			k = len(r.hBuf)
			j = r.l - k + r.f
		}
		resH := make([]hSample, r.l)
		n := copy(resH, r.hBuf[r.f:k])
		copy(resH[n:], r.hBuf[:j])
		for i, s := range resH {
			res[i] = s
		}
	case fhBuf:
		if k > len(r.fhBuf) {
			k = len(r.fhBuf)
			j = r.l - k + r.f
		}
		resFH := make([]fhSample, r.l)
		n := copy(resFH, r.fhBuf[r.f:k])
		copy(resFH[n:], r.fhBuf[:j])
		for i, s := range resFH {
			res[i] = s
		}
	}

	return res
}
