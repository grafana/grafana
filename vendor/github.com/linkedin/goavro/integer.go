// Copyright [2017] LinkedIn Corp. Licensed under the Apache License, Version
// 2.0 (the "License"); you may not use this file except in compliance with the
// License.  You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

package goavro

import (
	"fmt"
	"io"
	"strconv"
)

const (
	intDownShift  = uint32(31)
	intFlag       = byte(128)
	intMask       = byte(127)
	longDownShift = uint32(63)
)

////////////////////////////////////////
// Binary Decode
////////////////////////////////////////

func intNativeFromBinary(buf []byte) (interface{}, []byte, error) {
	var offset, value int
	var shift uint
	for offset = 0; offset < len(buf); offset++ {
		b := buf[offset]
		value |= int(b&intMask) << shift
		if b&intFlag == 0 {
			return (int32(value>>1) ^ -int32(value&1)), buf[offset+1:], nil
		}
		shift += 7
	}
	return nil, nil, io.ErrShortBuffer
}

func longNativeFromBinary(buf []byte) (interface{}, []byte, error) {
	var offset int
	var value uint64
	var shift uint
	for offset = 0; offset < len(buf); offset++ {
		b := buf[offset]
		value |= uint64(b&intMask) << shift
		if b&intFlag == 0 {
			return (int64(value>>1) ^ -int64(value&1)), buf[offset+1:], nil
		}
		shift += 7
	}
	return nil, nil, io.ErrShortBuffer
}

////////////////////////////////////////
// Binary Encode
////////////////////////////////////////

func intBinaryFromNative(buf []byte, datum interface{}) ([]byte, error) {
	var value int32
	switch v := datum.(type) {
	case int32:
		value = v
	case int:
		if value = int32(v); int(value) != v {
			return nil, fmt.Errorf("cannot encode binary int: provided Go int would lose precision: %d", v)
		}
	case int64:
		if value = int32(v); int64(value) != v {
			return nil, fmt.Errorf("cannot encode binary int: provided Go int64 would lose precision: %d", v)
		}
	case float64:
		if value = int32(v); float64(value) != v {
			return nil, fmt.Errorf("cannot encode binary int: provided Go float64 would lose precision: %f", v)
		}
	case float32:
		if value = int32(v); float32(value) != v {
			return nil, fmt.Errorf("cannot encode binary int: provided Go float32 would lose precision: %f", v)
		}
	default:
		return nil, fmt.Errorf("cannot encode binary int: expected: Go numeric; received: %T", datum)
	}
	encoded := uint64((uint32(value) << 1) ^ uint32(value>>intDownShift))
	return integerBinaryEncoder(buf, encoded)
}

func longBinaryFromNative(buf []byte, datum interface{}) ([]byte, error) {
	var value int64
	switch v := datum.(type) {
	case int64:
		value = v
	case int:
		value = int64(v)
	case int32:
		value = int64(v)
	case float64:
		if value = int64(v); float64(value) != v {
			return nil, fmt.Errorf("cannot encode binary long: provided Go float64 would lose precision: %f", v)
		}
	case float32:
		if value = int64(v); float32(value) != v {
			return nil, fmt.Errorf("cannot encode binary long: provided Go float32 would lose precision: %f", v)
		}
	default:
		return nil, fmt.Errorf("long: expected: Go numeric; received: %T", datum)
	}
	encoded := (uint64(value) << 1) ^ uint64(value>>longDownShift)
	return integerBinaryEncoder(buf, encoded)
}

func integerBinaryEncoder(buf []byte, encoded uint64) ([]byte, error) {
	// used by both intBinaryEncoder and longBinaryEncoder
	if encoded == 0 {
		return append(buf, 0), nil
	}
	for encoded > 0 {
		b := byte(encoded) & intMask
		encoded = encoded >> 7
		if encoded != 0 {
			b |= intFlag // set high bit; we have more bytes
		}
		buf = append(buf, b)
	}
	return buf, nil
}

////////////////////////////////////////
// Text Decode
////////////////////////////////////////

func longNativeFromTextual(buf []byte) (interface{}, []byte, error) {
	return integerTextDecoder(buf, 64)
}

func intNativeFromTextual(buf []byte) (interface{}, []byte, error) {
	return integerTextDecoder(buf, 32)
}

func integerTextDecoder(buf []byte, bitSize int) (interface{}, []byte, error) {
	index, err := numberLength(buf, false) // NOTE: floatAllowed = false
	if err != nil {
		return nil, nil, err
	}
	datum, err := strconv.ParseInt(string(buf[:index]), 10, bitSize)
	if err != nil {
		return nil, nil, err
	}
	if bitSize == 32 {
		return int32(datum), buf[index:], nil
	}
	return datum, buf[index:], nil
}

////////////////////////////////////////
// Text Encode
////////////////////////////////////////

func longTextualFromNative(buf []byte, datum interface{}) ([]byte, error) {
	return integerTextEncoder(buf, datum, 64)
}

func intTextualFromNative(buf []byte, datum interface{}) ([]byte, error) {
	return integerTextEncoder(buf, datum, 32)
}

func integerTextEncoder(buf []byte, datum interface{}, bitSize int) ([]byte, error) {
	var someInt64 int64
	switch v := datum.(type) {
	case int:
		someInt64 = int64(v)
	case int32:
		someInt64 = int64(v)
	case int64:
		someInt64 = v
	case float32:
		if someInt64 = int64(v); float32(someInt64) != v {
			if bitSize == 64 {
				return nil, fmt.Errorf("cannot encode textual long: provided Go float32 would lose precision: %f", v)
			}
			return nil, fmt.Errorf("cannot encode textual int: provided Go float32 would lose precision: %f", v)
		}
	case float64:
		if someInt64 = int64(v); float64(someInt64) != v {
			if bitSize == 64 {
				return nil, fmt.Errorf("cannot encode textual long: provided Go float64 would lose precision: %f", v)
			}
			return nil, fmt.Errorf("cannot encode textual int: provided Go float64 would lose precision: %f", v)
		}
	default:
		if bitSize == 64 {
			return nil, fmt.Errorf("cannot encode textual long: expected: Go numeric; received: %T", datum)
		}
		return nil, fmt.Errorf("cannot encode textual int: expected: Go numeric; received: %T", datum)
	}
	return strconv.AppendInt(buf, someInt64, 10), nil
}
