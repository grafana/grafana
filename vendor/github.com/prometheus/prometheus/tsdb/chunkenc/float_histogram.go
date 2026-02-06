// Copyright 2022 The Prometheus Authors
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
	"encoding/binary"
	"errors"
	"fmt"
	"math"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/value"
)

// FloatHistogramChunk holds encoded sample data for a sparse, high-resolution
// float histogram.
//
// Each sample has multiple "fields", stored in the following way (raw = store
// number directly, delta = store delta to the previous number, dod = store
// delta of the delta to the previous number, xor = what we do for regular
// sample values):
//
//	field →    ts    count zeroCount sum []posbuckets []negbuckets
//	sample 1   raw   raw   raw       raw []raw        []raw
//	sample 2   delta xor   xor       xor []xor        []xor
//	sample >2  dod   xor   xor       xor []xor        []xor
type FloatHistogramChunk struct {
	b bstream
}

// NewFloatHistogramChunk returns a new chunk with float histogram encoding.
func NewFloatHistogramChunk() *FloatHistogramChunk {
	b := make([]byte, 3, 128)
	return &FloatHistogramChunk{b: bstream{stream: b, count: 0}}
}

func (c *FloatHistogramChunk) Reset(stream []byte) {
	c.b.Reset(stream)
}

// xorValue holds all the necessary information to encode
// and decode XOR encoded float64 values.
type xorValue struct {
	value    float64
	leading  uint8
	trailing uint8
}

// Encoding returns the encoding type.
func (c *FloatHistogramChunk) Encoding() Encoding {
	return EncFloatHistogram
}

// Bytes returns the underlying byte slice of the chunk.
func (c *FloatHistogramChunk) Bytes() []byte {
	return c.b.bytes()
}

// NumSamples returns the number of samples in the chunk.
func (c *FloatHistogramChunk) NumSamples() int {
	return int(binary.BigEndian.Uint16(c.Bytes()))
}

// Layout returns the histogram layout. Only call this on chunks that have at
// least one sample.
func (c *FloatHistogramChunk) Layout() (
	schema int32, zeroThreshold float64,
	negativeSpans, positiveSpans []histogram.Span,
	customValues []float64,
	err error,
) {
	if c.NumSamples() == 0 {
		panic("FloatHistogramChunk.Layout() called on an empty chunk")
	}
	b := newBReader(c.Bytes()[2:])
	return readHistogramChunkLayout(&b)
}

// GetCounterResetHeader returns the info about the first 2 bits of the chunk
// header.
func (c *FloatHistogramChunk) GetCounterResetHeader() CounterResetHeader {
	return CounterResetHeader(c.Bytes()[2] & CounterResetHeaderMask)
}

// Compact implements the Chunk interface.
func (c *FloatHistogramChunk) Compact() {
	if l := len(c.b.stream); cap(c.b.stream) > l+chunkCompactCapacityThreshold {
		buf := make([]byte, l)
		copy(buf, c.b.stream)
		c.b.stream = buf
	}
}

// Appender implements the Chunk interface.
func (c *FloatHistogramChunk) Appender() (Appender, error) {
	it := c.iterator(nil)

	// To get an appender, we must know the state it would have if we had
	// appended all existing data from scratch. We iterate through the end
	// and populate via the iterator's state.
	for it.Next() == ValFloatHistogram {
	}
	if err := it.Err(); err != nil {
		return nil, err
	}

	pBuckets := make([]xorValue, len(it.pBuckets))
	for i := 0; i < len(it.pBuckets); i++ {
		pBuckets[i] = xorValue{
			value:    it.pBuckets[i],
			leading:  it.pBucketsLeading[i],
			trailing: it.pBucketsTrailing[i],
		}
	}
	nBuckets := make([]xorValue, len(it.nBuckets))
	for i := 0; i < len(it.nBuckets); i++ {
		nBuckets[i] = xorValue{
			value:    it.nBuckets[i],
			leading:  it.nBucketsLeading[i],
			trailing: it.nBucketsTrailing[i],
		}
	}

	a := &FloatHistogramAppender{
		b: &c.b,

		schema:       it.schema,
		zThreshold:   it.zThreshold,
		pSpans:       it.pSpans,
		nSpans:       it.nSpans,
		customValues: it.customValues,
		t:            it.t,
		tDelta:       it.tDelta,
		cnt:          it.cnt,
		zCnt:         it.zCnt,
		pBuckets:     pBuckets,
		nBuckets:     nBuckets,
		sum:          it.sum,
	}
	if it.numTotal == 0 {
		a.sum.leading = 0xff
		a.cnt.leading = 0xff
		a.zCnt.leading = 0xff
	}
	return a, nil
}

func (c *FloatHistogramChunk) iterator(it Iterator) *floatHistogramIterator {
	// This comment is copied from XORChunk.iterator:
	//   Should iterators guarantee to act on a copy of the data so it doesn't lock append?
	//   When using striped locks to guard access to chunks, probably yes.
	//   Could only copy data if the chunk is not completed yet.
	if histogramIter, ok := it.(*floatHistogramIterator); ok {
		histogramIter.Reset(c.b.bytes())
		return histogramIter
	}
	return newFloatHistogramIterator(c.b.bytes())
}

func newFloatHistogramIterator(b []byte) *floatHistogramIterator {
	it := &floatHistogramIterator{
		br:       newBReader(b),
		numTotal: binary.BigEndian.Uint16(b),
		t:        math.MinInt64,
	}
	// The first 3 bytes contain chunk headers.
	// We skip that for actual samples.
	_, _ = it.br.readBits(24)
	it.counterResetHeader = CounterResetHeader(b[2] & CounterResetHeaderMask)
	return it
}

// Iterator implements the Chunk interface.
func (c *FloatHistogramChunk) Iterator(it Iterator) Iterator {
	return c.iterator(it)
}

// FloatHistogramAppender is an Appender implementation for float histograms.
type FloatHistogramAppender struct {
	b *bstream

	// Layout:
	schema         int32
	zThreshold     float64
	pSpans, nSpans []histogram.Span
	customValues   []float64

	t, tDelta          int64
	sum, cnt, zCnt     xorValue
	pBuckets, nBuckets []xorValue
}

func (a *FloatHistogramAppender) GetCounterResetHeader() CounterResetHeader {
	return CounterResetHeader(a.b.bytes()[2] & CounterResetHeaderMask)
}

func (a *FloatHistogramAppender) setCounterResetHeader(cr CounterResetHeader) {
	a.b.bytes()[2] = (a.b.bytes()[2] & (^CounterResetHeaderMask)) | (byte(cr) & CounterResetHeaderMask)
}

func (a *FloatHistogramAppender) NumSamples() int {
	return int(binary.BigEndian.Uint16(a.b.bytes()))
}

// Append implements Appender. This implementation panics because normal float
// samples must never be appended to a histogram chunk.
func (a *FloatHistogramAppender) Append(int64, float64) {
	panic("appended a float sample to a histogram chunk")
}

// appendable returns whether the chunk can be appended to, and if so whether
//  1. Any recoding needs to happen to the chunk using the provided forward
//     inserts (in case of any new buckets, positive or negative range,
//     respectively).
//  2. Any recoding needs to happen for the histogram being appended, using the
//     backward inserts (in case of any missing buckets, positive or negative
//     range, respectively).
//
// If the sample is a gauge histogram, AppendableGauge must be used instead.
//
// The chunk is not appendable in the following cases:
//
//   - The schema has changed.
//   - The custom bounds have changed if the current schema is custom buckets.
//   - The threshold for the zero bucket has changed.
//   - Any buckets have disappeared, unless the bucket count was 0, unused.
//     Empty bucket can happen if the chunk was recoded and we're merging a non
//     recoded histogram. In this case backward inserts will be provided.
//   - There was a counter reset in the count of observations or in any bucket,
//     including the zero bucket.
//   - The last sample in the chunk was stale while the current sample is not stale.
//
// The method returns an additional boolean set to true if it is not appendable
// because of a counter reset. If the given sample is stale, it is always ok to
// append. If counterReset is true, okToAppend is always false.
func (a *FloatHistogramAppender) appendable(h *histogram.FloatHistogram) (
	positiveInserts, negativeInserts []Insert,
	backwardPositiveInserts, backwardNegativeInserts []Insert,
	okToAppend, counterReset bool,
) {
	if a.NumSamples() > 0 && a.GetCounterResetHeader() == GaugeType {
		return
	}
	if h.CounterResetHint == histogram.CounterReset {
		// Always honor the explicit counter reset hint.
		counterReset = true
		return
	}
	if value.IsStaleNaN(h.Sum) {
		// This is a stale sample whose buckets and spans don't matter.
		okToAppend = true
		return
	}
	if value.IsStaleNaN(a.sum.value) {
		// If the last sample was stale, then we can only accept stale
		// samples in this chunk.
		return
	}

	if h.Count < a.cnt.value {
		// There has been a counter reset.
		counterReset = true
		return
	}

	if h.Schema != a.schema || h.ZeroThreshold != a.zThreshold {
		return
	}

	if histogram.IsCustomBucketsSchema(h.Schema) && !histogram.FloatBucketsMatch(h.CustomValues, a.customValues) {
		counterReset = true
		return
	}

	if h.ZeroCount < a.zCnt.value {
		// There has been a counter reset since ZeroThreshold didn't change.
		counterReset = true
		return
	}

	var ok bool
	positiveInserts, backwardPositiveInserts, ok = expandFloatSpansAndBuckets(a.pSpans, h.PositiveSpans, a.pBuckets, h.PositiveBuckets)
	if !ok {
		counterReset = true
		return
	}
	negativeInserts, backwardNegativeInserts, ok = expandFloatSpansAndBuckets(a.nSpans, h.NegativeSpans, a.nBuckets, h.NegativeBuckets)
	if !ok {
		counterReset = true
		return
	}

	okToAppend = true
	return
}

// expandFloatSpansAndBuckets returns the inserts to expand the bucket spans 'a' so that
// they match the spans in 'b'. 'b' must cover the same or more buckets than
// 'a', otherwise the function will return false.
// The function also returns the inserts to expand 'b' to also cover all the
// buckets that are missing in 'b', but are present with 0 counter value in 'a'.
// The function also checks for counter resets between 'a' and 'b'.
//
// Example:
//
// Let's say the old buckets look like this:
//
//	span syntax: [offset, length]
//	spans      : [ 0 , 2 ]               [2,1]                   [ 3 , 2 ]                     [3,1]       [1,1]
//	bucket idx : [0]   [1]    2     3    [4]    5     6     7    [8]   [9]    10    11    12   [13]   14   [15]
//	raw values    6     3                 3                       2     4                       5           1
//	deltas        6    -3                 0                      -1     2                       1          -4
//
// But now we introduce a new bucket layout. (Carefully chosen example where we
// have a span appended, one unchanged[*], one prepended, and two merge - in
// that order.)
//
// [*] unchanged in terms of which bucket indices they represent. but to achieve
// that, their offset needs to change if "disrupted" by spans changing ahead of
// them
//
//	                                      \/ this one is "unchanged"
//	spans      : [  0  ,  3    ]         [1,1]       [    1    ,   4     ]                     [  3  ,   3    ]
//	bucket idx : [0]   [1]   [2]    3    [4]    5    [6]   [7]   [8]   [9]    10    11    12   [13]  [14]  [15]
//	raw values    6     3     0           3           0     0     2     4                       5     0     1
//	deltas        6    -3    -3           3          -3     0     2     2                       1    -5     1
//	delta mods:                          / \                     / \                                       / \
//
// Note for histograms with delta-encoded buckets: Whenever any new buckets are
// introduced, the subsequent "old" bucket needs to readjust its delta to the
// new base of 0. Thus, for the caller who wants to transform the set of
// original deltas to a new set of deltas to match a new span layout that adds
// buckets, we simply need to generate a list of inserts.
//
// Note: Within expandSpansForward we don't have to worry about the changes to the
// spans themselves, thanks to the iterators we get to work with the more useful
// bucket indices (which of course directly correspond to the buckets we have to
// adjust).
func expandFloatSpansAndBuckets(a, b []histogram.Span, aBuckets []xorValue, bBuckets []float64) (forward, backward []Insert, ok bool) {
	ai := newBucketIterator(a)
	bi := newBucketIterator(b)

	var aInserts []Insert // To insert into buckets of a, to make up for missing buckets in b.
	var bInserts []Insert // To insert into buckets of b, to make up for missing empty(!) buckets in a.

	// When aInter.num or bInter.num becomes > 0, this becomes a valid insert that should
	// be yielded when we finish a streak of new buckets.
	var aInter Insert
	var bInter Insert

	aIdx, aOK := ai.Next()
	bIdx, bOK := bi.Next()

	// Bucket count. Initialize the absolute count and index into the
	// positive/negative counts or deltas array. The bucket count is
	// used to detect counter reset as well as unused buckets in a.
	var (
		aCount    float64
		bCount    float64
		aCountIdx int
		bCountIdx int
	)
	if aOK {
		aCount = aBuckets[aCountIdx].value
	}
	if bOK {
		bCount = bBuckets[bCountIdx]
	}

loop:
	for {
		switch {
		case aOK && bOK:
			switch {
			case aIdx == bIdx: // Both have an identical bucket index.
				// Bucket count. Check bucket for reset from a to b.
				if aCount > bCount {
					return nil, nil, false
				}

				// Finish WIP insert for a and reset.
				if aInter.num > 0 {
					aInserts = append(aInserts, aInter)
					aInter.num = 0
				}

				// Finish WIP insert for b and reset.
				if bInter.num > 0 {
					bInserts = append(bInserts, bInter)
					bInter.num = 0
				}

				aIdx, aOK = ai.Next()
				bIdx, bOK = bi.Next()
				aInter.pos++ // Advance potential insert position.
				aCountIdx++  // Advance absolute bucket count index for a.
				if aOK {
					aCount = aBuckets[aCountIdx].value
				}
				bInter.pos++ // Advance potential insert position.
				bCountIdx++  // Advance absolute bucket count index for b.
				if bOK {
					bCount = bBuckets[bCountIdx]
				}

				continue
			case aIdx < bIdx: // b misses a bucket index that is in a.
				// This is ok if the count in a is 0, in which case we make a note to
				// fill in the bucket in b and advance a.
				if aCount == 0 {
					bInter.num++ // Mark that we need to insert a bucket in b.
					bInter.bucketIdx = aIdx
					// Advance a
					if aInter.num > 0 {
						aInserts = append(aInserts, aInter)
						aInter.num = 0
					}
					aIdx, aOK = ai.Next()
					aInter.pos++
					aCountIdx++
					if aOK {
						aCount = aBuckets[aCountIdx].value
					}
					continue
				}
				// Otherwise we are missing a bucket that was in use in a, which is a reset.
				return nil, nil, false
			case aIdx > bIdx: // a misses a value that is in b. Forward b and recompare.
				aInter.num++
				bInter.bucketIdx = bIdx
				// Advance b
				if bInter.num > 0 {
					bInserts = append(bInserts, bInter)
					bInter.num = 0
				}
				bIdx, bOK = bi.Next()
				bInter.pos++
				bCountIdx++
				if bOK {
					bCount = bBuckets[bCountIdx]
				}
			}
		case aOK && !bOK: // b misses a value that is in a.
			// This is ok if the count in a is 0, in which case we make a note to
			// fill in the bucket in b and advance a.
			if aCount == 0 {
				bInter.num++
				bInter.bucketIdx = aIdx
				// Advance a
				if aInter.num > 0 {
					aInserts = append(aInserts, aInter)
					aInter.num = 0
				}
				aIdx, aOK = ai.Next()
				aInter.pos++ // Advance potential insert position.
				// Update absolute bucket counts for a.
				aCountIdx++
				if aOK {
					aCount = aBuckets[aCountIdx].value
				}
				continue
			}
			// Otherwise we are missing a bucket that was in use in a, which is a reset.
			return nil, nil, false
		case !aOK && bOK: // a misses a value that is in b. Forward b and recompare.
			aInter.num++
			bInter.bucketIdx = bIdx
			// Advance b
			if bInter.num > 0 {
				bInserts = append(bInserts, bInter)
				bInter.num = 0
			}
			bIdx, bOK = bi.Next()
			bInter.pos++ // Advance potential insert position.
			// Update absolute bucket counts for b.
			bCountIdx++
			if bOK {
				bCount = bBuckets[bCountIdx]
			}
		default: // Both iterators ran out. We're done.
			if aInter.num > 0 {
				aInserts = append(aInserts, aInter)
			}
			if bInter.num > 0 {
				bInserts = append(bInserts, bInter)
			}
			break loop
		}
	}

	return aInserts, bInserts, true
}

// appendableGauge returns whether the chunk can be appended to, and if so
// whether:
//  1. Any recoding needs to happen to the chunk using the provided inserts
//     (in case of any new buckets, positive or negative range, respectively).
//  2. Any recoding needs to happen for the histogram being appended, using the
//     backward inserts (in case of any missing buckets, positive or negative
//     range, respectively).
//
// This method must be only used for gauge histograms.
//
// The chunk is not appendable in the following cases:
//   - The schema has changed.
//   - The custom bounds have changed if the current schema is custom buckets.
//   - The threshold for the zero bucket has changed.
//   - The last sample in the chunk was stale while the current sample is not stale.
func (a *FloatHistogramAppender) appendableGauge(h *histogram.FloatHistogram) (
	positiveInserts, negativeInserts []Insert,
	backwardPositiveInserts, backwardNegativeInserts []Insert,
	positiveSpans, negativeSpans []histogram.Span,
	okToAppend bool,
) {
	if a.NumSamples() > 0 && a.GetCounterResetHeader() != GaugeType {
		return
	}
	if value.IsStaleNaN(h.Sum) {
		// This is a stale sample whose buckets and spans don't matter.
		okToAppend = true
		return
	}
	if value.IsStaleNaN(a.sum.value) {
		// If the last sample was stale, then we can only accept stale
		// samples in this chunk.
		return
	}

	if h.Schema != a.schema || h.ZeroThreshold != a.zThreshold {
		return
	}

	if histogram.IsCustomBucketsSchema(h.Schema) && !histogram.FloatBucketsMatch(h.CustomValues, a.customValues) {
		return
	}

	positiveInserts, backwardPositiveInserts, positiveSpans = expandSpansBothWays(a.pSpans, h.PositiveSpans)
	negativeInserts, backwardNegativeInserts, negativeSpans = expandSpansBothWays(a.nSpans, h.NegativeSpans)
	okToAppend = true
	return
}

// appendFloatHistogram appends a float histogram to the chunk. The caller must ensure that
// the histogram is properly structured, e.g. the number of buckets used
// corresponds to the number conveyed by the span structures. First call
// Appendable() and act accordingly!
func (a *FloatHistogramAppender) appendFloatHistogram(t int64, h *histogram.FloatHistogram) {
	var tDelta int64
	num := binary.BigEndian.Uint16(a.b.bytes())

	if value.IsStaleNaN(h.Sum) {
		// Emptying out other fields to write no buckets, and an empty
		// layout in case of first histogram in the chunk.
		h = &histogram.FloatHistogram{Sum: h.Sum}
	}

	if num == 0 {
		// The first append gets the privilege to dictate the layout
		// but it's also responsible for encoding it into the chunk!
		writeHistogramChunkLayout(a.b, h.Schema, h.ZeroThreshold, h.PositiveSpans, h.NegativeSpans, h.CustomValues)
		a.schema = h.Schema
		a.zThreshold = h.ZeroThreshold

		if len(h.PositiveSpans) > 0 {
			a.pSpans = make([]histogram.Span, len(h.PositiveSpans))
			copy(a.pSpans, h.PositiveSpans)
		} else {
			a.pSpans = nil
		}
		if len(h.NegativeSpans) > 0 {
			a.nSpans = make([]histogram.Span, len(h.NegativeSpans))
			copy(a.nSpans, h.NegativeSpans)
		} else {
			a.nSpans = nil
		}
		if len(h.CustomValues) > 0 {
			a.customValues = make([]float64, len(h.CustomValues))
			copy(a.customValues, h.CustomValues)
		} else {
			a.customValues = nil
		}

		numPBuckets, numNBuckets := countSpans(h.PositiveSpans), countSpans(h.NegativeSpans)
		if numPBuckets > 0 {
			a.pBuckets = make([]xorValue, numPBuckets)
			for i := 0; i < numPBuckets; i++ {
				a.pBuckets[i] = xorValue{
					value:   h.PositiveBuckets[i],
					leading: 0xff,
				}
			}
		} else {
			a.pBuckets = nil
		}
		if numNBuckets > 0 {
			a.nBuckets = make([]xorValue, numNBuckets)
			for i := 0; i < numNBuckets; i++ {
				a.nBuckets[i] = xorValue{
					value:   h.NegativeBuckets[i],
					leading: 0xff,
				}
			}
		} else {
			a.nBuckets = nil
		}

		// Now store the actual data.
		putVarbitInt(a.b, t)
		a.b.writeBits(math.Float64bits(h.Count), 64)
		a.b.writeBits(math.Float64bits(h.ZeroCount), 64)
		a.b.writeBits(math.Float64bits(h.Sum), 64)
		a.cnt.value = h.Count
		a.zCnt.value = h.ZeroCount
		a.sum.value = h.Sum
		for _, b := range h.PositiveBuckets {
			a.b.writeBits(math.Float64bits(b), 64)
		}
		for _, b := range h.NegativeBuckets {
			a.b.writeBits(math.Float64bits(b), 64)
		}
	} else {
		// The case for the 2nd sample with single deltas is implicitly handled correctly with the double delta code,
		// so we don't need a separate single delta logic for the 2nd sample.
		tDelta = t - a.t
		tDod := tDelta - a.tDelta
		putVarbitInt(a.b, tDod)

		a.writeXorValue(&a.cnt, h.Count)
		a.writeXorValue(&a.zCnt, h.ZeroCount)
		a.writeXorValue(&a.sum, h.Sum)

		for i, b := range h.PositiveBuckets {
			a.writeXorValue(&a.pBuckets[i], b)
		}
		for i, b := range h.NegativeBuckets {
			a.writeXorValue(&a.nBuckets[i], b)
		}
	}

	binary.BigEndian.PutUint16(a.b.bytes(), num+1)

	a.t = t
	a.tDelta = tDelta
}

func (a *FloatHistogramAppender) writeXorValue(old *xorValue, v float64) {
	xorWrite(a.b, v, old.value, &old.leading, &old.trailing)
	old.value = v
}

// recode converts the current chunk to accommodate an expansion of the set of
// (positive and/or negative) buckets used, according to the provided inserts,
// resulting in the honoring of the provided new positive and negative spans. To
// continue appending, use the returned Appender rather than the receiver of
// this method.
func (a *FloatHistogramAppender) recode(
	positiveInserts, negativeInserts []Insert,
	positiveSpans, negativeSpans []histogram.Span,
) (Chunk, Appender) {
	// TODO(beorn7): This currently just decodes everything and then encodes
	// it again with the new span layout. This can probably be done in-place
	// by editing the chunk. But let's first see how expensive it is in the
	// big picture. Also, in-place editing might create concurrency issues.
	byts := a.b.bytes()
	it := newFloatHistogramIterator(byts)
	hc := NewFloatHistogramChunk()
	app, err := hc.Appender()
	if err != nil {
		panic(err) // This should never happen for an empty float histogram chunk.
	}
	happ := app.(*FloatHistogramAppender)
	numPositiveBuckets, numNegativeBuckets := countSpans(positiveSpans), countSpans(negativeSpans)

	for it.Next() == ValFloatHistogram {
		tOld, hOld := it.AtFloatHistogram(nil)

		// We have to newly allocate slices for the modified buckets
		// here because they are kept by the appender until the next
		// append.
		// TODO(beorn7): We might be able to optimize this.
		var positiveBuckets, negativeBuckets []float64
		if numPositiveBuckets > 0 {
			positiveBuckets = make([]float64, numPositiveBuckets)
		}
		if numNegativeBuckets > 0 {
			negativeBuckets = make([]float64, numNegativeBuckets)
		}

		// Save the modified histogram to the new chunk.
		hOld.PositiveSpans, hOld.NegativeSpans = positiveSpans, negativeSpans
		if len(positiveInserts) > 0 {
			hOld.PositiveBuckets = insert(hOld.PositiveBuckets, positiveBuckets, positiveInserts, false)
		}
		if len(negativeInserts) > 0 {
			hOld.NegativeBuckets = insert(hOld.NegativeBuckets, negativeBuckets, negativeInserts, false)
		}
		happ.appendFloatHistogram(tOld, hOld)
	}

	happ.setCounterResetHeader(CounterResetHeader(byts[2] & CounterResetHeaderMask))
	return hc, app
}

// recodeHistogram converts the current histogram (in-place) to accommodate an expansion of the set of
// (positive and/or negative) buckets used.
func (a *FloatHistogramAppender) recodeHistogram(
	fh *histogram.FloatHistogram,
	pBackwardInter, nBackwardInter []Insert,
) {
	if len(pBackwardInter) > 0 {
		numPositiveBuckets := countSpans(fh.PositiveSpans)
		fh.PositiveBuckets = insert(fh.PositiveBuckets, make([]float64, numPositiveBuckets), pBackwardInter, false)
	}
	if len(nBackwardInter) > 0 {
		numNegativeBuckets := countSpans(fh.NegativeSpans)
		fh.NegativeBuckets = insert(fh.NegativeBuckets, make([]float64, numNegativeBuckets), nBackwardInter, false)
	}
}

func (a *FloatHistogramAppender) AppendHistogram(*HistogramAppender, int64, *histogram.Histogram, bool) (Chunk, bool, Appender, error) {
	panic("appended a histogram sample to a float histogram chunk")
}

func (a *FloatHistogramAppender) AppendFloatHistogram(prev *FloatHistogramAppender, t int64, h *histogram.FloatHistogram, appendOnly bool) (Chunk, bool, Appender, error) {
	if a.NumSamples() == 0 {
		a.appendFloatHistogram(t, h)
		if h.CounterResetHint == histogram.GaugeType {
			a.setCounterResetHeader(GaugeType)
			return nil, false, a, nil
		}

		switch {
		case h.CounterResetHint == histogram.CounterReset:
			// Always honor the explicit counter reset hint.
			a.setCounterResetHeader(CounterReset)
		case prev != nil:
			// This is a new chunk, but continued from a previous one. We need to calculate the reset header unless already set.
			_, _, _, _, _, counterReset := prev.appendable(h)
			if counterReset {
				a.setCounterResetHeader(CounterReset)
			} else {
				a.setCounterResetHeader(NotCounterReset)
			}
		}
		return nil, false, a, nil
	}

	// Adding counter-like histogram.
	if h.CounterResetHint != histogram.GaugeType {
		pForwardInserts, nForwardInserts, pBackwardInserts, nBackwardInserts, okToAppend, counterReset := a.appendable(h)
		if !okToAppend || counterReset {
			if appendOnly {
				if counterReset {
					return nil, false, a, errors.New("float histogram counter reset")
				}
				return nil, false, a, errors.New("float histogram schema change")
			}
			newChunk := NewFloatHistogramChunk()
			app, err := newChunk.Appender()
			if err != nil {
				panic(err) // This should never happen for an empty float histogram chunk.
			}
			happ := app.(*FloatHistogramAppender)
			if counterReset {
				happ.setCounterResetHeader(CounterReset)
			}
			happ.appendFloatHistogram(t, h)
			return newChunk, false, app, nil
		}
		if len(pBackwardInserts) > 0 || len(nBackwardInserts) > 0 {
			// The histogram needs to be expanded to have the extra empty buckets
			// of the chunk.
			if len(pForwardInserts) == 0 && len(nForwardInserts) == 0 {
				// No new chunks from the histogram, so the spans of the appender can accommodate the new buckets.
				// However we need to make a copy in case the input is sharing spans from an iterator.
				h.PositiveSpans = make([]histogram.Span, len(a.pSpans))
				copy(h.PositiveSpans, a.pSpans)
				h.NegativeSpans = make([]histogram.Span, len(a.nSpans))
				copy(h.NegativeSpans, a.nSpans)
			} else {
				// Spans need pre-adjusting to accommodate the new buckets.
				h.PositiveSpans = adjustForInserts(h.PositiveSpans, pBackwardInserts)
				h.NegativeSpans = adjustForInserts(h.NegativeSpans, nBackwardInserts)
			}
			a.recodeHistogram(h, pBackwardInserts, nBackwardInserts)
		}
		if len(pForwardInserts) > 0 || len(nForwardInserts) > 0 {
			if appendOnly {
				return nil, false, a, fmt.Errorf("float histogram layout change with %d positive and %d negative forwards inserts", len(pForwardInserts), len(nForwardInserts))
			}
			chk, app := a.recode(
				pForwardInserts, nForwardInserts,
				h.PositiveSpans, h.NegativeSpans,
			)
			app.(*FloatHistogramAppender).appendFloatHistogram(t, h)
			return chk, true, app, nil
		}
		a.appendFloatHistogram(t, h)
		return nil, false, a, nil
	}
	// Adding gauge histogram.
	pForwardInserts, nForwardInserts, pBackwardInserts, nBackwardInserts, pMergedSpans, nMergedSpans, okToAppend := a.appendableGauge(h)
	if !okToAppend {
		if appendOnly {
			return nil, false, a, errors.New("float gauge histogram schema change")
		}
		newChunk := NewFloatHistogramChunk()
		app, err := newChunk.Appender()
		if err != nil {
			panic(err) // This should never happen for an empty float histogram chunk.
		}
		happ := app.(*FloatHistogramAppender)
		happ.setCounterResetHeader(GaugeType)
		happ.appendFloatHistogram(t, h)
		return newChunk, false, app, nil
	}

	if len(pBackwardInserts)+len(nBackwardInserts) > 0 {
		if appendOnly {
			return nil, false, a, fmt.Errorf("float gauge histogram layout change with %d positive and %d negative backwards inserts", len(pBackwardInserts), len(nBackwardInserts))
		}
		h.PositiveSpans = pMergedSpans
		h.NegativeSpans = nMergedSpans
		a.recodeHistogram(h, pBackwardInserts, nBackwardInserts)
	}

	if len(pForwardInserts) > 0 || len(nForwardInserts) > 0 {
		if appendOnly {
			return nil, false, a, fmt.Errorf("float gauge histogram layout change with %d positive and %d negative forwards inserts", len(pForwardInserts), len(nForwardInserts))
		}
		chk, app := a.recode(
			pForwardInserts, nForwardInserts,
			h.PositiveSpans, h.NegativeSpans,
		)
		app.(*FloatHistogramAppender).appendFloatHistogram(t, h)
		return chk, true, app, nil
	}

	a.appendFloatHistogram(t, h)
	return nil, false, a, nil
}

type floatHistogramIterator struct {
	br       bstreamReader
	numTotal uint16
	numRead  uint16

	counterResetHeader CounterResetHeader

	// Layout:
	schema         int32
	zThreshold     float64
	pSpans, nSpans []histogram.Span
	customValues   []float64

	// For the fields that are tracked as deltas and ultimately dod's.
	t      int64
	tDelta int64

	// All Gorilla xor encoded.
	sum, cnt, zCnt xorValue

	// Buckets are not of type xorValue to avoid creating
	// new slices for every AtFloatHistogram call.
	pBuckets, nBuckets                 []float64
	pBucketsLeading, nBucketsLeading   []uint8
	pBucketsTrailing, nBucketsTrailing []uint8

	err error

	// Track calls to retrieve methods. Once they have been called, we
	// cannot recycle the bucket slices anymore because we have returned
	// them in the histogram.
	atFloatHistogramCalled bool
}

func (it *floatHistogramIterator) Seek(t int64) ValueType {
	if it.err != nil {
		return ValNone
	}

	for t > it.t || it.numRead == 0 {
		if it.Next() == ValNone {
			return ValNone
		}
	}
	return ValFloatHistogram
}

func (it *floatHistogramIterator) At() (int64, float64) {
	panic("cannot call floatHistogramIterator.At")
}

func (it *floatHistogramIterator) AtHistogram(*histogram.Histogram) (int64, *histogram.Histogram) {
	panic("cannot call floatHistogramIterator.AtHistogram")
}

func (it *floatHistogramIterator) AtFloatHistogram(fh *histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	if value.IsStaleNaN(it.sum.value) {
		return it.t, &histogram.FloatHistogram{Sum: it.sum.value}
	}
	if fh == nil {
		it.atFloatHistogramCalled = true
		return it.t, &histogram.FloatHistogram{
			CounterResetHint: counterResetHint(it.counterResetHeader, it.numRead),
			Count:            it.cnt.value,
			ZeroCount:        it.zCnt.value,
			Sum:              it.sum.value,
			ZeroThreshold:    it.zThreshold,
			Schema:           it.schema,
			PositiveSpans:    it.pSpans,
			NegativeSpans:    it.nSpans,
			PositiveBuckets:  it.pBuckets,
			NegativeBuckets:  it.nBuckets,
			CustomValues:     it.customValues,
		}
	}

	fh.CounterResetHint = counterResetHint(it.counterResetHeader, it.numRead)
	fh.Schema = it.schema
	fh.ZeroThreshold = it.zThreshold
	fh.ZeroCount = it.zCnt.value
	fh.Count = it.cnt.value
	fh.Sum = it.sum.value

	fh.PositiveSpans = resize(fh.PositiveSpans, len(it.pSpans))
	copy(fh.PositiveSpans, it.pSpans)

	fh.NegativeSpans = resize(fh.NegativeSpans, len(it.nSpans))
	copy(fh.NegativeSpans, it.nSpans)

	fh.PositiveBuckets = resize(fh.PositiveBuckets, len(it.pBuckets))
	copy(fh.PositiveBuckets, it.pBuckets)

	fh.NegativeBuckets = resize(fh.NegativeBuckets, len(it.nBuckets))
	copy(fh.NegativeBuckets, it.nBuckets)

	fh.CustomValues = resize(fh.CustomValues, len(it.customValues))
	copy(fh.CustomValues, it.customValues)

	return it.t, fh
}

func (it *floatHistogramIterator) AtT() int64 {
	return it.t
}

func (it *floatHistogramIterator) Err() error {
	return it.err
}

func (it *floatHistogramIterator) Reset(b []byte) {
	// The first 3 bytes contain chunk headers.
	// We skip that for actual samples.
	it.br = newBReader(b[3:])
	it.numTotal = binary.BigEndian.Uint16(b)
	it.numRead = 0

	it.counterResetHeader = CounterResetHeader(b[2] & CounterResetHeaderMask)

	it.t, it.tDelta = 0, 0
	it.cnt, it.zCnt, it.sum = xorValue{}, xorValue{}, xorValue{}

	if it.atFloatHistogramCalled {
		it.atFloatHistogramCalled = false
		it.pBuckets, it.nBuckets = nil, nil
		it.pSpans, it.nSpans = nil, nil
		it.customValues = nil
	} else {
		it.pBuckets, it.nBuckets = it.pBuckets[:0], it.nBuckets[:0]
	}
	it.pBucketsLeading, it.pBucketsTrailing = it.pBucketsLeading[:0], it.pBucketsTrailing[:0]
	it.nBucketsLeading, it.nBucketsTrailing = it.nBucketsLeading[:0], it.nBucketsTrailing[:0]

	it.err = nil
}

func (it *floatHistogramIterator) Next() ValueType {
	if it.err != nil || it.numRead == it.numTotal {
		return ValNone
	}

	if it.numRead == 0 {
		// The first read is responsible for reading the chunk layout
		// and for initializing fields that depend on it. We give
		// counter reset info at chunk level, hence we discard it here.
		schema, zeroThreshold, posSpans, negSpans, customValues, err := readHistogramChunkLayout(&it.br)
		if err != nil {
			it.err = err
			return ValNone
		}
		it.schema = schema
		it.zThreshold = zeroThreshold
		it.pSpans, it.nSpans = posSpans, negSpans
		it.customValues = customValues
		numPBuckets, numNBuckets := countSpans(posSpans), countSpans(negSpans)
		// Allocate bucket slices as needed, recycling existing slices
		// in case this iterator was reset and already has slices of a
		// sufficient capacity.
		if numPBuckets > 0 {
			it.pBuckets = append(it.pBuckets, make([]float64, numPBuckets)...)
			it.pBucketsLeading = append(it.pBucketsLeading, make([]uint8, numPBuckets)...)
			it.pBucketsTrailing = append(it.pBucketsTrailing, make([]uint8, numPBuckets)...)
		}
		if numNBuckets > 0 {
			it.nBuckets = append(it.nBuckets, make([]float64, numNBuckets)...)
			it.nBucketsLeading = append(it.nBucketsLeading, make([]uint8, numNBuckets)...)
			it.nBucketsTrailing = append(it.nBucketsTrailing, make([]uint8, numNBuckets)...)
		}

		// Now read the actual data.
		t, err := readVarbitInt(&it.br)
		if err != nil {
			it.err = err
			return ValNone
		}
		it.t = t

		cnt, err := it.br.readBits(64)
		if err != nil {
			it.err = err
			return ValNone
		}
		it.cnt.value = math.Float64frombits(cnt)

		zcnt, err := it.br.readBits(64)
		if err != nil {
			it.err = err
			return ValNone
		}
		it.zCnt.value = math.Float64frombits(zcnt)

		sum, err := it.br.readBits(64)
		if err != nil {
			it.err = err
			return ValNone
		}
		it.sum.value = math.Float64frombits(sum)

		for i := range it.pBuckets {
			v, err := it.br.readBits(64)
			if err != nil {
				it.err = err
				return ValNone
			}
			it.pBuckets[i] = math.Float64frombits(v)
		}
		for i := range it.nBuckets {
			v, err := it.br.readBits(64)
			if err != nil {
				it.err = err
				return ValNone
			}
			it.nBuckets[i] = math.Float64frombits(v)
		}

		it.numRead++
		return ValFloatHistogram
	}

	// The case for the 2nd sample with single deltas is implicitly handled correctly with the double delta code,
	// so we don't need a separate single delta logic for the 2nd sample.

	// Recycle bucket, span and custom value slices that have not been returned yet. Otherwise, copy them.
	// We can always recycle the slices for leading and trailing bits as they are
	// never returned to the caller.
	if it.atFloatHistogramCalled {
		it.atFloatHistogramCalled = false
		if len(it.pBuckets) > 0 {
			newBuckets := make([]float64, len(it.pBuckets))
			copy(newBuckets, it.pBuckets)
			it.pBuckets = newBuckets
		} else {
			it.pBuckets = nil
		}
		if len(it.nBuckets) > 0 {
			newBuckets := make([]float64, len(it.nBuckets))
			copy(newBuckets, it.nBuckets)
			it.nBuckets = newBuckets
		} else {
			it.nBuckets = nil
		}
		if len(it.pSpans) > 0 {
			newSpans := make([]histogram.Span, len(it.pSpans))
			copy(newSpans, it.pSpans)
			it.pSpans = newSpans
		} else {
			it.pSpans = nil
		}
		if len(it.nSpans) > 0 {
			newSpans := make([]histogram.Span, len(it.nSpans))
			copy(newSpans, it.nSpans)
			it.nSpans = newSpans
		} else {
			it.nSpans = nil
		}
		if len(it.customValues) > 0 {
			newCustomValues := make([]float64, len(it.customValues))
			copy(newCustomValues, it.customValues)
			it.customValues = newCustomValues
		} else {
			it.customValues = nil
		}
	}

	tDod, err := readVarbitInt(&it.br)
	if err != nil {
		it.err = err
		return ValNone
	}
	it.tDelta += tDod
	it.t += it.tDelta

	if ok := it.readXor(&it.cnt.value, &it.cnt.leading, &it.cnt.trailing); !ok {
		return ValNone
	}

	if ok := it.readXor(&it.zCnt.value, &it.zCnt.leading, &it.zCnt.trailing); !ok {
		return ValNone
	}

	if ok := it.readXor(&it.sum.value, &it.sum.leading, &it.sum.trailing); !ok {
		return ValNone
	}

	if value.IsStaleNaN(it.sum.value) {
		it.numRead++
		return ValFloatHistogram
	}

	for i := range it.pBuckets {
		if ok := it.readXor(&it.pBuckets[i], &it.pBucketsLeading[i], &it.pBucketsTrailing[i]); !ok {
			return ValNone
		}
	}

	for i := range it.nBuckets {
		if ok := it.readXor(&it.nBuckets[i], &it.nBucketsLeading[i], &it.nBucketsTrailing[i]); !ok {
			return ValNone
		}
	}

	it.numRead++
	return ValFloatHistogram
}

func (it *floatHistogramIterator) readXor(v *float64, leading, trailing *uint8) bool {
	err := xorRead(&it.br, v, leading, trailing)
	if err != nil {
		it.err = err
		return false
	}
	return true
}
