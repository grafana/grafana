// Copyright 2021 The Prometheus Authors
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
	"math"

	"github.com/prometheus/prometheus/model/histogram"
)

func writeHistogramChunkLayout(
	b *bstream, schema int32, zeroThreshold float64,
	positiveSpans, negativeSpans []histogram.Span, customValues []float64,
) {
	putZeroThreshold(b, zeroThreshold)
	putVarbitInt(b, int64(schema))
	putHistogramChunkLayoutSpans(b, positiveSpans)
	putHistogramChunkLayoutSpans(b, negativeSpans)
	if histogram.IsCustomBucketsSchema(schema) {
		putHistogramChunkLayoutCustomBounds(b, customValues)
	}
}

func readHistogramChunkLayout(b *bstreamReader) (
	schema int32, zeroThreshold float64,
	positiveSpans, negativeSpans []histogram.Span,
	customValues []float64,
	err error,
) {
	zeroThreshold, err = readZeroThreshold(b)
	if err != nil {
		return
	}

	v, err := readVarbitInt(b)
	if err != nil {
		return
	}
	schema = int32(v)

	positiveSpans, err = readHistogramChunkLayoutSpans(b)
	if err != nil {
		return
	}

	negativeSpans, err = readHistogramChunkLayoutSpans(b)
	if err != nil {
		return
	}

	if histogram.IsCustomBucketsSchema(schema) {
		customValues, err = readHistogramChunkLayoutCustomBounds(b)
		if err != nil {
			return
		}
	}

	return
}

func putHistogramChunkLayoutSpans(b *bstream, spans []histogram.Span) {
	putVarbitUint(b, uint64(len(spans)))
	for _, s := range spans {
		putVarbitUint(b, uint64(s.Length))
		putVarbitInt(b, int64(s.Offset))
	}
}

func readHistogramChunkLayoutSpans(b *bstreamReader) ([]histogram.Span, error) {
	var spans []histogram.Span
	num, err := readVarbitUint(b)
	if err != nil {
		return nil, err
	}
	for i := 0; i < int(num); i++ {
		length, err := readVarbitUint(b)
		if err != nil {
			return nil, err
		}

		offset, err := readVarbitInt(b)
		if err != nil {
			return nil, err
		}

		spans = append(spans, histogram.Span{
			Length: uint32(length),
			Offset: int32(offset),
		})
	}
	return spans, nil
}

func putHistogramChunkLayoutCustomBounds(b *bstream, customValues []float64) {
	putVarbitUint(b, uint64(len(customValues)))
	for _, bound := range customValues {
		putCustomBound(b, bound)
	}
}

func readHistogramChunkLayoutCustomBounds(b *bstreamReader) ([]float64, error) {
	var customValues []float64
	num, err := readVarbitUint(b)
	if err != nil {
		return nil, err
	}
	for i := 0; i < int(num); i++ {
		bound, err := readCustomBound(b)
		if err != nil {
			return nil, err
		}

		customValues = append(customValues, bound)
	}
	return customValues, nil
}

// putZeroThreshold writes the zero threshold to the bstream. It stores typical
// values in just one byte, but needs 9 bytes for other values. In detail:
//   - If the threshold is 0, store a single zero byte.
//   - If the threshold is a power of 2 between (and including) 2^-243 and 2^10,
//     take the exponent from the IEEE 754 representation of the threshold, which
//     covers a range between (and including) -242 and 11. (2^-243 is 0.5*2^-242
//     in IEEE 754 representation, and 2^10 is 0.5*2^11.) Add 243 to the exponent
//     and store the result (which will be between 1 and 254) as a single
//     byte. Note that small powers of two are preferred values for the zero
//     threshold. The default value for the zero threshold is 2^-128 (or
//     0.5*2^-127 in IEEE 754 representation) and will therefore be encoded as a
//     single byte (with value 116).
//   - In all other cases, store 255 as a single byte, followed by the 8 bytes of
//     the threshold as a float64, i.e. taking 9 bytes in total.
func putZeroThreshold(b *bstream, threshold float64) {
	if threshold == 0 {
		b.writeByte(0)
		return
	}
	frac, exp := math.Frexp(threshold)
	if frac != 0.5 || exp < -242 || exp > 11 {
		b.writeByte(255)
		b.writeBits(math.Float64bits(threshold), 64)
		return
	}
	b.writeByte(byte(exp + 243))
}

// readZeroThreshold reads the zero threshold written with putZeroThreshold.
func readZeroThreshold(br *bstreamReader) (float64, error) {
	b, err := br.ReadByte()
	if err != nil {
		return 0, err
	}
	switch b {
	case 0:
		return 0, nil
	case 255:
		v, err := br.readBits(64)
		if err != nil {
			return 0, err
		}
		return math.Float64frombits(v), nil
	default:
		return math.Ldexp(0.5, int(b)-243), nil
	}
}

// isWholeWhenMultiplied checks to see if the number when multiplied by 1000 can
// be converted into an integer without losing precision.
func isWholeWhenMultiplied(in float64) bool {
	i := uint(math.Round(in * 1000))
	out := float64(i) / 1000
	return in == out
}

// putCustomBound writes a custom bound to the bstream. It stores values from
// 0 to 33554.430 (inclusive) that are multiples of 0.001 in unsigned varbit
// encoding of up to 4 bytes, but needs 1 bit + 8 bytes for other values like
// negative numbers, numbers greater than 33554.430, or numbers that are not
// a multiple of 0.001, on the assumption that they are less common. In detail:
//   - Multiply the bound by 1000, without rounding.
//   - If the multiplied bound is >= 0, <= 33554430 and a whole number,
//     add 1 and store it in unsigned varbit encoding. All these numbers are
//     greater than 0, so the leading bit of the varbit is always 1!
//   - Otherwise, store a 0 bit, followed by the 8 bytes of the original
//     bound as a float64.
//
// When reading the values, we can first decode a value as unsigned varbit,
// if it's 0, then we read the next 8 bytes as a float64, otherwise
// we can convert the value to a float64 by subtracting 1 and dividing by 1000.
func putCustomBound(b *bstream, f float64) {
	tf := f * 1000
	// 33554431-1 comes from the maximum that can be stored in a varbit in 4
	// bytes, other values are stored in 8 bytes anyway.
	if tf < 0 || tf > 33554430 || !isWholeWhenMultiplied(f) {
		b.writeBit(zero)
		b.writeBits(math.Float64bits(f), 64)
		return
	}
	putVarbitUint(b, uint64(math.Round(tf))+1)
}

// readCustomBound reads the custom bound written with putCustomBound.
func readCustomBound(br *bstreamReader) (float64, error) {
	b, err := readVarbitUint(br)
	if err != nil {
		return 0, err
	}
	switch b {
	case 0:
		v, err := br.readBits(64)
		if err != nil {
			return 0, err
		}
		return math.Float64frombits(v), nil
	default:
		return float64(b-1) / 1000, nil
	}
}

type bucketIterator struct {
	spans  []histogram.Span
	span   int // Span position of last yielded bucket.
	bucket int // Bucket position within span of last yielded bucket.
	idx    int // Bucket index (globally across all spans) of last yielded bucket.
}

func newBucketIterator(spans []histogram.Span) *bucketIterator {
	b := bucketIterator{
		spans:  spans,
		span:   0,
		bucket: -1,
		idx:    -1,
	}
	if len(spans) > 0 {
		b.idx += int(spans[0].Offset)
	}
	return &b
}

func (b *bucketIterator) Next() (int, bool) {
	// We're already out of bounds.
	if b.span >= len(b.spans) {
		return 0, false
	}
	if b.bucket < int(b.spans[b.span].Length)-1 { // Try to move within same span.
		b.bucket++
		b.idx++
		return b.idx, true
	}

	for b.span < len(b.spans)-1 { // Try to move from one span to the next.
		b.span++
		b.idx += int(b.spans[b.span].Offset + 1)
		b.bucket = 0
		if b.spans[b.span].Length == 0 {
			b.idx--
			continue
		}
		return b.idx, true
	}

	// We're out of options.
	return 0, false
}

// An Insert describes how many new buckets have to be inserted before
// processing the pos'th bucket from the original slice.
type Insert struct {
	pos int
	num int

	// Optional: bucketIdx is the index of the bucket that is inserted.
	// Can be used to adjust spans.
	bucketIdx int
}

// Deprecated: expandSpansForward, use expandIntSpansAndBuckets or
// expandFloatSpansAndBuckets instead.
// expandSpansForward is left here for reference.
// expandSpansForward returns the inserts to expand the bucket spans 'a' so that
// they match the spans in 'b'. 'b' must cover the same or more buckets than
// 'a', otherwise the function will return false.
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
func expandSpansForward(a, b []histogram.Span) (forward []Insert, ok bool) {
	ai := newBucketIterator(a)
	bi := newBucketIterator(b)

	var inserts []Insert

	// When inter.num becomes > 0, this becomes a valid insert that should
	// be yielded when we finish a streak of new buckets.
	var inter Insert

	av, aOK := ai.Next()
	bv, bOK := bi.Next()
loop:
	for {
		switch {
		case aOK && bOK:
			switch {
			case av == bv: // Both have an identical value. move on!
				// Finish WIP insert and reset.
				if inter.num > 0 {
					inserts = append(inserts, inter)
				}
				inter.num = 0
				av, aOK = ai.Next()
				bv, bOK = bi.Next()
				inter.pos++
			case av < bv: // b misses a value that is in a.
				return inserts, false
			case av > bv: // a misses a value that is in b. Forward b and recompare.
				inter.num++
				bv, bOK = bi.Next()
			}
		case aOK && !bOK: // b misses a value that is in a.
			return inserts, false
		case !aOK && bOK: // a misses a value that is in b. Forward b and recompare.
			inter.num++
			bv, bOK = bi.Next()
		default: // Both iterators ran out. We're done.
			if inter.num > 0 {
				inserts = append(inserts, inter)
			}
			break loop
		}
	}

	return inserts, true
}

// expandSpansBothWays is similar to expandSpansForward, but now b may also
// cover an entirely different set of buckets. The function returns the
// “forward” inserts to expand 'a' to also cover all the buckets exclusively
// covered by 'b', and it returns the “backward” inserts to expand 'b' to also
// cover all the buckets exclusively covered by 'a'.
func expandSpansBothWays(a, b []histogram.Span) (forward, backward []Insert, mergedSpans []histogram.Span) {
	ai := newBucketIterator(a)
	bi := newBucketIterator(b)

	var fInserts, bInserts []Insert
	var lastBucket int
	addBucket := func(b int) {
		offset := b - lastBucket - 1
		if offset == 0 && len(mergedSpans) > 0 {
			mergedSpans[len(mergedSpans)-1].Length++
		} else {
			if len(mergedSpans) == 0 {
				offset++
			}
			mergedSpans = append(mergedSpans, histogram.Span{
				Offset: int32(offset),
				Length: 1,
			})
		}

		lastBucket = b
	}

	// When fInter.num (or bInter.num, respectively) becomes > 0, this
	// becomes a valid insert that should be yielded when we finish a streak
	// of new buckets.
	var fInter, bInter Insert

	av, aOK := ai.Next()
	bv, bOK := bi.Next()
loop:
	for {
		switch {
		case aOK && bOK:
			switch {
			case av == bv: // Both have an identical value. move on!
				// Finish WIP insert and reset.
				if fInter.num > 0 {
					fInserts = append(fInserts, fInter)
					fInter.num = 0
				}
				if bInter.num > 0 {
					bInserts = append(bInserts, bInter)
					bInter.num = 0
				}
				addBucket(av)
				av, aOK = ai.Next()
				bv, bOK = bi.Next()
				fInter.pos++
				bInter.pos++
			case av < bv: // b misses a value that is in a.
				bInter.num++
				// Collect the forward inserts before advancing
				// the position of 'a'.
				if fInter.num > 0 {
					fInserts = append(fInserts, fInter)
					fInter.num = 0
				}
				addBucket(av)
				fInter.pos++
				av, aOK = ai.Next()
			case av > bv: // a misses a value that is in b. Forward b and recompare.
				fInter.num++
				// Collect the backward inserts before advancing the
				// position of 'b'.
				if bInter.num > 0 {
					bInserts = append(bInserts, bInter)
					bInter.num = 0
				}
				addBucket(bv)
				bInter.pos++
				bv, bOK = bi.Next()
			}
		case aOK && !bOK: // b misses a value that is in a.
			bInter.num++
			addBucket(av)
			av, aOK = ai.Next()
		case !aOK && bOK: // a misses a value that is in b. Forward b and recompare.
			fInter.num++
			addBucket(bv)
			bv, bOK = bi.Next()
		default: // Both iterators ran out. We're done.
			if fInter.num > 0 {
				fInserts = append(fInserts, fInter)
			}
			if bInter.num > 0 {
				bInserts = append(bInserts, bInter)
			}
			break loop
		}
	}

	return fInserts, bInserts, mergedSpans
}

type bucketValue interface {
	int64 | float64
}

// insert merges 'in' with the provided inserts and writes them into 'out',
// which must already have the appropriate length. 'out' is also returned for
// convenience.
func insert[BV bucketValue](in, out []BV, inserts []Insert, deltas bool) []BV {
	var (
		oi int // Position in out.
		v  BV  // The last value seen.
		ii int // The next insert to process.
	)
	for i, d := range in {
		if ii < len(inserts) && i == inserts[ii].pos {
			// We have an insert!
			// Add insert.num new delta values such that their
			// bucket values equate 0. When deltas==false, it means
			// that it is an absolute value. So we set it to 0
			// directly.
			if deltas {
				out[oi] = -v
			} else {
				out[oi] = 0
			}
			oi++
			for x := 1; x < inserts[ii].num; x++ {
				out[oi] = 0
				oi++
			}
			ii++

			// Now save the value from the input. The delta value we
			// should save is the original delta value + the last
			// value of the point before the insert (to undo the
			// delta that was introduced by the insert). When
			// deltas==false, it means that it is an absolute value,
			// so we set it directly to the value in the 'in' slice.
			if deltas {
				out[oi] = d + v
			} else {
				out[oi] = d
			}
			oi++
			v = d + v
			continue
		}
		// If there was no insert, the original delta is still valid.
		out[oi] = d
		oi++
		v += d
	}
	switch ii {
	case len(inserts):
		// All inserts processed. Nothing more to do.
	case len(inserts) - 1:
		// One more insert to process at the end.
		if deltas {
			out[oi] = -v
		} else {
			out[oi] = 0
		}
		oi++
		for x := 1; x < inserts[ii].num; x++ {
			out[oi] = 0
			oi++
		}
	default:
		panic("unprocessed inserts left")
	}
	return out
}

// counterResetHint returns a CounterResetHint based on the CounterResetHeader
// and on the position into the chunk.
func counterResetHint(crh CounterResetHeader, numRead uint16) histogram.CounterResetHint {
	switch {
	case crh == GaugeType:
		// A gauge histogram chunk only contains gauge histograms.
		return histogram.GaugeType
	case numRead > 1:
		// In a counter histogram chunk, there will not be any counter
		// resets after the first histogram.
		return histogram.NotCounterReset
	default:
		// Sadly, we have to return "unknown" as the hint for all other
		// cases, even if we know that the chunk was started with or without a
		// counter reset. But we cannot be sure that the previous chunk
		// still exists in the TSDB, or if the previous chunk was added later
		// by out of order or backfill, so we conservatively return "unknown".
		//
		// TODO: If we can detect whether the previous and current chunk are
		// actually consecutive then we could trust its hint:
		// https://github.com/prometheus/prometheus/issues/15346.
		return histogram.UnknownCounterReset
	}
}

// adjustForInserts adjusts the spans for the given inserts.
func adjustForInserts(spans []histogram.Span, inserts []Insert) (mergedSpans []histogram.Span) {
	if len(inserts) == 0 {
		return spans
	}

	it := newBucketIterator(spans)

	var (
		lastBucket int
		i          int
		insertIdx  = inserts[i].bucketIdx
		insertNum  = inserts[i].num
	)

	addBucket := func(b int) {
		offset := b - lastBucket - 1
		if offset == 0 && len(mergedSpans) > 0 {
			mergedSpans[len(mergedSpans)-1].Length++
		} else {
			if len(mergedSpans) == 0 {
				offset++
			}
			mergedSpans = append(mergedSpans, histogram.Span{
				Offset: int32(offset),
				Length: 1,
			})
		}

		lastBucket = b
	}
	consumeInsert := func() {
		// Consume the insert.
		insertNum--
		if insertNum == 0 {
			i++
			if i < len(inserts) {
				insertIdx = inserts[i].bucketIdx
				insertNum = inserts[i].num
			}
		} else {
			insertIdx++
		}
	}

	bucket, ok := it.Next()
	for ok {
		if i < len(inserts) && insertIdx < bucket {
			addBucket(insertIdx)
			consumeInsert()
		} else {
			addBucket(bucket)
			bucket, ok = it.Next()
		}
	}
	for i < len(inserts) {
		addBucket(inserts[i].bucketIdx)
		consumeInsert()
	}
	return
}
