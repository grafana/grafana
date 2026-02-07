// Copyright 2021 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package sql

import (
	"fmt"
	"math"
	"strings"

	"github.com/shopspring/decimal"
	"gopkg.in/src-d/go-errors.v1"
)

var (
	ErrInvalidColExpr      = errors.NewKind("the expression `%s` could not be found from the index `%s`")
	ErrRangeSimplification = errors.NewKind("attempting to simplify ranges has removed all ranges")
	ErrInvalidRangeType    = errors.NewKind("encountered the RangeType_Invalid")
)

// MySQLIndexBuilder builds ranges based on the combination of calls made for the given index, and then relies on the Index
// to return an IndexLookup from the created ranges.
type MySQLIndexBuilder struct {
	idx          Index
	err          error
	colExprTypes map[string]Type
	ranges       map[string][]MySQLRangeColumnExpr
	isInvalid    bool
}

// NewMySQLIndexBuilder returns a new MySQLIndexBuilder. Used internally to construct a range that will later be passed to
// integrators through the Index function NewLookup.
func NewMySQLIndexBuilder(idx Index) *MySQLIndexBuilder {
	colExprTypes := make(map[string]Type)
	ranges := make(map[string][]MySQLRangeColumnExpr)
	for _, cet := range idx.ColumnExpressionTypes() {
		typ := cet.Type
		if _, ok := typ.(StringType); ok {
			typ = typ.Promote()
		}
		colExprTypes[strings.ToLower(cet.Expression)] = typ
		ranges[strings.ToLower(cet.Expression)] = []MySQLRangeColumnExpr{AllRangeColumnExpr(typ)}
	}
	return &MySQLIndexBuilder{
		idx:          idx,
		isInvalid:    false,
		err:          nil,
		colExprTypes: colExprTypes,
		ranges:       ranges,
	}
}

func ceil(val interface{}) interface{} {
	switch v := val.(type) {
	case float32:
		return float32(math.Ceil(float64(v)))
	case float64:
		return math.Ceil(v)
	case decimal.Decimal:
		return v.Ceil()
	case string:
		dec, err := decimal.NewFromString(v)
		if err != nil {
			return v
		}
		return ceil(dec)
	case []byte:
		return ceil(string(v))
	default:
		return v
	}
}

func floor(val interface{}) interface{} {
	switch v := val.(type) {
	case float32:
		return float32(math.Floor(float64(v)))
	case float64:
		return math.Floor(v)
	case decimal.Decimal:
		return v.Floor()
	case string:
		dec, err := decimal.NewFromString(v)
		if err != nil {
			return v
		}
		return floor(dec)
	case []byte:
		return floor(string(v))
	default:
		return v
	}
}

// Equals represents colExpr = key. For IN expressions, pass all of them in the same Equals call.
func (b *MySQLIndexBuilder) Equals(ctx *Context, colExpr string, keyType Type, keys ...interface{}) *MySQLIndexBuilder {
	if b.isInvalid {
		return b
	}
	colTyp, ok := b.colExprTypes[colExpr]
	if !ok {
		b.isInvalid = true
		b.err = ErrInvalidColExpr.New(colExpr, b.idx.ID())
		return b
	}
	potentialRanges := make([]MySQLRangeColumnExpr, len(keys))
	for i, k := range keys {
		// if converting from float to int results in rounding, then it's empty range
		if t, ok := colTyp.(NumberType); ok && !t.IsFloat() {
			f, c := floor(k), ceil(k)
			switch k.(type) {
			case float32, float64:
				if f != c {
					potentialRanges[i] = EmptyRangeColumnExpr(colTyp)
					continue
				}
			case decimal.Decimal:
				if !f.(decimal.Decimal).Equals(c.(decimal.Decimal)) {
					potentialRanges[i] = EmptyRangeColumnExpr(colTyp)
					continue
				}
			}
		}

		var err error
		k, err = b.convertKey(ctx, colTyp, keyType, k)

		if err != nil {
			b.isInvalid = true
			b.err = err
			return b
		}
		potentialRanges[i] = ClosedRangeColumnExpr(k, k, colTyp)
	}
	b.updateCol(ctx, colExpr, potentialRanges...)
	return b
}

// NotEquals represents colExpr <> key.
func (b *MySQLIndexBuilder) NotEquals(ctx *Context, colExpr string, keyType Type, key interface{}) *MySQLIndexBuilder {
	if b.isInvalid {
		return b
	}
	typ, ok := b.colExprTypes[colExpr]
	if !ok {
		b.isInvalid = true
		b.err = ErrInvalidColExpr.New(colExpr, b.idx.ID())
		return b
	}
	// if converting from float to int results in rounding, then it's entire range (excluding nulls)
	f, c := floor(key), ceil(key)
	switch key.(type) {
	case float32, float64:
		if f != c {
			b.updateCol(ctx, colExpr, NotNullRangeColumnExpr(typ))
			return b
		}
	case decimal.Decimal:
		if !f.(decimal.Decimal).Equals(c.(decimal.Decimal)) {
			b.updateCol(ctx, colExpr, NotNullRangeColumnExpr(typ))
			return b
		}
	}

	key, err := b.convertKey(ctx, typ, keyType, key)
	if err != nil {
		b.isInvalid = true
		b.err = err
		return b
	}

	b.updateCol(ctx, colExpr, GreaterThanRangeColumnExpr(key, typ), LessThanRangeColumnExpr(key, typ))
	if !b.isInvalid {
		ranges, err := SimplifyRangeColumn(b.ranges[colExpr]...)
		if err != nil {
			b.isInvalid = true
			b.err = err
			return b
		}
		if len(ranges) == 0 {
			b.isInvalid = true
			return b
		}
		b.ranges[colExpr] = ranges
	}
	return b
}

// GreaterThan represents colExpr > key.
func (b *MySQLIndexBuilder) GreaterThan(ctx *Context, colExpr string, keyType Type, key interface{}) *MySQLIndexBuilder {
	if b.isInvalid {
		return b
	}
	typ, ok := b.colExprTypes[colExpr]
	if !ok {
		b.isInvalid = true
		b.err = ErrInvalidColExpr.New(colExpr, b.idx.ID())
		return b
	}

	if t, ok := typ.(NumberType); ok && !t.IsFloat() {
		key = floor(key)
	}

	key, err := b.convertKey(ctx, typ, keyType, key)
	if err != nil {
		b.isInvalid = true
		b.err = err
		return b
	}

	b.updateCol(ctx, colExpr, GreaterThanRangeColumnExpr(key, typ))
	return b
}

// isConvertibleKeyType checks if the key can be converted into the column type
func isConvertibleKeyType(colType Type, keyType Type) bool {
	if IsStringType(colType) {
		return !(IsNumberType(keyType) || IsDecimalType(keyType))
	}
	// TODO: check other types
	return true
}

// convertKey converts the given key from keyType to colType, returning an error if the conversion fails.
func (b *MySQLIndexBuilder) convertKey(ctx *Context, colType Type, keyType Type, key interface{}) (interface{}, error) {
	if et, ok := colType.(ExtendedType); ok {
		return et.ConvertToType(ctx, keyType.(ExtendedType), key)
	} else {
		if !isConvertibleKeyType(colType, keyType) {
			return nil, ErrInvalidValueType.New(key, colType)
		}
		k, _, err := colType.Convert(ctx, key)
		if err != nil && !ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		return k, nil
	}
}

// GreaterOrEqual represents colExpr >= key.
func (b *MySQLIndexBuilder) GreaterOrEqual(ctx *Context, colExpr string, keyType Type, key interface{}) *MySQLIndexBuilder {
	if b.isInvalid {
		return b
	}
	typ, ok := b.colExprTypes[colExpr]
	if !ok {
		b.isInvalid = true
		b.err = ErrInvalidColExpr.New(colExpr, b.idx.ID())
		return b
	}

	var exclude bool
	if t, ok := typ.(NumberType); ok && !t.IsFloat() {
		newKey := floor(key)
		switch key.(type) {
		case float32, float64:
			exclude = key != newKey
		case decimal.Decimal:
			exclude = !key.(decimal.Decimal).Equals(newKey.(decimal.Decimal))
		}
		key = newKey
	}

	key, err := b.convertKey(ctx, typ, keyType, key)
	if err != nil {
		b.isInvalid = true
		b.err = err
		return b
	}

	var rangeColExpr MySQLRangeColumnExpr
	if exclude {
		rangeColExpr = GreaterThanRangeColumnExpr(key, typ)
	} else {
		rangeColExpr = GreaterOrEqualRangeColumnExpr(key, typ)
	}
	b.updateCol(ctx, colExpr, rangeColExpr)

	return b
}

// LessThan represents colExpr < key.
func (b *MySQLIndexBuilder) LessThan(ctx *Context, colExpr string, keyType Type, key interface{}) *MySQLIndexBuilder {
	if b.isInvalid {
		return b
	}
	typ, ok := b.colExprTypes[colExpr]
	if !ok {
		b.isInvalid = true
		b.err = ErrInvalidColExpr.New(colExpr, b.idx.ID())
		return b
	}

	if t, ok := typ.(NumberType); ok && !t.IsFloat() {
		key = ceil(key)
	}

	key, err := b.convertKey(ctx, typ, keyType, key)
	if err != nil {
		b.isInvalid = true
		b.err = err
		return b
	}

	b.updateCol(ctx, colExpr, LessThanRangeColumnExpr(key, typ))
	return b
}

// LessOrEqual represents colExpr <= key.
func (b *MySQLIndexBuilder) LessOrEqual(ctx *Context, colExpr string, keyType Type, key interface{}) *MySQLIndexBuilder {
	if b.isInvalid {
		return b
	}
	typ, ok := b.colExprTypes[colExpr]
	if !ok {
		b.isInvalid = true
		b.err = ErrInvalidColExpr.New(colExpr, b.idx.ID())
		return b
	}

	var exclude bool
	if t, ok := typ.(NumberType); ok && !t.IsFloat() {
		newKey := ceil(key)
		switch key.(type) {
		case float32, float64:
			exclude = key != newKey
		case decimal.Decimal:
			exclude = !key.(decimal.Decimal).Equals(newKey.(decimal.Decimal))
		}
		key = newKey
	}

	key, err := b.convertKey(ctx, typ, keyType, key)
	if err != nil {
		b.isInvalid = true
		b.err = err
		return b
	}

	var rangeColExpr MySQLRangeColumnExpr
	if exclude {
		rangeColExpr = LessThanRangeColumnExpr(key, typ)
	} else {
		rangeColExpr = LessOrEqualRangeColumnExpr(key, typ)
	}
	b.updateCol(ctx, colExpr, rangeColExpr)

	return b
}

// IsNull represents colExpr = nil
func (b *MySQLIndexBuilder) IsNull(ctx *Context, colExpr string) *MySQLIndexBuilder {
	if b.isInvalid {
		return b
	}
	typ, ok := b.colExprTypes[colExpr]
	if !ok {
		b.isInvalid = true
		b.err = ErrInvalidColExpr.New(colExpr, b.idx.ID())
		return b
	}
	b.updateCol(ctx, colExpr, NullRangeColumnExpr(typ))

	return b
}

// IsNotNull represents colExpr != nil
func (b *MySQLIndexBuilder) IsNotNull(ctx *Context, colExpr string) *MySQLIndexBuilder {
	if b.isInvalid {
		return b
	}
	typ, ok := b.colExprTypes[colExpr]
	if !ok {
		b.isInvalid = true
		b.err = ErrInvalidColExpr.New(colExpr, b.idx.ID())
		return b
	}
	b.updateCol(ctx, colExpr, NotNullRangeColumnExpr(typ))

	return b
}

// Ranges returns all ranges for this index builder. If the builder is in an error state then this returns nil.
func (b *MySQLIndexBuilder) Ranges(ctx *Context) MySQLRangeCollection {
	if b.err != nil {
		return nil
	}
	// An invalid builder that did not error got into a state where no columns will ever match, so we return an empty range
	if b.isInvalid {
		cets := b.idx.ColumnExpressionTypes()
		emptyRange := make(MySQLRange, len(cets))
		for i, cet := range cets {
			typ := cet.Type
			if _, ok := typ.(StringType); ok {
				typ = typ.Promote()
			}
			emptyRange[i] = EmptyRangeColumnExpr(typ)
		}
		return MySQLRangeCollection{emptyRange}
	}
	var allColumns [][]MySQLRangeColumnExpr
	for _, colExpr := range b.idx.Expressions() {
		ranges, ok := b.ranges[strings.ToLower(colExpr)]
		if !ok {
			// An index builder is guaranteed to cover the first n expressions, so if we hit an expression that we do
			// not have an entry for then we've hit all the ranges.
			break
		}
		allColumns = append(allColumns, ranges)
	}

	// In the builder ranges map we store multiple column expressions per column, however we want all permutations to
	// be their own range, so here we're creating a new range for every permutation.
	colCounts := make([]int, len(allColumns))
	permutation := make([]int, len(allColumns))
	for i, rangeColumn := range allColumns {
		colCounts[i] = len(rangeColumn)
	}
	var ranges MySQLRangeCollection
	exit := false
	for !exit {
		exit = true
		currentRange := make(MySQLRange, len(allColumns))
		for colIdx, exprCount := range colCounts {
			permutation[colIdx] = (permutation[colIdx] + 1) % exprCount
			if permutation[colIdx] != 0 {
				exit = false
				break
			}
		}
		for colIdx, exprIdx := range permutation {
			currentRange[colIdx] = allColumns[colIdx][exprIdx]
		}
		isempty, err := currentRange.IsEmpty()
		if err != nil {
			b.err = err
			return nil
		}
		if !isempty {
			ranges = append(ranges, currentRange)
		}
	}
	if len(ranges) == 0 {
		cets := b.idx.ColumnExpressionTypes()
		emptyRange := make(MySQLRange, len(cets))
		for i, cet := range cets {
			emptyRange[i] = EmptyRangeColumnExpr(cet.Type.Promote())
		}
		return MySQLRangeCollection{emptyRange}
	}
	return ranges
}

// Build constructs a new IndexLookup based on the ranges that have been built internally by this builder.
func (b *MySQLIndexBuilder) Build(ctx *Context) (IndexLookup, error) {
	if b.err != nil {
		return emptyLookup, b.err
	} else {
		ranges := b.Ranges(ctx)
		if len(ranges) == 0 {
			return emptyLookup, nil
		}
		return IndexLookup{Index: b.idx, Ranges: ranges}, nil
	}
}

// updateCol updates the internal columns with the given ranges by intersecting each given range with each existing
// range. That means that each given range is treated as an OR with respect to the other given ranges. If multiple
// ranges are to be intersected with respect to one another, multiple calls to updateCol should be made.
func (b *MySQLIndexBuilder) updateCol(ctx *Context, colExpr string, potentialRanges ...MySQLRangeColumnExpr) {
	if len(potentialRanges) == 0 {
		return
	}

	currentRanges, ok := b.ranges[colExpr]
	if !ok {
		b.ranges[colExpr] = potentialRanges
		return
	}

	var newRanges []MySQLRangeColumnExpr
	for _, currentRange := range currentRanges {
		for _, potentialRange := range potentialRanges {

			newRange, ok, err := currentRange.TryIntersect(potentialRange)
			if err != nil {
				b.isInvalid = true
				if !ErrInvalidValue.Is(err) {
					b.err = err
				}
				return
			}
			if ok {
				isempty, err := newRange.IsEmpty()
				if err != nil {
					b.isInvalid = true
					b.err = err
					return
				}
				if !isempty {
					newRanges = append(newRanges, newRange)
				}
			}
		}
	}

	// If we end up with zero ranges then we had an impossible combination, such as (x < 1 AND x > 1)
	if len(newRanges) == 0 {
		b.isInvalid = true
		return
	}
	b.ranges[colExpr] = newRanges
}

// SpatialIndexBuilder is like the MySQLIndexBuilder, but spatial
type SpatialIndexBuilder struct {
	idx Index
	typ Type
	rng MySQLRangeColumnExpr
}

func NewSpatialIndexBuilder(idx Index) *SpatialIndexBuilder {
	return &SpatialIndexBuilder{idx: idx, typ: idx.ColumnExpressionTypes()[0].Type}
}

func (b *SpatialIndexBuilder) AddRange(lower, upper interface{}) *SpatialIndexBuilder {
	b.rng = MySQLRangeColumnExpr{
		LowerBound: Below{Key: lower},
		UpperBound: Above{Key: upper},
		Typ:        b.typ,
	}
	return b
}

func (b *SpatialIndexBuilder) Build() (IndexLookup, error) {
	return IndexLookup{
		Index:           b.idx,
		Ranges:          MySQLRangeCollection{{b.rng}},
		IsSpatialLookup: true,
	}, nil
}

// EqualityIndexBuilder is a range builder builds equality expressions
// more quickly than the default builder
type EqualityIndexBuilder struct {
	idx   Index
	rng   MySQLRange
	empty bool
}

func NewEqualityIndexBuilder(idx Index) *EqualityIndexBuilder {
	return &EqualityIndexBuilder{idx: idx, rng: make(MySQLRange, len(idx.Expressions()))}
}

// AddEquality represents colExpr = key. For IN expressions, pass all of them in the same AddEquality call.
func (b *EqualityIndexBuilder) AddEquality(ctx *Context, colIdx int, k interface{}) error {
	if b.empty {
		return nil
	}
	if colIdx >= len(b.rng) {
		return fmt.Errorf("invalid index for building index lookup")
	}
	if b.rng[colIdx].UpperBound != nil {
		return fmt.Errorf("redundant restriction on index column")
	}

	typ := b.idx.ColumnExpressionTypes()[colIdx].Type
	// if converting from float to int results in rounding, then it's empty range
	if t, ok := typ.(NumberType); ok && !t.IsFloat() {
		f, c := floor(k), ceil(k)
		switch k.(type) {
		case float32, float64:
			if f != c {
				b.empty = true
				return nil
			}
		case decimal.Decimal:
			if !f.(decimal.Decimal).Equals(c.(decimal.Decimal)) {
				b.empty = true
				return nil
			}
		}
	}

	var err error
	k, _, err = typ.Convert(ctx, k)
	if err != nil {
		return err
	}
	b.rng[colIdx] = ClosedRangeColumnExpr(k, k, typ)

	return nil
}

func (b *EqualityIndexBuilder) Build(_ *Context) (IndexLookup, error) {
	if b.empty {
		for i, cet := range b.idx.ColumnExpressionTypes() {
			b.rng[i] = EmptyRangeColumnExpr(cet.Type)
		}
	}
	return IndexLookup{
		Index:        b.idx,
		Ranges:       MySQLRangeCollection{b.rng},
		IsEmptyRange: b.empty,
	}, nil
}
