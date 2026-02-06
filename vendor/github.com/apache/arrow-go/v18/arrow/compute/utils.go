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

//go:build go1.18

package compute

import (
	"fmt"
	"io"
	"time"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/compute/internal/kernels"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
	"golang.org/x/xerrors"
)

type bufferWriteSeeker struct {
	buf *memory.Buffer
	pos int
	mem memory.Allocator
}

func (b *bufferWriteSeeker) Reserve(nbytes int) {
	if b.buf == nil {
		b.buf = memory.NewResizableBuffer(b.mem)
	}
	newCap := utils.Max(b.buf.Cap(), 256)
	for newCap < b.pos+nbytes {
		newCap = bitutil.NextPowerOf2(b.pos + nbytes)
	}
	b.buf.Reserve(newCap)
}

func (b *bufferWriteSeeker) Write(p []byte) (n int, err error) {
	if len(p) == 0 {
		return 0, nil
	}

	if b.buf == nil {
		b.Reserve(len(p))
	} else if b.pos+len(p) >= b.buf.Cap() {
		b.Reserve(len(p))
	}

	return b.UnsafeWrite(p)
}

func (b *bufferWriteSeeker) UnsafeWrite(p []byte) (n int, err error) {
	n = copy(b.buf.Buf()[b.pos:], p)
	b.pos += len(p)
	if b.pos > b.buf.Len() {
		b.buf.ResizeNoShrink(b.pos)
	}
	return
}

func (b *bufferWriteSeeker) Seek(offset int64, whence int) (int64, error) {
	newpos, offs := 0, int(offset)
	switch whence {
	case io.SeekStart:
		newpos = offs
	case io.SeekCurrent:
		newpos = b.pos + offs
	case io.SeekEnd:
		newpos = b.buf.Len() + offs
	}
	if newpos < 0 {
		return 0, xerrors.New("negative result pos")
	}
	b.pos = newpos
	return int64(newpos), nil
}

// ensureDictionaryDecoded is used by DispatchBest to determine
// the proper types for promotion. Casting is then performed by
// the executor before continuing execution: see the implementation
// of execInternal in exec.go after calling DispatchBest.
//
// That casting is where actual decoding would be performed for
// the dictionary
func ensureDictionaryDecoded(vals ...arrow.DataType) {
	for i, v := range vals {
		if v.ID() == arrow.DICTIONARY {
			vals[i] = v.(*arrow.DictionaryType).ValueType
		}
	}
}

func ensureNoExtensionType(vals ...arrow.DataType) {
	for i, v := range vals {
		if v.ID() == arrow.EXTENSION {
			vals[i] = v.(arrow.ExtensionType).StorageType()
		}
	}
}

func replaceNullWithOtherType(vals ...arrow.DataType) {
	debug.Assert(len(vals) == 2, "should be length 2")

	if vals[0].ID() == arrow.NULL {
		vals[0] = vals[1]
		return
	}

	if vals[1].ID() == arrow.NULL {
		vals[1] = vals[0]
		return
	}
}

func commonTemporalResolution(vals ...arrow.DataType) (arrow.TimeUnit, bool) {
	isTimeUnit := false
	finestUnit := arrow.Second
	for _, v := range vals {
		switch dt := v.(type) {
		case *arrow.Date32Type:
			isTimeUnit = true
			continue
		case *arrow.Date64Type:
			finestUnit = max(finestUnit, arrow.Millisecond)
			isTimeUnit = true
		case arrow.TemporalWithUnit:
			finestUnit = max(finestUnit, dt.TimeUnit())
			isTimeUnit = true
		default:
			continue
		}
	}
	return finestUnit, isTimeUnit
}

func replaceTemporalTypes(unit arrow.TimeUnit, vals ...arrow.DataType) {
	for i, v := range vals {
		switch dt := v.(type) {
		case *arrow.TimestampType:
			dt.Unit = unit
			vals[i] = dt
		case *arrow.Time32Type, *arrow.Time64Type:
			if unit > arrow.Millisecond {
				vals[i] = &arrow.Time64Type{Unit: unit}
			} else {
				vals[i] = &arrow.Time32Type{Unit: unit}
			}
		case *arrow.DurationType:
			dt.Unit = unit
			vals[i] = dt
		case *arrow.Date32Type, *arrow.Date64Type:
			vals[i] = &arrow.TimestampType{Unit: unit}
		}
	}
}

func replaceTypes(replacement arrow.DataType, vals ...arrow.DataType) {
	for i := range vals {
		vals[i] = replacement
	}
}

func commonNumeric(vals ...arrow.DataType) arrow.DataType {
	for _, v := range vals {
		if !arrow.IsFloating(v.ID()) && !arrow.IsInteger(v.ID()) {
			// a common numeric type is only possible if all are numeric
			return nil
		}
		if v.ID() == arrow.FLOAT16 {
			// float16 arithmetic is not currently supported
			return nil
		}
	}

	for _, v := range vals {
		if v.ID() == arrow.FLOAT64 {
			return arrow.PrimitiveTypes.Float64
		}
	}

	for _, v := range vals {
		if v.ID() == arrow.FLOAT32 {
			return arrow.PrimitiveTypes.Float32
		}
	}

	maxWidthSigned, maxWidthUnsigned := 0, 0
	for _, v := range vals {
		if arrow.IsUnsignedInteger(v.ID()) {
			maxWidthUnsigned = exec.Max(v.(arrow.FixedWidthDataType).BitWidth(), maxWidthUnsigned)
		} else {
			maxWidthSigned = exec.Max(v.(arrow.FixedWidthDataType).BitWidth(), maxWidthSigned)
		}
	}

	if maxWidthSigned == 0 {
		switch {
		case maxWidthUnsigned >= 64:
			return arrow.PrimitiveTypes.Uint64
		case maxWidthUnsigned == 32:
			return arrow.PrimitiveTypes.Uint32
		case maxWidthUnsigned == 16:
			return arrow.PrimitiveTypes.Uint16
		default:
			debug.Assert(maxWidthUnsigned == 8, "bad maxWidthUnsigned")
			return arrow.PrimitiveTypes.Uint8
		}
	}

	if maxWidthSigned <= maxWidthUnsigned {
		maxWidthSigned = bitutil.NextPowerOf2(maxWidthUnsigned + 1)
	}

	switch {
	case maxWidthSigned >= 64:
		return arrow.PrimitiveTypes.Int64
	case maxWidthSigned == 32:
		return arrow.PrimitiveTypes.Int32
	case maxWidthSigned == 16:
		return arrow.PrimitiveTypes.Int16
	default:
		debug.Assert(maxWidthSigned == 8, "bad maxWidthSigned")
		return arrow.PrimitiveTypes.Int8
	}
}

func hasDecimal(vals ...arrow.DataType) bool {
	for _, v := range vals {
		if arrow.IsDecimal(v.ID()) {
			return true
		}
	}

	return false
}

type decimalPromotion uint8

const (
	decPromoteNone decimalPromotion = iota
	decPromoteAdd
	decPromoteMultiply
	decPromoteDivide
)

func castBinaryDecimalArgs(promote decimalPromotion, vals ...arrow.DataType) error {
	left, right := vals[0], vals[1]
	debug.Assert(arrow.IsDecimal(left.ID()) || arrow.IsDecimal(right.ID()), "at least one of the types should be decimal")

	// decimal + float = float
	if arrow.IsFloating(left.ID()) {
		vals[1] = vals[0]
		return nil
	} else if arrow.IsFloating(right.ID()) {
		vals[0] = vals[1]
		return nil
	}

	var prec1, scale1, prec2, scale2 int32
	var err error
	// decimal + integer = decimal
	if arrow.IsDecimal(left.ID()) {
		dec := left.(arrow.DecimalType)
		prec1, scale1 = dec.GetPrecision(), dec.GetScale()
	} else {
		debug.Assert(arrow.IsInteger(left.ID()), "floats were already handled, this should be an int")
		if prec1, err = kernels.MaxDecimalDigitsForInt(left.ID()); err != nil {
			return err
		}
	}
	if arrow.IsDecimal(right.ID()) {
		dec := right.(arrow.DecimalType)
		prec2, scale2 = dec.GetPrecision(), dec.GetScale()
	} else {
		debug.Assert(arrow.IsInteger(right.ID()), "float already handled, should be ints")
		if prec2, err = kernels.MaxDecimalDigitsForInt(right.ID()); err != nil {
			return err
		}
	}

	if scale1 < 0 || scale2 < 0 {
		return fmt.Errorf("%w: decimals with negative scales not supported", arrow.ErrNotImplemented)
	}

	// decimal128 + decimal256 = decimal256
	castedID := arrow.DECIMAL128
	if left.ID() == arrow.DECIMAL256 || right.ID() == arrow.DECIMAL256 {
		castedID = arrow.DECIMAL256
	}

	// decimal promotion rules compatible with amazon redshift
	// https://docs.aws.amazon.com/redshift/latest/dg/r_numeric_computations201.html
	var leftScaleup, rightScaleup int32

	switch promote {
	case decPromoteAdd:
		leftScaleup = exec.Max(scale1, scale2) - scale1
		rightScaleup = exec.Max(scale1, scale2) - scale2
	case decPromoteMultiply:
	case decPromoteDivide:
		leftScaleup = exec.Max(4, scale1+prec2-scale2+1) + scale2 - scale1
	default:
		debug.Assert(false, fmt.Sprintf("invalid DecimalPromotion value %d", promote))
	}

	vals[0], err = arrow.NewDecimalType(castedID, prec1+leftScaleup, scale1+leftScaleup)
	if err != nil {
		return err
	}
	vals[1], err = arrow.NewDecimalType(castedID, prec2+rightScaleup, scale2+rightScaleup)
	return err
}

func commonTemporal(vals ...arrow.DataType) arrow.DataType {
	var (
		finestUnit           = arrow.Second
		zone                 *string
		loc                  *time.Location
		sawDate32, sawDate64 bool
		sawDuration, sawTime bool
	)

	for _, ty := range vals {
		switch ty.ID() {
		case arrow.DATE32:
			// date32's unit is days, but the coarsest we have is seconds
			sawDate32 = true
		case arrow.DATE64:
			finestUnit = max(finestUnit, arrow.Millisecond)
			sawDate64 = true
		case arrow.TIMESTAMP:
			ts := ty.(*arrow.TimestampType)
			if ts.TimeZone != "" {
				tz, _ := ts.GetZone()
				if loc != nil && loc != tz {
					return nil
				}
				loc = tz
			}
			zone = &ts.TimeZone
			finestUnit = max(finestUnit, ts.Unit)
		case arrow.TIME32, arrow.TIME64:
			ts := ty.(arrow.TemporalWithUnit)
			finestUnit = max(finestUnit, ts.TimeUnit())
			sawTime = true
		case arrow.DURATION:
			ts := ty.(*arrow.DurationType)
			finestUnit = max(finestUnit, ts.Unit)
			sawDuration = true
		default:
			return nil
		}
	}

	sawTimestampOrDate := zone != nil || sawDate32 || sawDate64

	if sawTimestampOrDate && (sawTime || sawDuration) {
		// no common type possible
		return nil
	}

	if sawTimestampOrDate {
		switch {
		case zone != nil:
			// at least one timestamp seen
			return &arrow.TimestampType{Unit: finestUnit, TimeZone: *zone}
		case sawDate64:
			return arrow.FixedWidthTypes.Date64
		case sawDate32:
			return arrow.FixedWidthTypes.Date32
		}
	} else if sawTime {
		switch finestUnit {
		case arrow.Second, arrow.Millisecond:
			return &arrow.Time32Type{Unit: finestUnit}
		case arrow.Microsecond, arrow.Nanosecond:
			return &arrow.Time64Type{Unit: finestUnit}
		}
	} else if sawDuration {
		// we can only get here if we ONLY saw durations
		return &arrow.DurationType{Unit: finestUnit}
	}
	return nil
}

func commonBinary(vals ...arrow.DataType) arrow.DataType {
	var (
		allUTF8, allOffset32, allFixedWidth = true, true, true
	)

	for _, ty := range vals {
		switch ty.ID() {
		case arrow.STRING:
			allFixedWidth = false
		case arrow.BINARY:
			allFixedWidth, allUTF8 = false, false
		case arrow.FIXED_SIZE_BINARY:
			allUTF8 = false
		case arrow.LARGE_BINARY:
			allOffset32, allFixedWidth, allUTF8 = false, false, false
		case arrow.LARGE_STRING:
			allOffset32, allFixedWidth = false, false
		default:
			return nil
		}
	}

	switch {
	case allFixedWidth:
		// at least for the purposes of comparison, no need to cast
		return nil
	case allUTF8:
		if allOffset32 {
			return arrow.BinaryTypes.String
		}
		return arrow.BinaryTypes.LargeString
	case allOffset32:
		return arrow.BinaryTypes.Binary
	}
	return arrow.BinaryTypes.LargeBinary
}
