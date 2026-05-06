/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mysql

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

// ZeroTimestamp is the special value 0 for a timestamp.
var ZeroTimestamp = []byte("0000-00-00 00:00:00")

// TableMap implements BinlogEvent.TableMap().
//
// Expected format (L = total length of event data):
//  # bytes   field
//  4/6       table id
//  2         flags
//  1         schema name length sl
//  sl        schema name
//  1         [00]
//  1         table name length tl
//  tl        table name
//  1         [00]
//  <var>     column count cc (var-len encoded)
//  cc        column-def, one byte per column
//  <var>     column-meta-def (var-len encoded string)
//  n         NULL-bitmask, length: (cc + 7) / 8
func (ev binlogEvent) TableMap(f BinlogFormat) (*TableMap, error) {
	data := ev.Bytes()[f.HeaderLength:]

	result := &TableMap{}
	pos := 6
	if f.HeaderSize(eTableMapEvent) == 6 {
		pos = 4
	}
	result.Flags = binary.LittleEndian.Uint16(data[pos : pos+2])
	pos += 2

	l := int(data[pos])
	result.Database = string(data[pos+1 : pos+1+l])
	pos += 1 + l + 1

	l = int(data[pos])
	result.Name = string(data[pos+1 : pos+1+l])
	pos += 1 + l + 1

	// FIXME(alainjobart) this is varlength encoded.
	columnCount := int(data[pos])
	pos++

	result.Types = data[pos : pos+columnCount]
	pos += columnCount

	// FIXME(alainjobart) this is a var-len-string.
	l = int(data[pos])
	pos++

	// Allocate and parse / copy Metadata.
	result.Metadata = make([]uint16, columnCount)
	expectedEnd := pos + l
	for c := 0; c < columnCount; c++ {
		var err error
		result.Metadata[c], pos, err = metadataRead(data, pos, result.Types[c])
		if err != nil {
			return nil, err
		}
	}
	if pos != expectedEnd {
		return nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "unexpected metadata end: got %v was expecting %v (data=%v)", pos, expectedEnd, data)
	}

	// A bit array that says if each column can be NULL.
	result.CanBeNull, _ = newBitmap(data, pos, columnCount)

	return result, nil
}

// metadataLength returns how many bytes are used for metadata, based on a type.
func metadataLength(typ byte) int {
	switch typ {
	case TypeDecimal, TypeTiny, TypeShort, TypeLong, TypeNull, TypeTimestamp, TypeLongLong, TypeInt24, TypeDate, TypeTime, TypeDateTime, TypeYear, TypeNewDate:
		// No data here.
		return 0

	case TypeFloat, TypeDouble, TypeTimestamp2, TypeDateTime2, TypeTime2, TypeJSON, TypeTinyBlob, TypeMediumBlob, TypeLongBlob, TypeBlob, TypeGeometry:
		// One byte.
		return 1

	case TypeNewDecimal, TypeEnum, TypeSet, TypeString:
		// Two bytes, Big Endian because of crazy encoding.
		return 2

	case TypeVarchar, TypeBit, TypeVarString:
		// Two bytes, Little Endian
		return 2

	default:
		// Unknown type. This is used in tests only, so panic.
		panic(vterrors.Errorf(vtrpc.Code_INTERNAL, "metadataLength: unhandled data type: %v", typ))
	}
}

// metadataTotalLength returns the total size of the metadata for an
// array of types.
func metadataTotalLength(types []byte) int {
	sum := 0
	for _, t := range types {
		sum += metadataLength(t)
	}
	return sum
}

// metadataRead reads a single value from the metadata string.
func metadataRead(data []byte, pos int, typ byte) (uint16, int, error) {
	switch typ {

	case TypeDecimal, TypeTiny, TypeShort, TypeLong, TypeNull, TypeTimestamp, TypeLongLong, TypeInt24, TypeDate, TypeTime, TypeDateTime, TypeYear, TypeNewDate:
		// No data here.
		return 0, pos, nil

	case TypeFloat, TypeDouble, TypeTimestamp2, TypeDateTime2, TypeTime2, TypeJSON, TypeTinyBlob, TypeMediumBlob, TypeLongBlob, TypeBlob, TypeGeometry:
		// One byte.
		return uint16(data[pos]), pos + 1, nil

	case TypeNewDecimal, TypeEnum, TypeSet, TypeString:
		// Two bytes, Big Endian because of crazy encoding.
		return uint16(data[pos])<<8 + uint16(data[pos+1]), pos + 2, nil

	case TypeVarchar, TypeBit, TypeVarString:
		// Two bytes, Little Endian
		return uint16(data[pos]) + uint16(data[pos+1])<<8, pos + 2, nil

	default:
		// Unknown types, we can't go on.
		return 0, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "metadataRead: unhandled data type: %v", typ)
	}
}

// metadataWrite writes a single value into the metadata string.
func metadataWrite(data []byte, pos int, typ byte, value uint16) int {
	switch typ {

	case TypeDecimal, TypeTiny, TypeShort, TypeLong, TypeNull, TypeTimestamp, TypeLongLong, TypeInt24, TypeDate, TypeTime, TypeDateTime, TypeYear, TypeNewDate:
		// No data here.
		return pos

	case TypeFloat, TypeDouble, TypeTimestamp2, TypeDateTime2, TypeTime2, TypeJSON, TypeTinyBlob, TypeMediumBlob, TypeLongBlob, TypeBlob, TypeGeometry:
		// One byte.
		data[pos] = byte(value)
		return pos + 1

	case TypeNewDecimal, TypeEnum, TypeSet, TypeString:
		// Two bytes, Big Endian because of crazy encoding.
		data[pos] = byte(value >> 8)
		data[pos+1] = byte(value)
		return pos + 2

	case TypeVarchar, TypeBit, TypeVarString:
		// Two bytes, Little Endian
		data[pos] = byte(value)
		data[pos+1] = byte(value >> 8)
		return pos + 2

	default:
		// Unknown type. This is used in tests only, so panic.
		panic(vterrors.Errorf(vtrpc.Code_INTERNAL, "metadataRead: unhandled data type: %v", typ))
	}
}

var dig2bytes = []int{0, 1, 1, 2, 2, 3, 3, 4, 4, 4}

// cellLength returns the new position after the field with the given
// type is read.
func cellLength(data []byte, pos int, typ byte, metadata uint16) (int, error) {
	switch typ {
	case TypeNull:
		return 0, nil
	case TypeTiny, TypeYear:
		return 1, nil
	case TypeShort:
		return 2, nil
	case TypeInt24:
		return 3, nil
	case TypeLong, TypeFloat, TypeTimestamp:
		return 4, nil
	case TypeLongLong, TypeDouble:
		return 8, nil
	case TypeDate, TypeTime, TypeNewDate:
		return 3, nil
	case TypeDateTime:
		return 8, nil
	case TypeVarchar, TypeVarString:
		// Length is encoded in 1 or 2 bytes.
		if metadata > 255 {
			l := int(uint64(data[pos]) |
				uint64(data[pos+1])<<8)
			return l + 2, nil
		}
		l := int(data[pos])
		return l + 1, nil
	case TypeBit:
		// bitmap length is in metadata, as:
		// upper 8 bits: bytes length
		// lower 8 bits: bit length
		nbits := ((metadata >> 8) * 8) + (metadata & 0xFF)
		return (int(nbits) + 7) / 8, nil
	case TypeTimestamp2:
		// metadata has number of decimals. One byte encodes
		// two decimals.
		return 4 + (int(metadata)+1)/2, nil
	case TypeDateTime2:
		// metadata has number of decimals. One byte encodes
		// two decimals.
		return 5 + (int(metadata)+1)/2, nil
	case TypeTime2:
		// metadata has number of decimals. One byte encodes
		// two decimals.
		return 3 + (int(metadata)+1)/2, nil
	case TypeNewDecimal:
		precision := int(metadata >> 8)
		scale := int(metadata & 0xff)
		// Example:
		//   NNNNNNNNNNNN.MMMMMM
		//     12 bytes     6 bytes
		// precision is 18
		// scale is 6
		// storage is done by groups of 9 digits:
		// - 32 bits are used to store groups of 9 digits.
		// - any leftover digit is stored in:
		//   - 1 byte for 1 and 2 digits
		//   - 2 bytes for 3 and 4 digits
		//   - 3 bytes for 5 and 6 digits
		//   - 4 bytes for 7 and 8 digits (would also work for 9)
		// both sides of the dot are stored separately.
		// In this example, we'd have:
		// - 2 bytes to store the first 3 full digits.
		// - 4 bytes to store the next 9 full digits.
		// - 3 bytes to store the 6 fractional digits.
		intg := precision - scale
		intg0 := intg / 9
		frac0 := scale / 9
		intg0x := intg - intg0*9
		frac0x := scale - frac0*9
		return intg0*4 + dig2bytes[intg0x] + frac0*4 + dig2bytes[frac0x], nil
	case TypeEnum, TypeSet:
		return int(metadata & 0xff), nil
	case TypeJSON, TypeTinyBlob, TypeMediumBlob, TypeLongBlob, TypeBlob, TypeGeometry:
		// Of the Blobs, only TypeBlob is used in binary logs,
		// but supports others just in case.
		switch metadata {
		case 1:
			return 1 + int(uint32(data[pos])), nil
		case 2:
			return 2 + int(uint32(data[pos])|
				uint32(data[pos+1])<<8), nil
		case 3:
			return 3 + int(uint32(data[pos])|
				uint32(data[pos+1])<<8|
				uint32(data[pos+2])<<16), nil
		case 4:
			return 4 + int(uint32(data[pos])|
				uint32(data[pos+1])<<8|
				uint32(data[pos+2])<<16|
				uint32(data[pos+3])<<24), nil
		default:
			return 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "unsupported blob/geometry metadata value %v (data: %v pos: %v)", metadata, data, pos)
		}
	case TypeString:
		// This may do String, Enum, and Set. The type is in
		// metadata. If it's a string, then there will be more bits.
		// This will give us the maximum length of the field.
		t := metadata >> 8
		if t == TypeEnum || t == TypeSet {
			return int(metadata & 0xff), nil
		}
		max := int((((metadata >> 4) & 0x300) ^ 0x300) + (metadata & 0xff))
		// Length is encoded in 1 or 2 bytes.
		if max > 255 {
			l := int(uint64(data[pos]) |
				uint64(data[pos+1])<<8)
			return l + 2, nil
		}
		l := int(data[pos])
		return l + 1, nil

	default:
		return 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "unsupported type %v (data: %v pos: %v)", typ, data, pos)
	}
}

// printTimestamp is a helper method to append a timestamp into a bytes.Buffer,
// and return the Buffer.
func printTimestamp(v uint32) *bytes.Buffer {
	if v == 0 {
		return bytes.NewBuffer(ZeroTimestamp)
	}

	t := time.Unix(int64(v), 0).UTC()
	year, month, day := t.Date()
	hour, minute, second := t.Clock()

	result := &bytes.Buffer{}
	fmt.Fprintf(result, "%04d-%02d-%02d %02d:%02d:%02d", year, int(month), day, hour, minute, second)
	return result
}

// CellValue returns the data for a cell as a sqltypes.Value, and how
// many bytes it takes. It only uses the querypb.Type value for the
// signed flag.
func CellValue(data []byte, pos int, typ byte, metadata uint16, styp querypb.Type) (sqltypes.Value, int, error) {
	switch typ {
	case TypeTiny:
		if sqltypes.IsSigned(styp) {
			return sqltypes.MakeTrusted(querypb.Type_INT8,
				strconv.AppendInt(nil, int64(int8(data[pos])), 10)), 1, nil
		}
		return sqltypes.MakeTrusted(querypb.Type_UINT8,
			strconv.AppendUint(nil, uint64(data[pos]), 10)), 1, nil
	case TypeYear:
		val := data[pos]
		if val == 0 {
			return sqltypes.MakeTrusted(querypb.Type_YEAR,
				[]byte{'0', '0', '0', '0'}), 1, nil
		}
		return sqltypes.MakeTrusted(querypb.Type_YEAR,
			strconv.AppendUint(nil, uint64(data[pos])+1900, 10)), 1, nil
	case TypeShort:
		val := binary.LittleEndian.Uint16(data[pos : pos+2])
		if sqltypes.IsSigned(styp) {
			return sqltypes.MakeTrusted(querypb.Type_INT16,
				strconv.AppendInt(nil, int64(int16(val)), 10)), 2, nil
		}
		return sqltypes.MakeTrusted(querypb.Type_UINT16,
			strconv.AppendUint(nil, uint64(val), 10)), 2, nil
	case TypeInt24:
		if sqltypes.IsSigned(styp) && data[pos+2]&128 > 0 {
			// Negative number, have to extend the sign.
			val := int32(uint32(data[pos]) +
				uint32(data[pos+1])<<8 +
				uint32(data[pos+2])<<16 +
				uint32(255)<<24)
			return sqltypes.MakeTrusted(querypb.Type_INT24,
				strconv.AppendInt(nil, int64(val), 10)), 3, nil
		}
		// Positive number.
		val := uint64(data[pos]) +
			uint64(data[pos+1])<<8 +
			uint64(data[pos+2])<<16
		return sqltypes.MakeTrusted(querypb.Type_UINT24,
			strconv.AppendUint(nil, val, 10)), 3, nil
	case TypeLong:
		val := binary.LittleEndian.Uint32(data[pos : pos+4])
		if sqltypes.IsSigned(styp) {
			return sqltypes.MakeTrusted(querypb.Type_INT32,
				strconv.AppendInt(nil, int64(int32(val)), 10)), 4, nil
		}
		return sqltypes.MakeTrusted(querypb.Type_UINT32,
			strconv.AppendUint(nil, uint64(val), 10)), 4, nil
	case TypeFloat:
		val := binary.LittleEndian.Uint32(data[pos : pos+4])
		fval := math.Float32frombits(val)
		return sqltypes.MakeTrusted(querypb.Type_FLOAT32,
			strconv.AppendFloat(nil, float64(fval), 'E', -1, 32)), 4, nil
	case TypeDouble:
		val := binary.LittleEndian.Uint64(data[pos : pos+8])
		fval := math.Float64frombits(val)
		return sqltypes.MakeTrusted(querypb.Type_FLOAT64,
			strconv.AppendFloat(nil, fval, 'E', -1, 64)), 8, nil
	case TypeTimestamp:
		val := binary.LittleEndian.Uint32(data[pos : pos+4])
		txt := printTimestamp(val)
		return sqltypes.MakeTrusted(querypb.Type_TIMESTAMP,
			txt.Bytes()), 4, nil
	case TypeLongLong:
		val := binary.LittleEndian.Uint64(data[pos : pos+8])
		if sqltypes.IsSigned(styp) {
			return sqltypes.MakeTrusted(querypb.Type_INT64,
				strconv.AppendInt(nil, int64(val), 10)), 8, nil
		}
		return sqltypes.MakeTrusted(querypb.Type_UINT64,
			strconv.AppendUint(nil, val, 10)), 8, nil
	case TypeDate, TypeNewDate:
		val := uint32(data[pos]) +
			uint32(data[pos+1])<<8 +
			uint32(data[pos+2])<<16
		day := val & 31
		month := val >> 5 & 15
		year := val >> 9
		return sqltypes.MakeTrusted(querypb.Type_DATE,
			[]byte(fmt.Sprintf("%04d-%02d-%02d", year, month, day))), 3, nil
	case TypeTime:
		var hour, minute, second int32
		if data[pos+2]&128 > 0 {
			// Negative number, have to extend the sign.
			val := int32(uint32(data[pos]) +
				uint32(data[pos+1])<<8 +
				uint32(data[pos+2])<<16 +
				uint32(255)<<24)
			hour = val / 10000
			minute = -((val % 10000) / 100)
			second = -(val % 100)
		} else {
			val := int32(data[pos]) +
				int32(data[pos+1])<<8 +
				int32(data[pos+2])<<16
			hour = val / 10000
			minute = (val % 10000) / 100
			second = val % 100
		}
		return sqltypes.MakeTrusted(querypb.Type_TIME,
			[]byte(fmt.Sprintf("%02d:%02d:%02d", hour, minute, second))), 3, nil
	case TypeDateTime:
		val := binary.LittleEndian.Uint64(data[pos : pos+8])
		d := val / 1000000
		t := val % 1000000
		year := d / 10000
		month := (d % 10000) / 100
		day := d % 100
		hour := t / 10000
		minute := (t % 10000) / 100
		second := t % 100
		return sqltypes.MakeTrusted(querypb.Type_DATETIME,
			[]byte(fmt.Sprintf("%04d-%02d-%02d %02d:%02d:%02d", year, month, day, hour, minute, second))), 8, nil
	case TypeVarchar, TypeVarString:
		// Length is encoded in 1 or 2 bytes.
		if metadata > 255 {
			l := int(uint64(data[pos]) |
				uint64(data[pos+1])<<8)
			return sqltypes.MakeTrusted(querypb.Type_VARCHAR,
				data[pos+2:pos+2+l]), l + 2, nil
		}
		l := int(data[pos])
		return sqltypes.MakeTrusted(querypb.Type_VARCHAR,
			data[pos+1:pos+1+l]), l + 1, nil
	case TypeBit:
		// The contents is just the bytes, quoted.
		nbits := ((metadata >> 8) * 8) + (metadata & 0xFF)
		l := (int(nbits) + 7) / 8
		return sqltypes.MakeTrusted(querypb.Type_BIT,
			data[pos:pos+l]), l, nil
	case TypeTimestamp2:
		second := binary.BigEndian.Uint32(data[pos : pos+4])
		txt := printTimestamp(second)
		switch metadata {
		case 1:
			decimals := int(data[pos+4])
			fmt.Fprintf(txt, ".%01d", decimals/10)
			return sqltypes.MakeTrusted(querypb.Type_TIMESTAMP,
				txt.Bytes()), 5, nil
		case 2:
			decimals := int(data[pos+4])
			fmt.Fprintf(txt, ".%02d", decimals)
			return sqltypes.MakeTrusted(querypb.Type_TIMESTAMP,
				txt.Bytes()), 5, nil
		case 3:
			decimals := int(data[pos+4])<<8 +
				int(data[pos+5])
			fmt.Fprintf(txt, ".%03d", decimals/10)
			return sqltypes.MakeTrusted(querypb.Type_TIMESTAMP,
				txt.Bytes()), 6, nil
		case 4:
			decimals := int(data[pos+4])<<8 +
				int(data[pos+5])
			fmt.Fprintf(txt, ".%04d", decimals)
			return sqltypes.MakeTrusted(querypb.Type_TIMESTAMP,
				txt.Bytes()), 6, nil
		case 5:
			decimals := int(data[pos+4])<<16 +
				int(data[pos+5])<<8 +
				int(data[pos+6])
			fmt.Fprintf(txt, ".%05d", decimals/10)
			return sqltypes.MakeTrusted(querypb.Type_TIMESTAMP,
				txt.Bytes()), 7, nil
		case 6:
			decimals := int(data[pos+4])<<16 +
				int(data[pos+5])<<8 +
				int(data[pos+6])
			fmt.Fprintf(txt, ".%06d", decimals)
			return sqltypes.MakeTrusted(querypb.Type_TIMESTAMP,
				txt.Bytes()), 7, nil
		}
		return sqltypes.MakeTrusted(querypb.Type_TIMESTAMP,
			txt.Bytes()), 4, nil
	case TypeDateTime2:
		ymdhms := (uint64(data[pos])<<32 |
			uint64(data[pos+1])<<24 |
			uint64(data[pos+2])<<16 |
			uint64(data[pos+3])<<8 |
			uint64(data[pos+4])) - uint64(0x8000000000)
		ymd := ymdhms >> 17
		ym := ymd >> 5
		hms := ymdhms % (1 << 17)

		day := ymd % (1 << 5)
		month := ym % 13
		year := ym / 13

		second := hms % (1 << 6)
		minute := (hms >> 6) % (1 << 6)
		hour := hms >> 12

		txt := &bytes.Buffer{}
		fmt.Fprintf(txt, "%04d-%02d-%02d %02d:%02d:%02d", year, month, day, hour, minute, second)

		switch metadata {
		case 1:
			decimals := int(data[pos+5])
			fmt.Fprintf(txt, ".%01d", decimals/10)
			return sqltypes.MakeTrusted(querypb.Type_DATETIME,
				txt.Bytes()), 6, nil
		case 2:
			decimals := int(data[pos+5])
			fmt.Fprintf(txt, ".%02d", decimals)
			return sqltypes.MakeTrusted(querypb.Type_DATETIME,
				txt.Bytes()), 6, nil
		case 3:
			decimals := int(data[pos+5])<<8 +
				int(data[pos+6])
			fmt.Fprintf(txt, ".%03d", decimals/10)
			return sqltypes.MakeTrusted(querypb.Type_DATETIME,
				txt.Bytes()), 7, nil
		case 4:
			decimals := int(data[pos+5])<<8 +
				int(data[pos+6])
			fmt.Fprintf(txt, ".%04d", decimals)
			return sqltypes.MakeTrusted(querypb.Type_DATETIME,
				txt.Bytes()), 7, nil
		case 5:
			decimals := int(data[pos+5])<<16 +
				int(data[pos+6])<<8 +
				int(data[pos+7])
			fmt.Fprintf(txt, ".%05d", decimals/10)
			return sqltypes.MakeTrusted(querypb.Type_DATETIME,
				txt.Bytes()), 8, nil
		case 6:
			decimals := int(data[pos+5])<<16 +
				int(data[pos+6])<<8 +
				int(data[pos+7])
			fmt.Fprintf(txt, ".%06d", decimals)
			return sqltypes.MakeTrusted(querypb.Type_DATETIME,
				txt.Bytes()), 8, nil
		}
		return sqltypes.MakeTrusted(querypb.Type_DATETIME,
			txt.Bytes()), 5, nil
	case TypeTime2:
		hms := (int64(data[pos])<<16 |
			int64(data[pos+1])<<8 |
			int64(data[pos+2])) - 0x800000
		sign := ""
		if hms < 0 {
			hms = -hms
			sign = "-"
		}

		fracStr := ""
		switch metadata {
		case 1:
			frac := int(data[pos+3])
			if sign == "-" && frac != 0 {
				hms--
				frac = 0x100 - frac
			}
			fracStr = fmt.Sprintf(".%.1d", frac/10)
		case 2:
			frac := int(data[pos+3])
			if sign == "-" && frac != 0 {
				hms--
				frac = 0x100 - frac
			}
			fracStr = fmt.Sprintf(".%.2d", frac)
		case 3:
			frac := int(data[pos+3])<<8 |
				int(data[pos+4])
			if sign == "-" && frac != 0 {
				hms--
				frac = 0x10000 - frac
			}
			fracStr = fmt.Sprintf(".%.3d", frac/10)
		case 4:
			frac := int(data[pos+3])<<8 |
				int(data[pos+4])
			if sign == "-" && frac != 0 {
				hms--
				frac = 0x10000 - frac
			}
			fracStr = fmt.Sprintf(".%.4d", frac)
		case 5:
			frac := int(data[pos+3])<<16 |
				int(data[pos+4])<<8 |
				int(data[pos+5])
			if sign == "-" && frac != 0 {
				hms--
				frac = 0x1000000 - frac
			}
			fracStr = fmt.Sprintf(".%.5d", frac/10)
		case 6:
			frac := int(data[pos+3])<<16 |
				int(data[pos+4])<<8 |
				int(data[pos+5])
			if sign == "-" && frac != 0 {
				hms--
				frac = 0x1000000 - frac
			}
			fracStr = fmt.Sprintf(".%.6d", frac)
		}

		hour := (hms >> 12) % (1 << 10)
		minute := (hms >> 6) % (1 << 6)
		second := hms % (1 << 6)
		return sqltypes.MakeTrusted(querypb.Type_TIME,
			[]byte(fmt.Sprintf("%v%02d:%02d:%02d%v", sign, hour, minute, second, fracStr))), 3 + (int(metadata)+1)/2, nil

	case TypeNewDecimal:
		precision := int(metadata >> 8) // total digits number
		scale := int(metadata & 0xff)   // number of fractional digits
		intg := precision - scale       // number of full digits
		intg0 := intg / 9               // number of 32-bits digits
		intg0x := intg - intg0*9        // leftover full digits
		frac0 := scale / 9              // number of 32 bits fractionals
		frac0x := scale - frac0*9       // leftover fractionals

		l := intg0*4 + dig2bytes[intg0x] + frac0*4 + dig2bytes[frac0x]

		// Copy the data so we can change it. Otherwise
		// decoding is just too hard.
		d := make([]byte, l)
		copy(d, data[pos:pos+l])

		txt := &bytes.Buffer{}

		isNegative := (d[0] & 0x80) == 0
		d[0] ^= 0x80 // First bit is inverted.
		if isNegative {
			// Negative numbers are just inverted bytes.
			txt.WriteByte('-')
			for i := range d {
				d[i] ^= 0xff
			}
		}

		// first we have the leftover full digits
		var val uint32
		switch dig2bytes[intg0x] {
		case 0:
			// nothing to do
		case 1:
			// one byte, up to two digits
			val = uint32(d[0])
		case 2:
			// two bytes, up to 4 digits
			val = uint32(d[0])<<8 +
				uint32(d[1])
		case 3:
			// 3 bytes, up to 6 digits
			val = uint32(d[0])<<16 +
				uint32(d[1])<<8 +
				uint32(d[2])
		case 4:
			// 4 bytes, up to 8 digits (9 digits would be a full)
			val = uint32(d[0])<<24 +
				uint32(d[1])<<16 +
				uint32(d[2])<<8 +
				uint32(d[3])
		}
		pos = dig2bytes[intg0x]
		if val > 0 {
			txt.Write(strconv.AppendUint(nil, uint64(val), 10))
		}

		// now the full digits, 32 bits each, 9 digits
		for i := 0; i < intg0; i++ {
			val = binary.BigEndian.Uint32(d[pos : pos+4])
			fmt.Fprintf(txt, "%9d", val)
			pos += 4
		}

		// now see if we have a fraction
		if scale == 0 {
			return sqltypes.MakeTrusted(querypb.Type_DECIMAL,
				txt.Bytes()), l, nil
		}
		txt.WriteByte('.')

		// now the full fractional digits
		for i := 0; i < frac0; i++ {
			val = binary.BigEndian.Uint32(d[pos : pos+4])
			fmt.Fprintf(txt, "%09d", val)
			pos += 4
		}

		// then the partial fractional digits
		switch dig2bytes[frac0x] {
		case 0:
			// Nothing to do
			return sqltypes.MakeTrusted(querypb.Type_DECIMAL,
				txt.Bytes()), l, nil
		case 1:
			// one byte, 1 or 2 digits
			val = uint32(d[pos])
			if frac0x == 1 {
				fmt.Fprintf(txt, "%1d", val)
			} else {
				fmt.Fprintf(txt, "%02d", val)
			}
		case 2:
			// two bytes, 3 or 4 digits
			val = uint32(d[pos])<<8 +
				uint32(d[pos+1])
			if frac0x == 3 {
				fmt.Fprintf(txt, "%03d", val)
			} else {
				fmt.Fprintf(txt, "%04d", val)
			}
		case 3:
			// 3 bytes, 5 or 6 digits
			val = uint32(d[pos])<<16 +
				uint32(d[pos+1])<<8 +
				uint32(d[pos+2])
			if frac0x == 5 {
				fmt.Fprintf(txt, "%05d", val)
			} else {
				fmt.Fprintf(txt, "%06d", val)
			}
		case 4:
			// 4 bytes, 7 or 8 digits (9 digits would be a full)
			val = uint32(d[pos])<<24 +
				uint32(d[pos+1])<<16 +
				uint32(d[pos+2])<<8 +
				uint32(d[pos+3])
			if frac0x == 7 {
				fmt.Fprintf(txt, "%07d", val)
			} else {
				fmt.Fprintf(txt, "%08d", val)
			}
		}

		return sqltypes.MakeTrusted(querypb.Type_DECIMAL,
			txt.Bytes()), l, nil

	case TypeEnum:
		switch metadata & 0xff {
		case 1:
			// One byte storage.
			return sqltypes.MakeTrusted(querypb.Type_ENUM,
				strconv.AppendUint(nil, uint64(data[pos]), 10)), 1, nil
		case 2:
			// Two bytes storage.
			val := binary.LittleEndian.Uint16(data[pos : pos+2])
			return sqltypes.MakeTrusted(querypb.Type_ENUM,
				strconv.AppendUint(nil, uint64(val), 10)), 2, nil
		default:
			return sqltypes.NULL, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "unexpected enum size: %v", metadata&0xff)
		}

	case TypeSet:
		l := int(metadata & 0xff)
		return sqltypes.MakeTrusted(querypb.Type_SET,
			data[pos:pos+l]), l, nil

	case TypeJSON, TypeTinyBlob, TypeMediumBlob, TypeLongBlob, TypeBlob:
		// Only TypeBlob is used in binary logs,
		// but supports others just in case.
		l := 0
		switch metadata {
		case 1:
			l = int(uint32(data[pos]))
		case 2:
			l = int(uint32(data[pos]) |
				uint32(data[pos+1])<<8)
		case 3:
			l = int(uint32(data[pos]) |
				uint32(data[pos+1])<<8 |
				uint32(data[pos+2])<<16)
		case 4:
			l = int(uint32(data[pos]) |
				uint32(data[pos+1])<<8 |
				uint32(data[pos+2])<<16 |
				uint32(data[pos+3])<<24)
		default:
			return sqltypes.NULL, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "unsupported blob metadata value %v (data: %v pos: %v)", metadata, data, pos)
		}
		pos += int(metadata)

		// For JSON, we parse the data, and emit SQL.
		if typ == TypeJSON {
			d, err := printJSONData(data[pos : pos+l])
			if err != nil {
				return sqltypes.NULL, 0, vterrors.Wrapf(err, "error parsing JSON data %v", data[pos:pos+l])
			}
			return sqltypes.MakeTrusted(sqltypes.Expression,
				d), l + int(metadata), nil
		}

		return sqltypes.MakeTrusted(querypb.Type_VARBINARY,
			data[pos:pos+l]), l + int(metadata), nil

	case TypeString:
		// This may do String, Enum, and Set. The type is in
		// metadata. If it's a string, then there will be more bits.
		t := metadata >> 8
		if t == TypeEnum {
			// We don't know the string values. So just use the
			// numbers.
			switch metadata & 0xff {
			case 1:
				// One byte storage.
				return sqltypes.MakeTrusted(querypb.Type_UINT8,
					strconv.AppendUint(nil, uint64(data[pos]), 10)), 1, nil
			case 2:
				// Two bytes storage.
				val := binary.LittleEndian.Uint16(data[pos : pos+2])
				return sqltypes.MakeTrusted(querypb.Type_UINT16,
					strconv.AppendUint(nil, uint64(val), 10)), 2, nil
			default:
				return sqltypes.NULL, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "unexpected enum size: %v", metadata&0xff)
			}
		}
		if t == TypeSet {
			// We don't know the set values. So just use the
			// numbers.
			l := int(metadata & 0xff)
			var val uint64
			for i := 0; i < l; i++ {
				val += uint64(data[pos+i]) << (uint(i) * 8)
			}
			return sqltypes.MakeTrusted(querypb.Type_UINT64,
				strconv.AppendUint(nil, uint64(val), 10)), l, nil
		}
		// This is a real string. The length is weird.
		max := int((((metadata >> 4) & 0x300) ^ 0x300) + (metadata & 0xff))
		// Length is encoded in 1 or 2 bytes.
		if max > 255 {
			// This code path exists due to https://bugs.mysql.com/bug.php?id=37426.
			// CHAR types need to allocate 3 bytes per char. So, the length for CHAR(255)
			// cannot be represented in 1 byte. This also means that this rule does not
			// apply to BINARY data.
			l := int(uint64(data[pos]) |
				uint64(data[pos+1])<<8)
			return sqltypes.MakeTrusted(querypb.Type_VARCHAR,
				data[pos+2:pos+2+l]), l + 2, nil
		}
		l := int(data[pos])
		mdata := data[pos+1 : pos+1+l]
		if sqltypes.IsBinary(styp) {
			// Fixed length binaries have to be padded with zeroes
			// up to the length of the field. Otherwise, equality checks
			// fail against saved data. See https://github.com/vitessio/vitess/issues/3984.
			ret := make([]byte, max)
			copy(ret, mdata)
			return sqltypes.MakeTrusted(querypb.Type_BINARY, ret), l + 1, nil
		}
		return sqltypes.MakeTrusted(querypb.Type_VARCHAR, mdata), l + 1, nil

	case TypeGeometry:
		l := 0
		switch metadata {
		case 1:
			l = int(uint32(data[pos]))
		case 2:
			l = int(uint32(data[pos]) |
				uint32(data[pos+1])<<8)
		case 3:
			l = int(uint32(data[pos]) |
				uint32(data[pos+1])<<8 |
				uint32(data[pos+2])<<16)
		case 4:
			l = int(uint32(data[pos]) |
				uint32(data[pos+1])<<8 |
				uint32(data[pos+2])<<16 |
				uint32(data[pos+3])<<24)
		default:
			return sqltypes.NULL, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "unsupported geometry metadata value %v (data: %v pos: %v)", metadata, data, pos)
		}
		pos += int(metadata)
		return sqltypes.MakeTrusted(querypb.Type_GEOMETRY,
			data[pos:pos+l]), l + int(metadata), nil

	default:
		return sqltypes.NULL, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "unsupported type %v", typ)
	}
}

// Rows implements BinlogEvent.TableMap().
//
// Expected format (L = total length of event data):
//  # bytes   field
//  4/6       table id
//  2         flags
//  -- if version == 2
//  2         extra data length edl
//  edl       extra data
//  -- endif
// <var>      number of columns (var-len encoded)
// <var>      identify bitmap
// <var>      data bitmap
// -- for each row
// <var>      null bitmap for identify for present rows
// <var>      values for each identify field
// <var>      null bitmap for data for present rows
// <var>      values for each data field
// --
func (ev binlogEvent) Rows(f BinlogFormat, tm *TableMap) (Rows, error) {
	typ := ev.Type()
	data := ev.Bytes()[f.HeaderLength:]
	hasIdentify := typ == eUpdateRowsEventV1 || typ == eUpdateRowsEventV2 ||
		typ == eDeleteRowsEventV1 || typ == eDeleteRowsEventV2
	hasData := typ == eWriteRowsEventV1 || typ == eWriteRowsEventV2 ||
		typ == eUpdateRowsEventV1 || typ == eUpdateRowsEventV2

	result := Rows{}
	pos := 6
	if f.HeaderSize(typ) == 6 {
		pos = 4
	}
	result.Flags = binary.LittleEndian.Uint16(data[pos : pos+2])
	pos += 2

	// version=2 have extra data here.
	if typ == eWriteRowsEventV2 || typ == eUpdateRowsEventV2 || typ == eDeleteRowsEventV2 {
		// This extraDataLength contains the 2 bytes length.
		extraDataLength := binary.LittleEndian.Uint16(data[pos : pos+2])
		pos += int(extraDataLength)
	}

	// FIXME(alainjobart) this is var len encoded.
	columnCount := int(data[pos])
	pos++

	numIdentifyColumns := 0
	numDataColumns := 0

	if hasIdentify {
		// Bitmap of the columns used for identify.
		result.IdentifyColumns, pos = newBitmap(data, pos, columnCount)
		numIdentifyColumns = result.IdentifyColumns.BitCount()
	}

	if hasData {
		// Bitmap of columns that are present.
		result.DataColumns, pos = newBitmap(data, pos, columnCount)
		numDataColumns = result.DataColumns.BitCount()
	}

	// One row at a time.
	for pos < len(data) {
		row := Row{}

		if hasIdentify {
			// Bitmap of identify columns that are null (amongst the ones that are present).
			row.NullIdentifyColumns, pos = newBitmap(data, pos, numIdentifyColumns)

			// Get the identify values.
			startPos := pos
			valueIndex := 0
			for c := 0; c < columnCount; c++ {
				if !result.IdentifyColumns.Bit(c) {
					// This column is not represented.
					continue
				}

				if row.NullIdentifyColumns.Bit(valueIndex) {
					// This column is represented, but its value is NULL.
					valueIndex++
					continue
				}

				// This column is represented now. We need to skip its length.
				l, err := cellLength(data, pos, tm.Types[c], tm.Metadata[c])
				if err != nil {
					return result, err
				}
				pos += l
				valueIndex++
			}
			row.Identify = data[startPos:pos]
		}

		if hasData {
			// Bitmap of columns that are null (amongst the ones that are present).
			row.NullColumns, pos = newBitmap(data, pos, numDataColumns)

			// Get the values.
			startPos := pos
			valueIndex := 0
			for c := 0; c < columnCount; c++ {
				if !result.DataColumns.Bit(c) {
					// This column is not represented.
					continue
				}

				if row.NullColumns.Bit(valueIndex) {
					// This column is represented, but its value is NULL.
					valueIndex++
					continue
				}

				// This column is represented now. We need to skip its length.
				l, err := cellLength(data, pos, tm.Types[c], tm.Metadata[c])
				if err != nil {
					return result, err
				}
				pos += l
				valueIndex++
			}
			row.Data = data[startPos:pos]
		}

		result.Rows = append(result.Rows, row)
	}

	return result, nil
}

// StringValuesForTests is a helper method to return the string value
// of all columns in a row in a Row. Only use it in tests, as the
// returned values cannot be interpreted correctly without the schema.
// We assume everything is unsigned in this method.
func (rs *Rows) StringValuesForTests(tm *TableMap, rowIndex int) ([]string, error) {
	var result []string

	valueIndex := 0
	data := rs.Rows[rowIndex].Data
	pos := 0
	for c := 0; c < rs.DataColumns.Count(); c++ {
		if !rs.DataColumns.Bit(c) {
			continue
		}

		if rs.Rows[rowIndex].NullColumns.Bit(valueIndex) {
			// This column is represented, but its value is NULL.
			result = append(result, "NULL")
			valueIndex++
			continue
		}

		// We have real data
		value, l, err := CellValue(data, pos, tm.Types[c], tm.Metadata[c], querypb.Type_UINT64)
		if err != nil {
			return nil, err
		}
		result = append(result, value.ToString())
		pos += l
		valueIndex++
	}

	return result, nil
}

// StringIdentifiesForTests is a helper method to return the string
// identify of all columns in a row in a Row. Only use it in tests, as the
// returned values cannot be interpreted correctly without the schema.
// We assume everything is unsigned in this method.
func (rs *Rows) StringIdentifiesForTests(tm *TableMap, rowIndex int) ([]string, error) {
	var result []string

	valueIndex := 0
	data := rs.Rows[rowIndex].Identify
	pos := 0
	for c := 0; c < rs.IdentifyColumns.Count(); c++ {
		if !rs.IdentifyColumns.Bit(c) {
			continue
		}

		if rs.Rows[rowIndex].NullIdentifyColumns.Bit(valueIndex) {
			// This column is represented, but its value is NULL.
			result = append(result, "NULL")
			valueIndex++
			continue
		}

		// We have real data
		value, l, err := CellValue(data, pos, tm.Types[c], tm.Metadata[c], querypb.Type_UINT64)
		if err != nil {
			return nil, err
		}
		result = append(result, value.ToString())
		pos += l
		valueIndex++
	}

	return result, nil
}
