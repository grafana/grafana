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

package histogram

import (
	"errors"
	"fmt"
	"math"
	"strings"
)

const (
	ExponentialSchemaMax int32 = 8
	ExponentialSchemaMin int32 = -4
	CustomBucketsSchema  int32 = -53
)

var (
	ErrHistogramCountNotBigEnough     = errors.New("histogram's observation count should be at least the number of observations found in the buckets")
	ErrHistogramCountMismatch         = errors.New("histogram's observation count should equal the number of observations found in the buckets (in absence of NaN)")
	ErrHistogramNegativeBucketCount   = errors.New("histogram has a bucket whose observation count is negative")
	ErrHistogramSpanNegativeOffset    = errors.New("histogram has a span whose offset is negative")
	ErrHistogramSpansBucketsMismatch  = errors.New("histogram spans specify different number of buckets than provided")
	ErrHistogramCustomBucketsMismatch = errors.New("histogram custom bounds are too few")
	ErrHistogramCustomBucketsInvalid  = errors.New("histogram custom bounds must be in strictly increasing order")
	ErrHistogramCustomBucketsInfinite = errors.New("histogram custom bounds must be finite")
	ErrHistogramsIncompatibleSchema   = errors.New("cannot apply this operation on histograms with a mix of exponential and custom bucket schemas")
	ErrHistogramsIncompatibleBounds   = errors.New("cannot apply this operation on custom buckets histograms with different custom bounds")
)

func IsCustomBucketsSchema(s int32) bool {
	return s == CustomBucketsSchema
}

func IsExponentialSchema(s int32) bool {
	return s >= ExponentialSchemaMin && s <= ExponentialSchemaMax
}

// BucketCount is a type constraint for the count in a bucket, which can be
// float64 (for type FloatHistogram) or uint64 (for type Histogram).
type BucketCount interface {
	float64 | uint64
}

// InternalBucketCount is used internally by Histogram and FloatHistogram. The
// difference to the BucketCount above is that Histogram internally uses deltas
// between buckets rather than absolute counts (while FloatHistogram uses
// absolute counts directly). Go type parameters don't allow type
// specialization. Therefore, where special treatment of deltas between buckets
// vs. absolute counts is important, this information has to be provided as a
// separate boolean parameter "deltaBuckets".
type InternalBucketCount interface {
	float64 | int64
}

// Bucket represents a bucket with lower and upper limit and the absolute count
// of samples in the bucket. It also specifies if each limit is inclusive or
// not. (Mathematically, inclusive limits create a closed interval, and
// non-inclusive limits an open interval.)
//
// To represent cumulative buckets, Lower is set to -Inf, and the Count is then
// cumulative (including the counts of all buckets for smaller values).
type Bucket[BC BucketCount] struct {
	Lower, Upper                   float64
	LowerInclusive, UpperInclusive bool
	Count                          BC

	// Index within schema. To easily compare buckets that share the same
	// schema and sign (positive or negative). Irrelevant for the zero bucket.
	Index int32
}

// strippedBucket is Bucket without bound values (which are expensive to calculate
// and not used in certain use cases).
type strippedBucket[BC BucketCount] struct {
	count BC
	index int32
}

// String returns a string representation of a Bucket, using the usual
// mathematical notation of '['/']' for inclusive bounds and '('/')' for
// non-inclusive bounds.
func (b Bucket[BC]) String() string {
	var sb strings.Builder
	if b.LowerInclusive {
		sb.WriteRune('[')
	} else {
		sb.WriteRune('(')
	}
	fmt.Fprintf(&sb, "%g,%g", b.Lower, b.Upper)
	if b.UpperInclusive {
		sb.WriteRune(']')
	} else {
		sb.WriteRune(')')
	}
	fmt.Fprintf(&sb, ":%v", b.Count)
	return sb.String()
}

// BucketIterator iterates over the buckets of a Histogram, returning decoded
// buckets.
type BucketIterator[BC BucketCount] interface {
	// Next advances the iterator by one.
	Next() bool
	// At returns the current bucket.
	At() Bucket[BC]
}

// baseBucketIterator provides a struct that is shared by most BucketIterator
// implementations, together with an implementation of the At method. This
// iterator can be embedded in full implementations of BucketIterator to save on
// code replication.
type baseBucketIterator[BC BucketCount, IBC InternalBucketCount] struct {
	schema  int32
	spans   []Span
	buckets []IBC

	positive bool // Whether this is for positive buckets.

	spansIdx   int    // Current span within spans slice.
	idxInSpan  uint32 // Index in the current span. 0 <= idxInSpan < span.Length.
	bucketsIdx int    // Current bucket within buckets slice.

	currCount IBC   // Count in the current bucket.
	currIdx   int32 // The actual bucket index.

	customValues []float64 // Bounds (usually upper) for histograms with custom buckets.
}

func (b *baseBucketIterator[BC, IBC]) At() Bucket[BC] {
	return b.at(b.schema)
}

// at is an internal version of the exported At to enable using a different schema.
func (b *baseBucketIterator[BC, IBC]) at(schema int32) Bucket[BC] {
	bucket := Bucket[BC]{
		Count: BC(b.currCount),
		Index: b.currIdx,
	}
	if b.positive {
		bucket.Upper = getBound(b.currIdx, schema, b.customValues)
		bucket.Lower = getBound(b.currIdx-1, schema, b.customValues)
	} else {
		bucket.Lower = -getBound(b.currIdx, schema, b.customValues)
		bucket.Upper = -getBound(b.currIdx-1, schema, b.customValues)
	}
	if IsCustomBucketsSchema(schema) {
		bucket.LowerInclusive = b.currIdx == 0
		bucket.UpperInclusive = true
	} else {
		bucket.LowerInclusive = bucket.Lower < 0
		bucket.UpperInclusive = bucket.Upper > 0
	}
	return bucket
}

// strippedAt returns current strippedBucket (which lacks bucket bounds but is cheaper to compute).
func (b *baseBucketIterator[BC, IBC]) strippedAt() strippedBucket[BC] {
	return strippedBucket[BC]{
		count: BC(b.currCount),
		index: b.currIdx,
	}
}

// compactBuckets is a generic function used by both Histogram.Compact and
// FloatHistogram.Compact. Set deltaBuckets to true if the provided buckets are
// deltas. Set it to false if the buckets contain absolute counts.
func compactBuckets[IBC InternalBucketCount](buckets []IBC, spans []Span, maxEmptyBuckets int, deltaBuckets bool) ([]IBC, []Span) {
	// Fast path: If there are no empty buckets AND no offset in any span is
	// <= maxEmptyBuckets AND no span has length 0, there is nothing to do and we can return
	// immediately. We check that first because it's cheap and presumably
	// common.
	nothingToDo := true
	var currentBucketAbsolute IBC
	for _, bucket := range buckets {
		if deltaBuckets {
			currentBucketAbsolute += bucket
		} else {
			currentBucketAbsolute = bucket
		}
		if currentBucketAbsolute == 0 {
			nothingToDo = false
			break
		}
	}
	if nothingToDo {
		for _, span := range spans {
			if int(span.Offset) <= maxEmptyBuckets || span.Length == 0 {
				nothingToDo = false
				break
			}
		}
		if nothingToDo {
			return buckets, spans
		}
	}

	var iBucket, iSpan int
	var posInSpan uint32
	currentBucketAbsolute = 0

	// Helper function.
	emptyBucketsHere := func() int {
		i := 0
		abs := currentBucketAbsolute
		for uint32(i)+posInSpan < spans[iSpan].Length && abs == 0 {
			i++
			if i+iBucket >= len(buckets) {
				break
			}
			abs = buckets[i+iBucket]
		}
		return i
	}

	// Merge spans with zero-offset to avoid special cases later.
	if len(spans) > 1 {
		for i, span := range spans[1:] {
			if span.Offset == 0 {
				spans[iSpan].Length += span.Length
				continue
			}
			iSpan++
			if i+1 != iSpan {
				spans[iSpan] = span
			}
		}
		spans = spans[:iSpan+1]
		iSpan = 0
	}

	// Merge spans with zero-length to avoid special cases later.
	for i, span := range spans {
		if span.Length == 0 {
			if i+1 < len(spans) {
				spans[i+1].Offset += span.Offset
			}
			continue
		}
		if i != iSpan {
			spans[iSpan] = span
		}
		iSpan++
	}
	spans = spans[:iSpan]
	iSpan = 0

	// Cut out empty buckets from start and end of spans, no matter
	// what. Also cut out empty buckets from the middle of a span but only
	// if there are more than maxEmptyBuckets consecutive empty buckets.
	for iBucket < len(buckets) {
		if deltaBuckets {
			currentBucketAbsolute += buckets[iBucket]
		} else {
			currentBucketAbsolute = buckets[iBucket]
		}
		if nEmpty := emptyBucketsHere(); nEmpty > 0 {
			if posInSpan > 0 &&
				nEmpty < int(spans[iSpan].Length-posInSpan) &&
				nEmpty <= maxEmptyBuckets {
				// The empty buckets are in the middle of a
				// span, and there are few enough to not bother.
				// Just fast-forward.
				iBucket += nEmpty
				if deltaBuckets {
					currentBucketAbsolute = 0
				}
				posInSpan += uint32(nEmpty)
				continue
			}
			// In all other cases, we cut out the empty buckets.
			if deltaBuckets && iBucket+nEmpty < len(buckets) {
				currentBucketAbsolute = -buckets[iBucket]
				buckets[iBucket+nEmpty] += buckets[iBucket]
			}
			buckets = append(buckets[:iBucket], buckets[iBucket+nEmpty:]...)
			if posInSpan == 0 {
				// Start of span.
				if nEmpty == int(spans[iSpan].Length) {
					// The whole span is empty.
					offset := spans[iSpan].Offset
					spans = append(spans[:iSpan], spans[iSpan+1:]...)
					if len(spans) > iSpan {
						spans[iSpan].Offset += offset + int32(nEmpty)
					}
					continue
				}
				spans[iSpan].Length -= uint32(nEmpty)
				spans[iSpan].Offset += int32(nEmpty)
				continue
			}
			// It's in the middle or in the end of the span.
			// Split the current span.
			newSpan := Span{
				Offset: int32(nEmpty),
				Length: spans[iSpan].Length - posInSpan - uint32(nEmpty),
			}
			spans[iSpan].Length = posInSpan
			// In any case, we have to split to the next span.
			iSpan++
			posInSpan = 0
			if newSpan.Length == 0 {
				// The span is empty, so we were already at the end of a span.
				// We don't have to insert the new span, just adjust the next
				// span's offset, if there is one.
				if iSpan < len(spans) {
					spans[iSpan].Offset += int32(nEmpty)
				}
				continue
			}
			// Insert the new span.
			spans = append(spans, Span{})
			if iSpan+1 < len(spans) {
				copy(spans[iSpan+1:], spans[iSpan:])
			}
			spans[iSpan] = newSpan
			continue
		}
		iBucket++
		posInSpan++
		if posInSpan >= spans[iSpan].Length {
			posInSpan = 0
			iSpan++
		}
	}
	if maxEmptyBuckets == 0 || len(buckets) == 0 {
		return buckets, spans
	}

	// Finally, check if any offsets between spans are small enough to merge
	// the spans.
	iBucket = int(spans[0].Length)
	if deltaBuckets {
		currentBucketAbsolute = 0
		for _, bucket := range buckets[:iBucket] {
			currentBucketAbsolute += bucket
		}
	}
	iSpan = 1
	for iSpan < len(spans) {
		if int(spans[iSpan].Offset) > maxEmptyBuckets {
			l := int(spans[iSpan].Length)
			if deltaBuckets {
				for _, bucket := range buckets[iBucket : iBucket+l] {
					currentBucketAbsolute += bucket
				}
			}
			iBucket += l
			iSpan++
			continue
		}
		// Merge span with previous one and insert empty buckets.
		offset := int(spans[iSpan].Offset)
		spans[iSpan-1].Length += uint32(offset) + spans[iSpan].Length
		spans = append(spans[:iSpan], spans[iSpan+1:]...)
		newBuckets := make([]IBC, len(buckets)+offset)
		copy(newBuckets, buckets[:iBucket])
		copy(newBuckets[iBucket+offset:], buckets[iBucket:])
		if deltaBuckets {
			newBuckets[iBucket] = -currentBucketAbsolute
			newBuckets[iBucket+offset] += currentBucketAbsolute
		}
		iBucket += offset
		buckets = newBuckets
		currentBucketAbsolute = buckets[iBucket]
		// Note that with many merges, it would be more efficient to
		// first record all the chunks of empty buckets to insert and
		// then do it in one go through all the buckets.
	}

	return buckets, spans
}

func checkHistogramSpans(spans []Span, numBuckets int) error {
	var spanBuckets int
	for n, span := range spans {
		if n > 0 && span.Offset < 0 {
			return fmt.Errorf("span number %d with offset %d: %w", n+1, span.Offset, ErrHistogramSpanNegativeOffset)
		}
		spanBuckets += int(span.Length)
	}
	if spanBuckets != numBuckets {
		return fmt.Errorf("spans need %d buckets, have %d buckets: %w", spanBuckets, numBuckets, ErrHistogramSpansBucketsMismatch)
	}
	return nil
}

func checkHistogramBuckets[BC BucketCount, IBC InternalBucketCount](buckets []IBC, count *BC, deltas bool) error {
	if len(buckets) == 0 {
		return nil
	}

	var last IBC
	for i := 0; i < len(buckets); i++ {
		var c IBC
		if deltas {
			c = last + buckets[i]
		} else {
			c = buckets[i]
		}
		if c < 0 {
			return fmt.Errorf("bucket number %d has observation count of %v: %w", i+1, c, ErrHistogramNegativeBucketCount)
		}
		last = c
		*count += BC(c)
	}

	return nil
}

func checkHistogramCustomBounds(bounds []float64, spans []Span, numBuckets int) error {
	prev := math.Inf(-1)
	for _, curr := range bounds {
		if curr <= prev {
			return fmt.Errorf("previous bound is %f and current is %f: %w", prev, curr, ErrHistogramCustomBucketsInvalid)
		}
		prev = curr
	}
	if prev == math.Inf(1) {
		return fmt.Errorf("last +Inf bound must not be explicitly defined: %w", ErrHistogramCustomBucketsInfinite)
	}

	var spanBuckets int
	var totalSpanLength int
	for n, span := range spans {
		if span.Offset < 0 {
			return fmt.Errorf("span number %d with offset %d: %w", n+1, span.Offset, ErrHistogramSpanNegativeOffset)
		}
		spanBuckets += int(span.Length)
		totalSpanLength += int(span.Length) + int(span.Offset)
	}
	if spanBuckets != numBuckets {
		return fmt.Errorf("spans need %d buckets, have %d buckets: %w", spanBuckets, numBuckets, ErrHistogramSpansBucketsMismatch)
	}
	if (len(bounds) + 1) < totalSpanLength {
		return fmt.Errorf("only %d custom bounds defined which is insufficient to cover total span length of %d: %w", len(bounds), totalSpanLength, ErrHistogramCustomBucketsMismatch)
	}

	return nil
}

func getBound(idx, schema int32, customValues []float64) float64 {
	if IsCustomBucketsSchema(schema) {
		length := int32(len(customValues))
		switch {
		case idx > length || idx < -1:
			panic(fmt.Errorf("index %d out of bounds for custom bounds of length %d", idx, length))
		case idx == length:
			return math.Inf(1)
		case idx == -1:
			return math.Inf(-1)
		default:
			return customValues[idx]
		}
	}
	return getBoundExponential(idx, schema)
}

func getBoundExponential(idx, schema int32) float64 {
	// Here a bit of context about the behavior for the last bucket counting
	// regular numbers (called simply "last bucket" below) and the bucket
	// counting observations of ±Inf (called "inf bucket" below, with an idx
	// one higher than that of the "last bucket"):
	//
	// If we apply the usual formula to the last bucket, its upper bound
	// would be calculated as +Inf. The reason is that the max possible
	// regular float64 number (math.MaxFloat64) doesn't coincide with one of
	// the calculated bucket boundaries. So the calculated boundary has to
	// be larger than math.MaxFloat64, and the only float64 larger than
	// math.MaxFloat64 is +Inf. However, we want to count actual
	// observations of ±Inf in the inf bucket. Therefore, we have to treat
	// the upper bound of the last bucket specially and set it to
	// math.MaxFloat64. (The upper bound of the inf bucket, with its idx
	// being one higher than that of the last bucket, naturally comes out as
	// +Inf by the usual formula. So that's fine.)
	//
	// math.MaxFloat64 has a frac of 0.9999999999999999 and an exp of
	// 1024. If there were a float64 number following math.MaxFloat64, it
	// would have a frac of 1.0 and an exp of 1024, or equivalently a frac
	// of 0.5 and an exp of 1025. However, since frac must be smaller than
	// 1, and exp must be smaller than 1025, either representation overflows
	// a float64. (Which, in turn, is the reason that math.MaxFloat64 is the
	// largest possible float64. Q.E.D.) However, the formula for
	// calculating the upper bound from the idx and schema of the last
	// bucket results in precisely that. It is either frac=1.0 & exp=1024
	// (for schema < 0) or frac=0.5 & exp=1025 (for schema >=0). (This is,
	// by the way, a power of two where the exponent itself is a power of
	// two, 2¹⁰ in fact, which coincides with a bucket boundary in all
	// schemas.) So these are the special cases we have to catch below.
	if schema < 0 {
		exp := int(idx) << -schema
		if exp == 1024 {
			// This is the last bucket before the overflow bucket
			// (for ±Inf observations). Return math.MaxFloat64 as
			// explained above.
			return math.MaxFloat64
		}
		return math.Ldexp(1, exp)
	}

	fracIdx := idx & ((1 << schema) - 1)
	frac := exponentialBounds[schema][fracIdx]
	exp := (int(idx) >> schema) + 1
	if frac == 0.5 && exp == 1025 {
		// This is the last bucket before the overflow bucket (for ±Inf
		// observations). Return math.MaxFloat64 as explained above.
		return math.MaxFloat64
	}
	return math.Ldexp(frac, exp)
}

// exponentialBounds is a precalculated table of bucket bounds in the interval
// [0.5,1) in schema 0 to 8.
var exponentialBounds = [][]float64{
	// Schema "0":
	{0.5},
	// Schema 1:
	{0.5, 0.7071067811865475},
	// Schema 2:
	{0.5, 0.5946035575013605, 0.7071067811865475, 0.8408964152537144},
	// Schema 3:
	{
		0.5, 0.5452538663326288, 0.5946035575013605, 0.6484197773255048,
		0.7071067811865475, 0.7711054127039704, 0.8408964152537144, 0.9170040432046711,
	},
	// Schema 4:
	{
		0.5, 0.5221368912137069, 0.5452538663326288, 0.5693943173783458,
		0.5946035575013605, 0.620928906036742, 0.6484197773255048, 0.6771277734684463,
		0.7071067811865475, 0.7384130729697496, 0.7711054127039704, 0.805245165974627,
		0.8408964152537144, 0.8781260801866495, 0.9170040432046711, 0.9576032806985735,
	},
	// Schema 5:
	{
		0.5, 0.5109485743270583, 0.5221368912137069, 0.5335702003384117,
		0.5452538663326288, 0.5571933712979462, 0.5693943173783458, 0.5818624293887887,
		0.5946035575013605, 0.6076236799902344, 0.620928906036742, 0.6345254785958666,
		0.6484197773255048, 0.6626183215798706, 0.6771277734684463, 0.6919549409819159,
		0.7071067811865475, 0.7225904034885232, 0.7384130729697496, 0.7545822137967112,
		0.7711054127039704, 0.7879904225539431, 0.805245165974627, 0.8228777390769823,
		0.8408964152537144, 0.8593096490612387, 0.8781260801866495, 0.8973545375015533,
		0.9170040432046711, 0.9370838170551498, 0.9576032806985735, 0.9785720620876999,
	},
	// Schema 6:
	{
		0.5, 0.5054446430258502, 0.5109485743270583, 0.5165124395106142,
		0.5221368912137069, 0.5278225891802786, 0.5335702003384117, 0.5393803988785598,
		0.5452538663326288, 0.5511912916539204, 0.5571933712979462, 0.5632608093041209,
		0.5693943173783458, 0.5755946149764913, 0.5818624293887887, 0.5881984958251406,
		0.5946035575013605, 0.6010783657263515, 0.6076236799902344, 0.6142402680534349,
		0.620928906036742, 0.6276903785123455, 0.6345254785958666, 0.6414350080393891,
		0.6484197773255048, 0.6554806057623822, 0.6626183215798706, 0.6698337620266515,
		0.6771277734684463, 0.6845012114872953, 0.6919549409819159, 0.6994898362691555,
		0.7071067811865475, 0.7148066691959849, 0.7225904034885232, 0.7304588970903234,
		0.7384130729697496, 0.7464538641456323, 0.7545822137967112, 0.762799075372269,
		0.7711054127039704, 0.7795022001189185, 0.7879904225539431, 0.7965710756711334,
		0.805245165974627, 0.8140137109286738, 0.8228777390769823, 0.8318382901633681,
		0.8408964152537144, 0.8500531768592616, 0.8593096490612387, 0.8686669176368529,
		0.8781260801866495, 0.8876882462632604, 0.8973545375015533, 0.9071260877501991,
		0.9170040432046711, 0.9269895625416926, 0.9370838170551498, 0.9472879907934827,
		0.9576032806985735, 0.9680308967461471, 0.9785720620876999, 0.9892280131939752,
	},
	// Schema 7:
	{
		0.5, 0.5027149505564014, 0.5054446430258502, 0.5081891574554764,
		0.5109485743270583, 0.5137229745593818, 0.5165124395106142, 0.5193170509806894,
		0.5221368912137069, 0.5249720429003435, 0.5278225891802786, 0.5306886136446309,
		0.5335702003384117, 0.5364674337629877, 0.5393803988785598, 0.5423091811066545,
		0.5452538663326288, 0.5482145409081883, 0.5511912916539204, 0.5541842058618393,
		0.5571933712979462, 0.5602188762048033, 0.5632608093041209, 0.5663192597993595,
		0.5693943173783458, 0.572486072215902, 0.5755946149764913, 0.5787200368168754,
		0.5818624293887887, 0.585021884841625, 0.5881984958251406, 0.5913923554921704,
		0.5946035575013605, 0.5978321960199137, 0.6010783657263515, 0.6043421618132907,
		0.6076236799902344, 0.6109230164863786, 0.6142402680534349, 0.6175755319684665,
		0.620928906036742, 0.6243004885946023, 0.6276903785123455, 0.6310986751971253,
		0.6345254785958666, 0.637970889198196, 0.6414350080393891, 0.6449179367033329,
		0.6484197773255048, 0.6519406325959679, 0.6554806057623822, 0.659039800633032,
		0.6626183215798706, 0.6662162735415805, 0.6698337620266515, 0.6734708931164728,
		0.6771277734684463, 0.6808045103191123, 0.6845012114872953, 0.688217985377265,
		0.6919549409819159, 0.6957121878859629, 0.6994898362691555, 0.7032879969095076,
		0.7071067811865475, 0.7109463010845827, 0.7148066691959849, 0.718687998724491,
		0.7225904034885232, 0.7265139979245261, 0.7304588970903234, 0.7344252166684908,
		0.7384130729697496, 0.7424225829363761, 0.7464538641456323, 0.7505070348132126,
		0.7545822137967112, 0.7586795205991071, 0.762799075372269, 0.7669409989204777,
		0.7711054127039704, 0.7752924388424999, 0.7795022001189185, 0.7837348199827764,
		0.7879904225539431, 0.7922691326262467, 0.7965710756711334, 0.8008963778413465,
		0.805245165974627, 0.8096175675974316, 0.8140137109286738, 0.8184337248834821,
		0.8228777390769823, 0.8273458838280969, 0.8318382901633681, 0.8363550898207981,
		0.8408964152537144, 0.8454623996346523, 0.8500531768592616, 0.8546688815502312,
		0.8593096490612387, 0.8639756154809185, 0.8686669176368529, 0.8733836930995842,
		0.8781260801866495, 0.8828942179666361, 0.8876882462632604, 0.8925083056594671,
		0.8973545375015533, 0.9022270839033115, 0.9071260877501991, 0.9120516927035263,
		0.9170040432046711, 0.9219832844793128, 0.9269895625416926, 0.9320230241988943,
		0.9370838170551498, 0.9421720895161669, 0.9472879907934827, 0.9524316709088368,
		0.9576032806985735, 0.9628029718180622, 0.9680308967461471, 0.9732872087896164,
		0.9785720620876999, 0.9838856116165875, 0.9892280131939752, 0.9945994234836328,
	},
	// Schema 8:
	{
		0.5, 0.5013556375251013, 0.5027149505564014, 0.5040779490592088,
		0.5054446430258502, 0.5068150424757447, 0.5081891574554764, 0.509566998038869,
		0.5109485743270583, 0.5123338964485679, 0.5137229745593818, 0.5151158188430205,
		0.5165124395106142, 0.5179128468009786, 0.5193170509806894, 0.520725062344158,
		0.5221368912137069, 0.5235525479396449, 0.5249720429003435, 0.526395386502313,
		0.5278225891802786, 0.5292536613972564, 0.5306886136446309, 0.5321274564422321,
		0.5335702003384117, 0.5350168559101208, 0.5364674337629877, 0.5379219445313954,
		0.5393803988785598, 0.5408428074966075, 0.5423091811066545, 0.5437795304588847,
		0.5452538663326288, 0.5467321995364429, 0.5482145409081883, 0.549700901315111,
		0.5511912916539204, 0.5526857228508706, 0.5541842058618393, 0.5556867516724088,
		0.5571933712979462, 0.5587040757836845, 0.5602188762048033, 0.5617377836665098,
		0.5632608093041209, 0.564787964283144, 0.5663192597993595, 0.5678547070789026,
		0.5693943173783458, 0.5709381019847808, 0.572486072215902, 0.5740382394200894,
		0.5755946149764913, 0.5771552102951081, 0.5787200368168754, 0.5802891060137493,
		0.5818624293887887, 0.5834400184762408, 0.585021884841625, 0.5866080400818185,
		0.5881984958251406, 0.5897932637314379, 0.5913923554921704, 0.5929957828304968,
		0.5946035575013605, 0.5962156912915756, 0.5978321960199137, 0.5994530835371903,
		0.6010783657263515, 0.6027080545025619, 0.6043421618132907, 0.6059806996384005,
		0.6076236799902344, 0.6092711149137041, 0.6109230164863786, 0.6125793968185725,
		0.6142402680534349, 0.6159056423670379, 0.6175755319684665, 0.6192499490999082,
		0.620928906036742, 0.622612415087629, 0.6243004885946023, 0.6259931389331581,
		0.6276903785123455, 0.6293922197748583, 0.6310986751971253, 0.6328097572894031,
		0.6345254785958666, 0.6362458516947014, 0.637970889198196, 0.6397006037528346,
		0.6414350080393891, 0.6431741147730128, 0.6449179367033329, 0.6466664866145447,
		0.6484197773255048, 0.6501778216898253, 0.6519406325959679, 0.6537082229673385,
		0.6554806057623822, 0.6572577939746774, 0.659039800633032, 0.6608266388015788,
		0.6626183215798706, 0.6644148621029772, 0.6662162735415805, 0.6680225691020727,
		0.6698337620266515, 0.6716498655934177, 0.6734708931164728, 0.6752968579460171,
		0.6771277734684463, 0.6789636531064505, 0.6808045103191123, 0.6826503586020058,
		0.6845012114872953, 0.6863570825438342, 0.688217985377265, 0.690083933630119,
		0.6919549409819159, 0.6938310211492645, 0.6957121878859629, 0.6975984549830999,
		0.6994898362691555, 0.7013863456101023, 0.7032879969095076, 0.7051948041086352,
		0.7071067811865475, 0.7090239421602076, 0.7109463010845827, 0.7128738720527471,
		0.7148066691959849, 0.7167447066838943, 0.718687998724491, 0.7206365595643126,
		0.7225904034885232, 0.7245495448210174, 0.7265139979245261, 0.7284837772007218,
		0.7304588970903234, 0.7324393720732029, 0.7344252166684908, 0.7364164454346837,
		0.7384130729697496, 0.7404151139112358, 0.7424225829363761, 0.7444354947621984,
		0.7464538641456323, 0.7484777058836176, 0.7505070348132126, 0.7525418658117031,
		0.7545822137967112, 0.7566280937263048, 0.7586795205991071, 0.7607365094544071,
		0.762799075372269, 0.7648672334736434, 0.7669409989204777, 0.7690203869158282,
		0.7711054127039704, 0.7731960915705107, 0.7752924388424999, 0.7773944698885442,
		0.7795022001189185, 0.7816156449856788, 0.7837348199827764, 0.7858597406461707,
		0.7879904225539431, 0.7901268813264122, 0.7922691326262467, 0.7944171921585818,
		0.7965710756711334, 0.7987307989543135, 0.8008963778413465, 0.8030678282083853,
		0.805245165974627, 0.8074284071024302, 0.8096175675974316, 0.8118126635086642,
		0.8140137109286738, 0.8162207259936375, 0.8184337248834821, 0.820652723822003,
		0.8228777390769823, 0.8251087869603088, 0.8273458838280969, 0.8295890460808079,
		0.8318382901633681, 0.8340936325652911, 0.8363550898207981, 0.8386226785089391,
		0.8408964152537144, 0.8431763167241966, 0.8454623996346523, 0.8477546807446661,
		0.8500531768592616, 0.8523579048290255, 0.8546688815502312, 0.8569861239649629,
		0.8593096490612387, 0.8616394738731368, 0.8639756154809185, 0.8663180910111553,
		0.8686669176368529, 0.871022112577578, 0.8733836930995842, 0.8757516765159389,
		0.8781260801866495, 0.8805069215187917, 0.8828942179666361, 0.8852879870317771,
		0.8876882462632604, 0.890095013257712, 0.8925083056594671, 0.8949281411607002,
		0.8973545375015533, 0.8997875124702672, 0.9022270839033115, 0.9046732696855155,
		0.9071260877501991, 0.909585556079304, 0.9120516927035263, 0.9145245157024483,
		0.9170040432046711, 0.9194902933879467, 0.9219832844793128, 0.9244830347552253,
		0.9269895625416926, 0.92950288621441, 0.9320230241988943, 0.9345499949706191,
		0.9370838170551498, 0.93962450902828, 0.9421720895161669, 0.9447265771954693,
		0.9472879907934827, 0.9498563490882775, 0.9524316709088368, 0.9550139751351947,
		0.9576032806985735, 0.9601996065815236, 0.9628029718180622, 0.9654133954938133,
		0.9680308967461471, 0.9706554947643201, 0.9732872087896164, 0.9759260581154889,
		0.9785720620876999, 0.9812252401044634, 0.9838856116165875, 0.9865531961276168,
		0.9892280131939752, 0.9919100824251095, 0.9945994234836328, 0.9972960560854698,
	},
}

// reduceResolution reduces the input spans, buckets in origin schema to the spans, buckets in target schema.
// The target schema must be smaller than the original schema.
// Set deltaBuckets to true if the provided buckets are
// deltas. Set it to false if the buckets contain absolute counts.
// Set inplace to true to reuse input slices and avoid allocations (otherwise
// new slices will be allocated for result).
func reduceResolution[IBC InternalBucketCount](
	originSpans []Span,
	originBuckets []IBC,
	originSchema,
	targetSchema int32,
	deltaBuckets bool,
	inplace bool,
) ([]Span, []IBC) {
	var (
		targetSpans           []Span // The spans in the target schema.
		targetBuckets         []IBC  // The bucket counts in the target schema.
		bucketIdx             int32  // The index of bucket in the origin schema.
		bucketCountIdx        int    // The position of a bucket in origin bucket count slice `originBuckets`.
		targetBucketIdx       int32  // The index of bucket in the target schema.
		lastBucketCount       IBC    // The last visited bucket's count in the origin schema.
		lastTargetBucketIdx   int32  // The index of the last added target bucket.
		lastTargetBucketCount IBC
	)

	if inplace {
		// Slice reuse is safe because when reducing the resolution,
		// target slices don't grow faster than origin slices are being read.
		targetSpans = originSpans[:0]
		targetBuckets = originBuckets[:0]
	}

	for _, span := range originSpans {
		// Determine the index of the first bucket in this span.
		bucketIdx += span.Offset
		for j := 0; j < int(span.Length); j++ {
			// Determine the index of the bucket in the target schema from the index in the original schema.
			targetBucketIdx = targetIdx(bucketIdx, originSchema, targetSchema)

			switch {
			case len(targetSpans) == 0:
				// This is the first span in the targetSpans.
				span := Span{
					Offset: targetBucketIdx,
					Length: 1,
				}
				targetSpans = append(targetSpans, span)
				targetBuckets = append(targetBuckets, originBuckets[bucketCountIdx])
				lastTargetBucketIdx = targetBucketIdx
				lastBucketCount = originBuckets[bucketCountIdx]
				lastTargetBucketCount = originBuckets[bucketCountIdx]

			case lastTargetBucketIdx == targetBucketIdx:
				// The current bucket has to be merged into the same target bucket as the previous bucket.
				if deltaBuckets {
					lastBucketCount += originBuckets[bucketCountIdx]
					targetBuckets[len(targetBuckets)-1] += lastBucketCount
					lastTargetBucketCount += lastBucketCount
				} else {
					targetBuckets[len(targetBuckets)-1] += originBuckets[bucketCountIdx]
				}

			case (lastTargetBucketIdx + 1) == targetBucketIdx:
				// The current bucket has to go into a new target bucket,
				// and that bucket is next to the previous target bucket,
				// so we add it to the current target span.
				targetSpans[len(targetSpans)-1].Length++
				lastTargetBucketIdx++
				if deltaBuckets {
					lastBucketCount += originBuckets[bucketCountIdx]
					targetBuckets = append(targetBuckets, lastBucketCount-lastTargetBucketCount)
					lastTargetBucketCount = lastBucketCount
				} else {
					targetBuckets = append(targetBuckets, originBuckets[bucketCountIdx])
				}

			case (lastTargetBucketIdx + 1) < targetBucketIdx:
				// The current bucket has to go into a new target bucket,
				// and that bucket is separated by a gap from the previous target bucket,
				// so we need to add a new target span.
				span := Span{
					Offset: targetBucketIdx - lastTargetBucketIdx - 1,
					Length: 1,
				}
				targetSpans = append(targetSpans, span)
				lastTargetBucketIdx = targetBucketIdx
				if deltaBuckets {
					lastBucketCount += originBuckets[bucketCountIdx]
					targetBuckets = append(targetBuckets, lastBucketCount-lastTargetBucketCount)
					lastTargetBucketCount = lastBucketCount
				} else {
					targetBuckets = append(targetBuckets, originBuckets[bucketCountIdx])
				}
			}

			bucketIdx++
			bucketCountIdx++
		}
	}

	return targetSpans, targetBuckets
}

func clearIfNotNil[T any](items []T) []T {
	if items == nil {
		return nil
	}
	return items[:0]
}
