// Copyright [2019] LinkedIn Corp. Licensed under the Apache License, Version
// 2.0 (the "License"); you may not use this file except in compliance with the
// License.  You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

package goavro

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"time"
)

type toNativeFn func([]byte) (interface{}, []byte, error)
type fromNativeFn func([]byte, interface{}) ([]byte, error)

//////////////////////////////////////////////////////////////////////////////////////////////
// date logical type - to/from time.Time, time.UTC location
//////////////////////////////////////////////////////////////////////////////////////////////
func nativeFromDate(fn toNativeFn) toNativeFn {
	return func(bytes []byte) (interface{}, []byte, error) {
		l, b, err := fn(bytes)
		if err != nil {
			return l, b, err
		}
		i, ok := l.(int32)
		if !ok {
			return l, b, fmt.Errorf("cannot transform to native date, expected int, received %T", l)
		}
		t := time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC).AddDate(0, 0, int(i)).UTC()
		return t, b, nil
	}
}

func dateFromNative(fn fromNativeFn) fromNativeFn {
	return func(b []byte, d interface{}) ([]byte, error) {
		t, ok := d.(time.Time)
		if !ok {
			return nil, fmt.Errorf("cannot transform to binary date, expected time.Time, received %T", d)
		}
		// The number of days calculation is incredibly naive we take the time.Duration
		// between the given time and unix epoch and divide that by (24 * time.Hour)
		// This accuracy seems acceptable given the relation to unix epoch for now
		// TODO: replace with a better method
		numDays := t.UnixNano() / int64(24*time.Hour)
		return fn(b, numDays)
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////
// time-millis logical type - to/from time.Time, time.UTC location
//////////////////////////////////////////////////////////////////////////////////////////////
func nativeFromTimeMillis(fn toNativeFn) toNativeFn {
	return func(bytes []byte) (interface{}, []byte, error) {
		l, b, err := fn(bytes)
		if err != nil {
			return l, b, err
		}
		i, ok := l.(int32)
		if !ok {
			return l, b, fmt.Errorf("cannot transform to native time.Duration, expected int, received %T", l)
		}
		t := time.Duration(i) * time.Millisecond
		return t, b, nil
	}
}

func timeMillisFromNative(fn fromNativeFn) fromNativeFn {
	return func(b []byte, d interface{}) ([]byte, error) {
		t, ok := d.(time.Duration)
		if !ok {
			return nil, fmt.Errorf("cannot transform to binary time-millis, expected time.Duration, received %T", d)
		}
		duration := int32(t.Nanoseconds() / int64(time.Millisecond))
		return fn(b, duration)
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////
// time-micros logical type - to/from time.Time, time.UTC location
//////////////////////////////////////////////////////////////////////////////////////////////
func nativeFromTimeMicros(fn toNativeFn) toNativeFn {
	return func(bytes []byte) (interface{}, []byte, error) {
		l, b, err := fn(bytes)
		if err != nil {
			return l, b, err
		}
		i, ok := l.(int64)
		if !ok {
			return l, b, fmt.Errorf("cannot transform to native time.Duration, expected long, received %T", l)
		}
		t := time.Duration(i) * time.Microsecond
		return t, b, nil
	}
}

func timeMicrosFromNative(fn fromNativeFn) fromNativeFn {
	return func(b []byte, d interface{}) ([]byte, error) {
		t, ok := d.(time.Duration)
		if !ok {
			return nil, fmt.Errorf("cannot transform to binary time-micros, expected time.Duration, received %T", d)
		}
		duration := t.Nanoseconds() / int64(time.Microsecond)
		return fn(b, duration)
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////
// timestamp-millis logical type - to/from time.Time, time.UTC location
//////////////////////////////////////////////////////////////////////////////////////////////
func nativeFromTimeStampMillis(fn toNativeFn) toNativeFn {
	return func(bytes []byte) (interface{}, []byte, error) {
		l, b, err := fn(bytes)
		if err != nil {
			return l, b, err
		}
		i, ok := l.(int64)
		if !ok {
			return l, b, fmt.Errorf("cannot transform native timestamp-millis, expected int64, received %T", l)
		}
		secs := i / int64(time.Microsecond)
		nanosecs := (i - secs*int64(time.Microsecond)) * int64(time.Millisecond)
		return time.Unix(secs, nanosecs).UTC(), b, nil
	}
}

func timeStampMillisFromNative(fn fromNativeFn) fromNativeFn {
	return func(b []byte, d interface{}) ([]byte, error) {
		t, ok := d.(time.Time)
		if !ok {
			return nil, fmt.Errorf("cannot transform binary timestamp-millis, expected time.Time, received %T", d)
		}
		millisecs := t.UnixNano() / int64(time.Millisecond)
		return fn(b, millisecs)
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////
// timestamp-micros logical type - to/from time.Time, time.UTC location
//////////////////////////////////////////////////////////////////////////////////////////////
func nativeFromTimeStampMicros(fn toNativeFn) toNativeFn {
	return func(bytes []byte) (interface{}, []byte, error) {
		l, b, err := fn(bytes)
		if err != nil {
			return l, b, err
		}
		microseconds, ok := l.(int64)
		if !ok {
			return l, b, fmt.Errorf("cannot transform native timestamp-micros, expected int64, received %T", l)
		}
		// While this code performs a few more steps than seem required, it is
		// written this way to allow the best time resolution on UNIX and
		// Windows without overflowing the int64 value.  Windows has a zero-time
		// value of 1601-01-01 UTC, and the number of nanoseconds since that
		// zero-time overflows 64-bit integers.
		seconds := microseconds / 1e6
		nanoseconds := (microseconds - (seconds * 1e6)) * 1e3
		return time.Unix(seconds, nanoseconds).UTC(), b, nil
	}
}

func timeStampMicrosFromNative(fn fromNativeFn) fromNativeFn {
	return func(b []byte, d interface{}) ([]byte, error) {
		t, ok := d.(time.Time)
		if !ok {
			return nil, fmt.Errorf("cannot transform binary timestamp-micros, expected time.Time, received %T", d)
		}
		// While this code performs a few more steps than seem required, it is
		// written this way to allow the best time resolution on UNIX and
		// Windows without overflowing the int64 value.  Windows has a zero-time
		// value of 1601-01-01 UTC, and the number of nanoseconds since that
		// zero-time overflows 64-bit integers.
		return fn(b, t.Unix()*1e6+int64(t.Nanosecond()/1e3))
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////
// decimal logical-type - byte/fixed - to/from math/big.Rat
// two's complement algorithm taken from:
// https://groups.google.com/d/msg/golang-nuts/TV4bRVrHZUw/UcQt7S4IYlcJ by rog
/////////////////////////////////////////////////////////////////////////////////////////////
type makeCodecFn func(st map[string]*Codec, enclosingNamespace string, schemaMap map[string]interface{}) (*Codec, error)

func precisionAndScaleFromSchemaMap(schemaMap map[string]interface{}) (int, int, error) {
	p1, ok := schemaMap["precision"]
	if !ok {
		return 0, 0, errors.New("cannot create decimal logical type without precision")
	}
	p2, ok := p1.(float64)
	if !ok {
		return 0, 0, fmt.Errorf("cannot create decimal logical type with wrong precision type; expected: float64; received: %T", p1)
	}
	p3 := int(p2)
	if p3 <= 1 {
		return 0, 0, fmt.Errorf("cannot create decimal logical type when precision is less than one: %d", p3)
	}
	var s3 int // scale defaults to 0 if not set
	if s1, ok := schemaMap["scale"]; ok {
		s2, ok := s1.(float64)
		if !ok {
			return 0, 0, fmt.Errorf("cannot create decimal logical type with wrong precision type; expected: float64; received: %T", p1)
		}
		s3 = int(s2)
		if s3 < 0 {
			return 0, 0, fmt.Errorf("cannot create decimal logical type when scale is less than zero: %d", s3)
		}
		if s3 > p3 {
			return 0, 0, fmt.Errorf("cannot create decimal logical type when scale is larger than precision: %d > %d", s3, p3)
		}
	}
	return p3, s3, nil
}

var one = big.NewInt(1)

func makeDecimalBytesCodec(st map[string]*Codec, enclosingNamespace string, schemaMap map[string]interface{}) (*Codec, error) {
	precision, scale, err := precisionAndScaleFromSchemaMap(schemaMap)
	if err != nil {
		return nil, err
	}
	if _, ok := schemaMap["name"]; !ok {
		schemaMap["name"] = "bytes.decimal"
	}
	c, err := registerNewCodec(st, schemaMap, enclosingNamespace)
	if err != nil {
		return nil, fmt.Errorf("Bytes ought to have valid name: %s", err)
	}
	c.binaryFromNative = decimalBytesFromNative(bytesBinaryFromNative, toSignedBytes, precision, scale)
	c.textualFromNative = decimalBytesFromNative(bytesTextualFromNative, toSignedBytes, precision, scale)
	c.nativeFromBinary = nativeFromDecimalBytes(bytesNativeFromBinary, precision, scale)
	c.nativeFromTextual = nativeFromDecimalBytes(bytesNativeFromTextual, precision, scale)
	return c, nil
}

func nativeFromDecimalBytes(fn toNativeFn, precision, scale int) toNativeFn {
	return func(bytes []byte) (interface{}, []byte, error) {
		d, b, err := fn(bytes)
		if err != nil {
			return d, b, err
		}
		bs, ok := d.([]byte)
		if !ok {
			return nil, bytes, fmt.Errorf("cannot transform to native decimal, expected []byte, received %T", d)
		}
		i := big.NewInt(0)
		fromSignedBytes(i, bs)
		if i.BitLen() > 64 {
			// Avro spec specifies we return underlying type if the logicalType is invalid
			return d, b, err
		}
		r := big.NewRat(i.Int64(), int64(math.Pow10(scale)))
		return r, b, nil
	}
}

func decimalBytesFromNative(fromNativeFn fromNativeFn, toBytesFn toBytesFn, precision, scale int) fromNativeFn {
	return func(b []byte, d interface{}) ([]byte, error) {
		r, ok := d.(*big.Rat)
		if !ok {
			return nil, fmt.Errorf("cannot transform to bytes, expected *big.Rat, received %T", d)
		}
		// we reduce accuracy to precision by dividing and multiplying by digit length
		num := big.NewInt(0).Set(r.Num())
		denom := big.NewInt(0).Set(r.Denom())

		// we get the scaled decimal representation
		i := new(big.Int).Mul(num, big.NewInt(int64(math.Pow10(scale))))
		// divide that by the denominator
		precnum := new(big.Int).Div(i, denom)
		bout, err := toBytesFn(precnum)
		if err != nil {
			return nil, err
		}
		return fromNativeFn(b, bout)
	}
}

func makeDecimalFixedCodec(st map[string]*Codec, enclosingNamespace string, schemaMap map[string]interface{}) (*Codec, error) {
	precision, scale, err := precisionAndScaleFromSchemaMap(schemaMap)
	if err != nil {
		return nil, err
	}
	if _, ok := schemaMap["name"]; !ok {
		schemaMap["name"] = "fixed.decimal"
	}
	c, err := makeFixedCodec(st, enclosingNamespace, schemaMap)
	if err != nil {
		return nil, err
	}
	size, err := sizeFromSchemaMap(c.typeName, schemaMap)
	if err != nil {
		return nil, err
	}
	c.binaryFromNative = decimalBytesFromNative(c.binaryFromNative, toSignedFixedBytes(size), precision, scale)
	c.textualFromNative = decimalBytesFromNative(c.textualFromNative, toSignedFixedBytes(size), precision, scale)
	c.nativeFromBinary = nativeFromDecimalBytes(c.nativeFromBinary, precision, scale)
	c.nativeFromTextual = nativeFromDecimalBytes(c.nativeFromTextual, precision, scale)
	return c, nil
}

func padBytes(bytes []byte, fixedSize uint) []byte {
	s := int(fixedSize)
	padded := make([]byte, s, s)
	if s >= len(bytes) {
		copy(padded[s-len(bytes):], bytes)
	}
	return padded
}

type toBytesFn func(n *big.Int) ([]byte, error)

// fromSignedBytes sets the value of n to the big-endian two's complement
// value stored in the given data. If data[0]&80 != 0, the number
// is negative. If data is empty, the result will be 0.
func fromSignedBytes(n *big.Int, data []byte) {
	n.SetBytes(data)
	if len(data) > 0 && data[0]&0x80 > 0 {
		n.Sub(n, new(big.Int).Lsh(one, uint(len(data))*8))
	}
}

// toSignedBytes returns the big-endian two's complement
// form of n.
func toSignedBytes(n *big.Int) ([]byte, error) {
	switch n.Sign() {
	case 0:
		return []byte{0}, nil
	case 1:
		b := n.Bytes()
		if b[0]&0x80 > 0 {
			b = append([]byte{0}, b...)
		}
		return b, nil
	case -1:
		length := uint(n.BitLen()/8+1) * 8
		b := new(big.Int).Add(n, new(big.Int).Lsh(one, length)).Bytes()
		// When the most significant bit is on a byte
		// boundary, we can get some extra significant
		// bits, so strip them off when that happens.
		if len(b) >= 2 && b[0] == 0xff && b[1]&0x80 != 0 {
			b = b[1:]
		}
		return b, nil
	}
	return nil, fmt.Errorf("toSignedBytes: error big.Int.Sign() returned unexpected value")
}

// toSignedFixedBytes returns the big-endian two's complement
// form of n for a given length of bytes.
func toSignedFixedBytes(size uint) func(*big.Int) ([]byte, error) {
	return func(n *big.Int) ([]byte, error) {
		switch n.Sign() {
		case 0:
			return []byte{0}, nil
		case 1:
			b := n.Bytes()
			if b[0]&0x80 > 0 {
				b = append([]byte{0}, b...)
			}
			return padBytes(b, size), nil
		case -1:
			length := size * 8
			b := new(big.Int).Add(n, new(big.Int).Lsh(one, length)).Bytes()
			// Unlike a variable length byte length we need the extra bits to meet byte length
			return b, nil
		}
		return nil, fmt.Errorf("toSignedBytes: error big.Int.Sign() returned unexpected value")
	}
}
