// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package metadata

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"math"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/float16"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	shared_utils "github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

//go:generate go run ../../arrow/_tools/tmpl/main.go -i -data=statistics_types.tmpldata statistics_types.gen.go.tmpl

type StatProvider interface {
	GetMin() []byte
	GetMax() []byte
	GetNullCount() int64
	GetDistinctCount() int64
	IsSetMax() bool
	IsSetMin() bool
	IsSetNullCount() bool
	IsSetDistinctCount() bool
}

// EncodedStatistics are raw statistics with encoded values that will be written
// to the parquet file, or was read from the parquet file.
type EncodedStatistics struct {
	HasMax           bool
	Max              []byte
	HasMin           bool
	Min              []byte
	Signed           bool
	HasNullCount     bool
	NullCount        int64
	HasDistinctCount bool
	DistinctCount    int64

	AllNullValue bool
}

// ApplyStatSizeLimits sets the maximum size of the min/max values.
//
// from parquet-mr
// we don't write stats larger than the max size rather than truncating.
// the rationale is that some engines may use the minimum value in the page
// as the true minimum for aggregations and there is no way to mark that
// a value has been truncated and is a lower bound and not in the page
func (e *EncodedStatistics) ApplyStatSizeLimits(length int) {
	if len(e.Max) > length {
		e.HasMax = false
	}
	if len(e.Min) > length {
		e.HasMin = false
	}
}

// IsSet returns true iff one of the Has* values is true.
func (e *EncodedStatistics) IsSet() bool {
	return e.HasMin || e.HasMax || e.HasNullCount || e.HasDistinctCount
}

// SetMax sets the encoded Max value to val and sets HasMax to true
func (e *EncodedStatistics) SetMax(val []byte) *EncodedStatistics {
	e.Max = val[:]
	e.HasMax = true
	return e
}

// SetMin sets the encoded Min value to val, and sets HasMin to true
func (e *EncodedStatistics) SetMin(val []byte) *EncodedStatistics {
	e.Min = val[:]
	e.HasMin = true
	return e
}

// SetNullCount sets the NullCount to val and sets HasNullCount to true
func (e *EncodedStatistics) SetNullCount(val int64) *EncodedStatistics {
	e.NullCount = val
	e.HasNullCount = true
	return e
}

// SetDistinctCount sets the DistinctCount to val and sets HasDistinctCount to true
func (e *EncodedStatistics) SetDistinctCount(val int64) *EncodedStatistics {
	e.DistinctCount = val
	e.HasDistinctCount = true
	return e
}

func (e *EncodedStatistics) ToThrift() (stats *format.Statistics) {
	stats = format.NewStatistics()
	if e.HasMin {
		stats.MinValue = e.Min
		// if sort order is SIGNED then the old min value must be set too for backwards compatibility
		if e.Signed {
			stats.Min = e.Min
		}
	}
	if e.HasMax {
		stats.MaxValue = e.Max
		// if sort order is SIGNED then old max value must be set to
		if e.Signed {
			stats.Max = e.Max
		}
	}
	if e.HasNullCount {
		stats.NullCount = &e.NullCount
	}
	if e.HasDistinctCount {
		stats.DistinctCount = &e.DistinctCount
	}
	return
}

// TypedStatistics is the base interface for dealing with stats as
// they are being populated
type TypedStatistics interface {
	// Type is the underlying physical type for this stat block
	Type() parquet.Type
	// Returns true if there is a min and max value set for this stat object
	HasMinMax() bool
	// Returns true if a nullcount has been set
	HasNullCount() bool
	// returns true only if a distinct count has been set
	// current implementation does of the writer does not automatically populate
	// the distinct count right now.
	HasDistinctCount() bool
	NullCount() int64
	DistinctCount() int64
	NumValues() int64
	// return the column descriptor that this stat object was initialized with
	Descr() *schema.Column

	// Encode the current min value and return the bytes. ByteArray does not
	// include the len in the encoded bytes, otherwise this is identical to
	// plain encoding
	EncodeMin() []byte
	// Encode the current max value and return the bytes. ByteArray does not
	// include the len in the encoded bytes, otherwise this is identical to
	// plain encoding
	EncodeMax() []byte
	// Populate an EncodedStatistics object from the current stats
	Encode() (EncodedStatistics, error)
	// Resets all values to 0 to enable reusing this stat object for multiple
	// columns, by calling Encode to get the finished values and then calling
	// reset
	Reset()
	// Merge the min/max/nullcounts and distinct count from the passed stat object
	// into this one.
	Merge(TypedStatistics)

	// UpdateFromArrow updates the statistics from an Arrow Array,
	// only updating the null and num value counts if updateCounts
	// is true.
	UpdateFromArrow(values arrow.Array, updateCounts bool) error
	// IncNulls increments the number of nulls in the statistics
	// and marks HasNullCount as true
	IncNulls(int64)
	// IncDistinct increments the number of distinct values in
	// the statistics and marks HasDistinctCount as true
	IncDistinct(int64)
	// IncNumValues increments the total number of values in
	// the statistics
	IncNumValues(int64)
}

type statistics struct {
	descr            *schema.Column
	hasMinMax        bool
	hasNullCount     bool
	hasDistinctCount bool
	mem              memory.Allocator
	nvalues          int64
	stats            EncodedStatistics
	order            schema.SortOrder

	encoder encoding.TypedEncoder
}

func (s *statistics) IncNumValues(n int64) {
	s.nvalues += n
}
func (s *statistics) IncNulls(n int64) {
	s.stats.NullCount += n
	s.hasNullCount = true
}
func (s *statistics) IncDistinct(n int64) {
	s.stats.DistinctCount += n
	s.hasDistinctCount = true
}

func (s *statistics) Descr() *schema.Column  { return s.descr }
func (s *statistics) Type() parquet.Type     { return s.descr.PhysicalType() }
func (s *statistics) HasDistinctCount() bool { return s.hasDistinctCount }
func (s *statistics) HasMinMax() bool        { return s.hasMinMax }
func (s *statistics) HasNullCount() bool     { return s.hasNullCount }
func (s *statistics) NullCount() int64       { return s.stats.NullCount }
func (s *statistics) DistinctCount() int64   { return s.stats.DistinctCount }
func (s *statistics) NumValues() int64       { return s.nvalues }

func (s *statistics) Reset() {
	s.stats.NullCount = 0
	s.stats.DistinctCount = 0
	s.nvalues = 0
	s.hasMinMax = false
	s.hasDistinctCount = false
	s.hasNullCount = false
}

// base merge function for base non-typed stat object so we don't have to
// duplicate this in each of the typed implementations
func (s *statistics) merge(other TypedStatistics) {
	s.nvalues += other.NumValues()
	if other.HasNullCount() {
		s.stats.NullCount += other.NullCount()
	}
	if other.HasDistinctCount() {
		// this isn't technically correct as it should be keeping an actual set
		// of the distinct values and then combining the sets to get a new count
		// but for now we'll do this to match the C++ implementation at the current
		// time.
		s.stats.DistinctCount += other.DistinctCount()
	}
}

func coalesce(val, fallback interface{}) interface{} {
	switch v := val.(type) {
	case float32:
		if math.IsNaN(float64(v)) {
			return fallback
		}
	case float64:
		if math.IsNaN(v) {
			return fallback
		}
	}
	return val
}

func signedByteLess(a, b []byte) bool {
	// signed comparison is used for integers encoded as big-endian twos complement
	// integers (e.g. decimals)

	// if at least one of the lengths is zero, we can short circuit
	if len(a) == 0 || len(b) == 0 {
		return len(a) == 0 && len(b) > 0
	}

	sa := *(*[]int8)(unsafe.Pointer(&a))
	sb := *(*[]int8)(unsafe.Pointer(&b))

	// we can short circuit for different signed numbers or for equal length byte
	// arrays that have different first bytes. The equality requirement is necessary
	// for sign extension cases. 0xFF10 should be equal to 0x10 (due to big endian sign extension)
	if int8(0x80&uint8(sa[0])) != int8(0x80&uint8(sb[0])) || (len(sa) == len(sb) && sa[0] != sb[0]) {
		return sa[0] < sb[0]
	}

	// when the lengths are unequal and the numbers are of the same sign, we need
	// to do comparison by sign extending the shorter value first, and once we get
	// to equal sized arrays, lexicographical unsigned comparison of everything but
	// the first byte is sufficient.

	if len(a) != len(b) {
		var lead []byte
		if len(a) > len(b) {
			leadLen := len(a) - len(b)
			lead = a[:leadLen]
			a = a[leadLen:]
		} else {
			debug.Assert(len(a) < len(b), "something weird in byte slice signed comparison")
			leadLen := len(b) - len(a)
			lead = b[:leadLen]
			b = b[leadLen:]
		}

		// compare extra bytes to the sign extension of the first byte of the other number
		var extension byte
		if sa[0] < 0 {
			extension = 0xFF
		}

		notequal := false
		for _, c := range lead {
			if c != extension {
				notequal = true
				break
			}
		}

		if notequal {
			// since sign extension are extrema values for unsigned bytes:
			//
			// Four cases exist:
			//	 negative values:
			//	   b is the longer value
			//       b must be the lesser value: return false
			//     else:
			//       a must be the lesser value: return true
			//
			//   positive values:
			//     b is the longer value
			//       values in b must be greater than a: return true
			//     else:
			//       values in a must be greater than b: return false
			neg := sa[0] < 0
			blonger := len(sa) < len(sb)
			return neg != blonger
		}
	} else {
		a = a[1:]
		b = b[1:]
	}

	return bytes.Compare(a, b) == -1
}

func (BooleanStatistics) defaultMin() bool { return true }
func (BooleanStatistics) defaultMax() bool { return false }
func (s *Int32Statistics) defaultMin() int32 {
	if s.order == schema.SortUNSIGNED {
		val := uint32(math.MaxUint32)
		return int32(val)
	}
	return math.MaxInt32
}

func (s *Int32Statistics) defaultMax() int32 {
	if s.order == schema.SortUNSIGNED {
		return int32(0)
	}
	return math.MinInt32
}

func (s *Int64Statistics) defaultMin() int64 {
	if s.order == schema.SortUNSIGNED {
		val := uint64(math.MaxUint64)
		return int64(val)
	}
	return math.MaxInt64
}

func (s *Int64Statistics) defaultMax() int64 {
	if s.order == schema.SortUNSIGNED {
		return int64(0)
	}
	return math.MinInt64
}

var (
	defaultMinInt96  parquet.Int96
	defaultMinUInt96 parquet.Int96
	defaultMaxInt96  parquet.Int96
	defaultMaxUInt96 parquet.Int96

	defaultMinFloat16 parquet.FixedLenByteArray = float16.MaxNum.ToLEBytes()
	defaultMaxFloat16 parquet.FixedLenByteArray = float16.MinNum.ToLEBytes()
)

func init() {
	i96 := arrow.Uint32Traits.CastFromBytes(defaultMinInt96[:])
	i96[0] = math.MaxUint32
	i96[1] = math.MaxUint32
	i96[2] = math.MaxInt32

	i96 = arrow.Uint32Traits.CastFromBytes(defaultMinUInt96[:])
	i96[0] = math.MaxUint32
	i96[1] = math.MaxUint32
	i96[2] = math.MaxUint32

	// golang will initialize the bytes to 0
	i96 = arrow.Uint32Traits.CastFromBytes(defaultMaxInt96[:])
	i96[2] = math.MaxInt32 + 1

	// defaultMaxUInt96 will be initialized to 0 as desired
}

func (s *Int96Statistics) defaultMin() parquet.Int96 {
	if s.order == schema.SortUNSIGNED {
		return defaultMinUInt96
	}
	return defaultMinInt96
}

func (s *Int96Statistics) defaultMax() parquet.Int96 {
	if s.order == schema.SortUNSIGNED {
		return defaultMaxUInt96
	}
	return defaultMaxInt96
}

func (Float16Statistics) defaultMin() parquet.FixedLenByteArray {
	return defaultMinFloat16
}

func (Float16Statistics) defaultMax() parquet.FixedLenByteArray {
	return defaultMaxFloat16
}

func (Float32Statistics) defaultMin() float32                             { return math.MaxFloat32 }
func (Float32Statistics) defaultMax() float32                             { return -math.MaxFloat32 }
func (Float64Statistics) defaultMin() float64                             { return math.MaxFloat64 }
func (Float64Statistics) defaultMax() float64                             { return -math.MaxFloat64 }
func (ByteArrayStatistics) defaultMin() parquet.ByteArray                 { return nil }
func (ByteArrayStatistics) defaultMax() parquet.ByteArray                 { return nil }
func (FixedLenByteArrayStatistics) defaultMin() parquet.FixedLenByteArray { return nil }
func (FixedLenByteArrayStatistics) defaultMax() parquet.FixedLenByteArray { return nil }

func (BooleanStatistics) equal(a, b bool) bool                { return a == b }
func (Int32Statistics) equal(a, b int32) bool                 { return a == b }
func (Int64Statistics) equal(a, b int64) bool                 { return a == b }
func (Float32Statistics) equal(a, b float32) bool             { return a == b }
func (Float64Statistics) equal(a, b float64) bool             { return a == b }
func (Int96Statistics) equal(a, b parquet.Int96) bool         { return bytes.Equal(a[:], b[:]) }
func (ByteArrayStatistics) equal(a, b parquet.ByteArray) bool { return bytes.Equal(a, b) }
func (FixedLenByteArrayStatistics) equal(a, b parquet.FixedLenByteArray) bool {
	return bytes.Equal(a, b)
}

func (Float16Statistics) equal(a, b parquet.FixedLenByteArray) bool {
	return float16.FromLEBytes(a).Equal(float16.FromLEBytes(b))
}

func (BooleanStatistics) less(a, b bool) bool {
	return !a && b
}

func (s *Int32Statistics) less(a, b int32) bool {
	if s.order == schema.SortUNSIGNED {
		return uint32(a) < uint32(b)
	}
	return a < b
}

func (s *Int64Statistics) less(a, b int64) bool {
	if s.order == schema.SortUNSIGNED {
		return uint64(a) < uint64(b)
	}
	return a < b
}
func (Float32Statistics) less(a, b float32) bool { return a < b }
func (Float64Statistics) less(a, b float64) bool { return a < b }
func (s *Int96Statistics) less(a, b parquet.Int96) bool {
	i96a := arrow.Uint32Traits.CastFromBytes(a[:])
	i96b := arrow.Uint32Traits.CastFromBytes(b[:])

	a0, a1, a2 := shared_utils.ToLEUint32(i96a[0]), shared_utils.ToLEUint32(i96a[1]), shared_utils.ToLEUint32(i96a[2])
	b0, b1, b2 := shared_utils.ToLEUint32(i96b[0]), shared_utils.ToLEUint32(i96b[1]), shared_utils.ToLEUint32(i96b[2])

	if a2 != b2 {
		// only the msb bit is by signed comparison
		if s.order == schema.SortSIGNED {
			return int32(a2) < int32(b2)
		}
		return a2 < b2
	} else if a1 != b1 {
		return a1 < b1
	}
	return a0 < b0
}

func (s *ByteArrayStatistics) less(a, b parquet.ByteArray) bool {
	if s.order == schema.SortUNSIGNED {
		return bytes.Compare(a, b) == -1
	}

	return signedByteLess([]byte(a), []byte(b))
}

func (s *FixedLenByteArrayStatistics) less(a, b parquet.FixedLenByteArray) bool {
	if s.order == schema.SortUNSIGNED {
		return bytes.Compare(a, b) == -1
	}

	return signedByteLess([]byte(a), []byte(b))
}

func (Float16Statistics) less(a, b parquet.FixedLenByteArray) bool {
	return float16.FromLEBytes(a).Less(float16.FromLEBytes(b))
}

func (BooleanStatistics) cleanStat(minMax minmaxPairBoolean) *minmaxPairBoolean { return &minMax }
func (Int32Statistics) cleanStat(minMax minmaxPairInt32) *minmaxPairInt32       { return &minMax }
func (Int64Statistics) cleanStat(minMax minmaxPairInt64) *minmaxPairInt64       { return &minMax }
func (Int96Statistics) cleanStat(minMax minmaxPairInt96) *minmaxPairInt96       { return &minMax }

// in the case of floating point types, the following rules are applied as per parquet-mr:
// - if any of min/max is NaN, return nothing
// - if min is 0.0f replace with -0.0f
// - if max is -0.0f replace with 0.0f
//
// https://issues.apache.org/jira/browse/PARQUET-1222 tracks the official documenting of
// a well-defined order for floats and doubles.
func (Float32Statistics) cleanStat(minMax minmaxPairFloat32) *minmaxPairFloat32 {
	if math.IsNaN(float64(minMax[0])) || math.IsNaN(float64(minMax[1])) {
		return nil
	}

	if minMax[0] == math.MaxFloat32 && minMax[1] == -math.MaxFloat32 {
		return nil
	}

	var zero float32 = 0
	if minMax[0] == zero && !math.Signbit(float64(minMax[0])) {
		minMax[0] = -minMax[0]
	}

	if minMax[1] == zero && math.Signbit(float64(minMax[1])) {
		minMax[1] = -minMax[1]
	}

	return &minMax
}

func (Float64Statistics) cleanStat(minMax minmaxPairFloat64) *minmaxPairFloat64 {
	if math.IsNaN(minMax[0]) || math.IsNaN(minMax[1]) {
		return nil
	}

	if minMax[0] == math.MaxFloat64 && minMax[1] == -math.MaxFloat64 {
		return nil
	}

	var zero float64 = 0
	if minMax[0] == zero && !math.Signbit(minMax[0]) {
		minMax[0] = -minMax[0]
	}

	if minMax[1] == zero && math.Signbit(minMax[1]) {
		minMax[1] = -minMax[1]
	}

	return &minMax
}

func (Float16Statistics) cleanStat(minMax minmaxPairFloat16) *minmaxPairFloat16 {
	min := float16.FromLEBytes(minMax[0][:])
	max := float16.FromLEBytes(minMax[1][:])

	if min.IsNaN() || max.IsNaN() {
		return nil
	}

	if min.Equal(float16.MaxNum) && max.Equal(float16.MinNum) {
		return nil
	}

	zero := float16.New(0)
	if min.Equal(zero) && !min.Signbit() {
		minMax[0] = min.Negate().ToLEBytes()
	}
	if max.Equal(zero) && max.Signbit() {
		minMax[1] = max.Negate().ToLEBytes()
	}

	return &minMax
}

func (ByteArrayStatistics) cleanStat(minMax minmaxPairByteArray) *minmaxPairByteArray {
	if minMax[0] == nil || minMax[1] == nil {
		return nil
	}
	return &minMax
}

func (FixedLenByteArrayStatistics) cleanStat(minMax minmaxPairFixedLenByteArray) *minmaxPairFixedLenByteArray {
	if minMax[0] == nil || minMax[1] == nil {
		return nil
	}
	return &minMax
}

func GetStatValue(typ parquet.Type, val []byte) interface{} {
	switch typ {
	case parquet.Types.Boolean:
		return val[0] != 0
	case parquet.Types.Int32:
		return int32(binary.LittleEndian.Uint32(val))
	case parquet.Types.Int64:
		return int64(binary.LittleEndian.Uint64(val))
	case parquet.Types.Int96:
		p := parquet.Int96{}
		copy(p[:], val)
		return p
	case parquet.Types.Float:
		return math.Float32frombits(binary.LittleEndian.Uint32(val))
	case parquet.Types.Double:
		return math.Float64frombits(binary.LittleEndian.Uint64(val))
	case parquet.Types.ByteArray:
		fallthrough
	case parquet.Types.FixedLenByteArray:
		return val
	}
	return nil
}

type Comparator[T parquet.ColumnTypes] interface {
	// return true if a is strictly less than b
	Compare(a, b T) bool
	GetMinMax(vals []T) (min, max T)
	GetMinMaxSpaced(vals []T, validBits []byte, validBitsOffset int64) (min, max T)
}

func NewComparator(descr *schema.Column) (any, error) {
	if descr.SortOrder() == schema.SortSIGNED {
		switch descr.PhysicalType() {
		case parquet.Types.Boolean:
			return &booleanComparator{}, nil
		case parquet.Types.Int32:
			return &intComparator[int32]{sortOrder: schema.SortSIGNED}, nil
		case parquet.Types.Int64:
			return &intComparator[int64]{sortOrder: schema.SortSIGNED}, nil
		case parquet.Types.Int96:
			return &int96Comparator{sortOrder: schema.SortSIGNED}, nil
		case parquet.Types.Float:
			return &floatComparator[float32]{}, nil
		case parquet.Types.Double:
			return &floatComparator[float64]{}, nil
		case parquet.Types.ByteArray:
			return &byteArrayComparator[parquet.ByteArray]{sortOrder: schema.SortSIGNED}, nil
		case parquet.Types.FixedLenByteArray:
			if descr.LogicalType().Equals(schema.Float16LogicalType{}) {
				return &float16Comparator{}, nil
			}
			return &byteArrayComparator[parquet.FixedLenByteArray]{sortOrder: schema.SortSIGNED}, nil
		default:
			return nil, fmt.Errorf("%w: signed compare not implemented for %s",
				arrow.ErrNotImplemented, descr.PhysicalType())
		}
	} else if descr.SortOrder() == schema.SortUNKNOWN {
		return nil, fmt.Errorf("%w: sort order is unknown", arrow.ErrNotImplemented)
	}

	switch descr.PhysicalType() {
	case parquet.Types.Int32:
		return &intComparator[int32]{sortOrder: schema.SortUNSIGNED}, nil
	case parquet.Types.Int64:
		return &intComparator[int64]{sortOrder: schema.SortUNSIGNED}, nil
	case parquet.Types.Int96:
		return &int96Comparator{sortOrder: schema.SortUNSIGNED}, nil
	case parquet.Types.ByteArray:
		return &byteArrayComparator[parquet.ByteArray]{sortOrder: schema.SortUNSIGNED}, nil
	case parquet.Types.FixedLenByteArray:
		return &byteArrayComparator[parquet.FixedLenByteArray]{sortOrder: schema.SortUNSIGNED}, nil
	default:
		return nil, fmt.Errorf("%w: unsigned compare not implemented for %s", arrow.ErrNotImplemented, descr.PhysicalType())
	}
}

func NewTypedComparator[T parquet.ColumnTypes](descr *schema.Column) (Comparator[T], error) {
	comp, err := NewComparator(descr)
	if err != nil {
		return nil, err
	}

	c, ok := comp.(Comparator[T])
	if !ok {
		return nil, fmt.Errorf("unexpected comparator type %T", comp)
	}
	return c, nil
}

type intComparator[T int32 | int64] struct {
	sortOrder    schema.SortOrder
	bitSetReader bitutils.SetBitRunReader
}

func (c *intComparator[T]) defaultMin() T {
	var z T
	switch any(z).(type) {
	case int32:
		if c.sortOrder == schema.SortUNSIGNED {
			val := uint32(math.MaxUint32)
			return T(val)
		}
		return math.MaxInt32
	case int64:
		if c.sortOrder == schema.SortUNSIGNED {
			val := uint64(math.MaxUint64)
			return T(val)
		}
		var v int64 = math.MaxInt64
		return T(v)
	}
	panic("unreachable")
}

func (c *intComparator[T]) defaultMax() T {
	if c.sortOrder == schema.SortUNSIGNED {
		return T(0)
	}

	var z T
	switch any(z).(type) {
	case int32:
		return math.MinInt32
	case int64:
		var v int64 = math.MinInt64
		return T(v)
	}
	panic("unreachable")
}

func (c *intComparator[T]) Compare(a, b T) bool {
	if c.sortOrder == schema.SortUNSIGNED {
		return uint64(a) < uint64(b)
	}
	return a < b
}

func (c *intComparator[T]) GetMinMax(vals []T) (min, max T) {
	if c.sortOrder == schema.SortSIGNED {
		switch v := any(vals).(type) {
		case []int32:
			minv, maxv := shared_utils.GetMinMaxInt32(v)
			return T(minv), T(maxv)
		case []int64:
			minv, maxv := shared_utils.GetMinMaxInt64(v)
			return T(minv), T(maxv)
		}
		panic("unreachable")
	}

	switch v := any(vals).(type) {
	case []int32:
		minv, maxv := shared_utils.GetMinMaxUint32(arrow.GetData[uint32](arrow.GetBytes(v)))
		return T(minv), T(maxv)
	case []int64:
		minv, maxv := shared_utils.GetMinMaxUint64(arrow.GetData[uint64](arrow.GetBytes(v)))
		return T(minv), T(maxv)
	}
	panic("unreachable")
}

func (c *intComparator[T]) GetMinMaxSpaced(vals []T, validBits []byte, validBitsOffset int64) (minv, maxv T) {
	minv, maxv = c.defaultMin(), c.defaultMax()
	var fn func([]T) (T, T)
	switch any(vals).(type) {
	case []int32:
		if c.sortOrder == schema.SortSIGNED {
			fn = func(t []T) (T, T) {
				minv, maxv := shared_utils.GetMinMaxInt32(any(t).([]int32))
				return T(minv), T(maxv)
			}
		} else {
			fn = func(t []T) (T, T) {
				minv, maxv := shared_utils.GetMinMaxUint32(arrow.GetData[uint32](arrow.GetBytes(any(t).([]int32))))
				return T(minv), T(maxv)
			}
		}
	case []int64:
		if c.sortOrder == schema.SortSIGNED {
			fn = func(t []T) (T, T) {
				minv, maxv := shared_utils.GetMinMaxInt64(any(t).([]int64))
				return T(minv), T(maxv)
			}
		} else {
			fn = func(t []T) (T, T) {
				minv, maxv := shared_utils.GetMinMaxUint64(arrow.GetData[uint64](arrow.GetBytes(any(t).([]int64))))
				return T(minv), T(maxv)
			}
		}
	}

	if c.bitSetReader == nil {
		c.bitSetReader = bitutils.NewSetBitRunReader(validBits, validBitsOffset, int64(len(vals)))
	} else {
		c.bitSetReader.Reset(validBits, validBitsOffset, int64(len(vals)))
	}

	for {
		run := c.bitSetReader.NextRun()
		if run.Length == 0 {
			break
		}

		localMin, localMax := fn(vals[int(run.Pos):int(run.Pos+run.Length)])
		minv, maxv = min(minv, localMin), max(maxv, localMax)
	}
	return
}

func basicMinMax[T any](vals []T, defMin, defMax T, coalesce, min, max func(T, T) T) (minv, maxv T) {
	minv, maxv = defMin, defMax

	for _, v := range vals {
		minv = min(minv, coalesce(v, defMin))
		maxv = max(maxv, coalesce(v, defMax))
	}
	return
}

func basicMinMaxSpaced[T any](vals []T, validBits []byte, validOffset int64, bitSetReader *bitutils.SetBitRunReader,
	defMin, defMax T, coalesce, min, max func(T, T) T) (minv, maxv T) {

	minv, maxv = defMin, defMax
	if *bitSetReader == nil {
		*bitSetReader = bitutils.NewSetBitRunReader(validBits, validOffset, int64(len(vals)))
	} else {
		(*bitSetReader).Reset(validBits, validOffset, int64(len(vals)))
	}

	for {
		run := (*bitSetReader).NextRun()
		if run.Length == 0 {
			break
		}

		for _, v := range vals[int(run.Pos):int(run.Pos+run.Length)] {
			minv = min(minv, coalesce(v, defMin))
			maxv = max(maxv, coalesce(v, defMax))
		}
	}
	return
}

type floatComparator[T float32 | float64] struct {
	bitSetReader bitutils.SetBitRunReader
}

func (floatComparator[T]) coalesce(val, fallback T) T {
	if math.IsNaN(float64(val)) {
		return fallback
	}
	return val
}

func (c *floatComparator[T]) defaultMin() T {
	var z T
	switch any(z).(type) {
	case float32:
		return math.MaxFloat32
	case float64:
		v := math.MaxFloat64
		return T(v)
	}
	panic("unreachable")
}

func (c *floatComparator[T]) defaultMax() T {
	return -c.defaultMin()
}

func (c *floatComparator[T]) Compare(a, b T) bool {
	return a < b
}

func (c *floatComparator[T]) GetMinMax(vals []T) (minv, maxv T) {
	return basicMinMax(vals, c.defaultMin(), c.defaultMax(), c.coalesce,
		func(a, b T) T { return min(a, b) }, func(a, b T) T { return max(a, b) })
}

func (c *floatComparator[T]) GetMinMaxSpaced(vals []T, validBits []byte, validBitsOffset int64) (minv, maxv T) {
	return basicMinMaxSpaced(vals, validBits, validBitsOffset, &c.bitSetReader, c.defaultMin(), c.defaultMax(), c.coalesce,
		func(a, b T) T { return min(a, b) }, func(a, b T) T { return max(a, b) })
}

func byteArrMinVal[T parquet.ByteArray | parquet.FixedLenByteArray](cmpFn func(T, T) bool) func(a, b T) T {
	return func(a, b T) T {
		switch {
		case a == nil:
			return b
		case b == nil:
			return a
		case cmpFn(a, b):
			return a
		default:
			return b
		}
	}
}

func byteArrMaxVal[T parquet.ByteArray | parquet.FixedLenByteArray](cmpFn func(T, T) bool) func(a, b T) T {
	return func(a, b T) T {
		switch {
		case a == nil:
			return b
		case b == nil:
			return a
		case cmpFn(a, b):
			return b
		default:
			return a
		}
	}
}

type float16Comparator struct {
	bitSetReader bitutils.SetBitRunReader
}

func (*float16Comparator) coalesce(v, fallback parquet.FixedLenByteArray) parquet.FixedLenByteArray {
	if float16.FromLEBytes(v).IsNaN() {
		return fallback
	}
	return v
}

func (*float16Comparator) Compare(a, b parquet.FixedLenByteArray) bool {
	return float16.FromLEBytes(a).Less(float16.FromLEBytes(b))
}

func (c *float16Comparator) GetMinMax(vals []parquet.FixedLenByteArray) (minv, maxv parquet.FixedLenByteArray) {
	return basicMinMax(vals, defaultMinFloat16, defaultMaxFloat16, c.coalesce, byteArrMinVal(c.Compare), byteArrMaxVal(c.Compare))
}

func (c *float16Comparator) GetMinMaxSpaced(vals []parquet.FixedLenByteArray, validBits []byte, validBitsOffset int64) (minv, maxv parquet.FixedLenByteArray) {
	return basicMinMaxSpaced(vals, validBits, validBitsOffset, &c.bitSetReader, defaultMinFloat16, defaultMaxFloat16, c.coalesce, byteArrMinVal(c.Compare), byteArrMaxVal(c.Compare))
}

type int96Comparator struct {
	sortOrder    schema.SortOrder
	bitSetReader bitutils.SetBitRunReader
}

func (c *int96Comparator) defaultMin() parquet.Int96 {
	if c.sortOrder == schema.SortUNSIGNED {
		return defaultMinUInt96
	}
	return defaultMinInt96
}

func (c *int96Comparator) defaultMax() parquet.Int96 {
	if c.sortOrder == schema.SortUNSIGNED {
		return defaultMaxUInt96
	}
	return defaultMaxInt96
}

func (c *int96Comparator) Compare(a, b parquet.Int96) bool {
	i96a := arrow.Uint32Traits.CastFromBytes(a[:])
	i96b := arrow.Uint32Traits.CastFromBytes(b[:])

	a0, a1, a2 := shared_utils.ToLEUint32(i96a[0]), shared_utils.ToLEUint32(i96a[1]), shared_utils.ToLEUint32(i96a[2])
	b0, b1, b2 := shared_utils.ToLEUint32(i96b[0]), shared_utils.ToLEUint32(i96b[1]), shared_utils.ToLEUint32(i96b[2])

	if a2 != b2 {
		// only the msb bit is by signed comparison
		if c.sortOrder == schema.SortSIGNED {
			return int32(a2) < int32(b2)
		}
		return a2 < b2
	} else if a1 != b1 {
		return a1 < b1
	}
	return a0 < b0
}

func (c *int96Comparator) GetMinMax(vals []parquet.Int96) (minv, maxv parquet.Int96) {
	return basicMinMax(vals, c.defaultMin(), c.defaultMax(), func(v, _ parquet.Int96) parquet.Int96 { return v },
		func(a, b parquet.Int96) parquet.Int96 {
			if c.Compare(a, b) {
				return a
			}
			return b
		}, func(a, b parquet.Int96) parquet.Int96 {
			if c.Compare(a, b) {
				return b
			}
			return a
		})
}

func (c *int96Comparator) GetMinMaxSpaced(vals []parquet.Int96, validBits []byte, validBitsOffset int64) (minv, maxv parquet.Int96) {
	return basicMinMaxSpaced(vals, validBits, validBitsOffset, &c.bitSetReader, c.defaultMin(), c.defaultMax(),
		func(v, _ parquet.Int96) parquet.Int96 { return v },
		func(a, b parquet.Int96) parquet.Int96 {
			if c.Compare(a, b) {
				return a
			}
			return b
		}, func(a, b parquet.Int96) parquet.Int96 {
			if c.Compare(a, b) {
				return b
			}
			return a
		})
}

type byteArrayComparator[T parquet.ByteArray | parquet.FixedLenByteArray] struct {
	sortOrder    schema.SortOrder
	bitSetReader bitutils.SetBitRunReader
}

func (c *byteArrayComparator[T]) Compare(a, b T) bool {
	if c.sortOrder == schema.SortUNSIGNED {
		return bytes.Compare(a, b) == -1
	}

	return signedByteLess(a, b)
}

func (c *byteArrayComparator[T]) GetMinMax(vals []T) (minv, maxv T) {
	return basicMinMax(vals, nil, nil, func(v, _ T) T { return v },
		byteArrMinVal(c.Compare), byteArrMaxVal(c.Compare))
}

func (c *byteArrayComparator[T]) GetMinMaxSpaced(vals []T, validBits []byte, validBitsOffset int64) (minv, maxv T) {
	return basicMinMaxSpaced(vals, validBits, validBitsOffset, &c.bitSetReader, nil, nil,
		func(v, _ T) T { return v }, byteArrMinVal(c.Compare), byteArrMaxVal(c.Compare))
}

type booleanComparator struct {
	bitSetReader bitutils.SetBitRunReader
}

func (*booleanComparator) Compare(a, b bool) bool {
	return !a && b
}

func (c *booleanComparator) GetMinMax(vals []bool) (minv, maxv bool) {
	return basicMinMax(vals, true, false, func(v, _ bool) bool { return v },
		func(a, b bool) bool {
			if c.Compare(a, b) {
				return a
			}
			return b
		}, func(a, b bool) bool {
			if c.Compare(a, b) {
				return b
			}
			return a
		})
}

func (c *booleanComparator) GetMinMaxSpaced(vals []bool, validBits []byte, validBitsOffset int64) (minv, maxv bool) {
	return basicMinMaxSpaced(vals, validBits, validBitsOffset, &c.bitSetReader, true, false, func(v, _ bool) bool { return v },
		func(a, b bool) bool {
			if c.Compare(a, b) {
				return a
			}
			return b
		}, func(a, b bool) bool {
			if c.Compare(a, b) {
				return b
			}
			return a
		})
}
