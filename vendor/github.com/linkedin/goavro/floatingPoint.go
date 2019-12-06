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
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"strconv"
)

const (
	doubleEncodedLength = 8 // double requires 8 bytes
	floatEncodedLength  = 4 // float requires 4 bytes
)

////////////////////////////////////////
// Binary Decode
////////////////////////////////////////

func doubleNativeFromBinary(buf []byte) (interface{}, []byte, error) {
	if len(buf) < doubleEncodedLength {
		return nil, nil, fmt.Errorf("cannot decode binary double: %s", io.ErrShortBuffer)
	}
	return math.Float64frombits(binary.LittleEndian.Uint64(buf[:doubleEncodedLength])), buf[doubleEncodedLength:], nil
}

func floatNativeFromBinary(buf []byte) (interface{}, []byte, error) {
	if len(buf) < floatEncodedLength {
		return nil, nil, fmt.Errorf("cannot decode binary float: %s", io.ErrShortBuffer)
	}
	return math.Float32frombits(binary.LittleEndian.Uint32(buf[:floatEncodedLength])), buf[floatEncodedLength:], nil
}

////////////////////////////////////////
// Binary Encode
////////////////////////////////////////

func doubleBinaryFromNative(buf []byte, datum interface{}) ([]byte, error) {
	var value float64
	switch v := datum.(type) {
	case float64:
		value = v
	case float32:
		value = float64(v)
	case int:
		if value = float64(v); int(value) != v {
			return nil, fmt.Errorf("cannot encode binary double: provided Go int would lose precision: %d", v)
		}
	case int64:
		if value = float64(v); int64(value) != v {
			return nil, fmt.Errorf("cannot encode binary double: provided Go int64 would lose precision: %d", v)
		}
	case int32:
		if value = float64(v); int32(value) != v {
			return nil, fmt.Errorf("cannot encode binary double: provided Go int32 would lose precision: %d", v)
		}
	default:
		return nil, fmt.Errorf("cannot encode binary double: expected: Go numeric; received: %T", datum)
	}
	buf = append(buf, 0, 0, 0, 0, 0, 0, 0, 0)
	binary.LittleEndian.PutUint64(buf[len(buf)-doubleEncodedLength:], math.Float64bits(value))
	return buf, nil
}

func floatBinaryFromNative(buf []byte, datum interface{}) ([]byte, error) {
	var value float32
	switch v := datum.(type) {
	case float32:
		value = v
	case float64:
		// Assume runtime can cast special floats correctly, and if there is a
		// loss of precision from float64 and float32, that should be expected
		// or at least understood by the client.
		value = float32(v)
	case int:
		if value = float32(v); int(value) != v {
			return nil, fmt.Errorf("cannot encode binary float: provided Go int would lose precision: %d", v)
		}
	case int64:
		if value = float32(v); int64(value) != v {
			return nil, fmt.Errorf("cannot encode binary float: provided Go int64 would lose precision: %d", v)
		}
	case int32:
		if value = float32(v); int32(value) != v {
			return nil, fmt.Errorf("cannot encode binary float: provided Go int32 would lose precision: %d", v)
		}
	default:
		return nil, fmt.Errorf("cannot encode binary float: expected: Go numeric; received: %T", datum)
	}
	// return floatingBinaryEncoder(buf, uint64(math.Float32bits(value)), floatEncodedLength)
	buf = append(buf, 0, 0, 0, 0)
	binary.LittleEndian.PutUint32(buf[len(buf)-floatEncodedLength:], uint32(math.Float32bits(value)))
	return buf, nil
}

////////////////////////////////////////
// Text Decode
////////////////////////////////////////

func doubleNativeFromTextual(buf []byte) (interface{}, []byte, error) {
	return floatingTextDecoder(buf, 64)
}

func floatNativeFromTextual(buf []byte) (interface{}, []byte, error) {
	return floatingTextDecoder(buf, 32)
}

func floatingTextDecoder(buf []byte, bitSize int) (interface{}, []byte, error) {
	buflen := len(buf)
	if buflen >= 4 {
		if bytes.Equal(buf[:4], []byte("null")) {
			return math.NaN(), buf[4:], nil
		}
		if buflen >= 5 {
			if bytes.Equal(buf[:5], []byte("1e999")) {
				return math.Inf(1), buf[5:], nil
			}
			if buflen >= 6 {
				if bytes.Equal(buf[:6], []byte("-1e999")) {
					return math.Inf(-1), buf[6:], nil
				}
			}
		}
	}
	index, err := numberLength(buf, true) // NOTE: floatAllowed = true
	if err != nil {
		return nil, nil, err
	}
	datum, err := strconv.ParseFloat(string(buf[:index]), bitSize)
	if err != nil {
		return nil, nil, err
	}
	return datum, buf[index:], nil
}

func numberLength(buf []byte, floatAllowed bool) (int, error) {
	// ALGORITHM: increment index as long as bytes are valid for number state engine.
	var index, buflen, count int
	var b byte

	// STATE 0: begin, optional: -
	if buflen = len(buf); index == buflen {
		return 0, io.ErrShortBuffer
	}
	if buf[index] == '-' {
		if index++; index == buflen {
			return 0, io.ErrShortBuffer
		}
	}
	// STATE 1: if 0, goto 2; otherwise if 1-9, goto 3; otherwise bail
	if b = buf[index]; b == '0' {
		if index++; index == buflen {
			return index, nil // valid number
		}
	} else if b >= '1' && b <= '9' {
		if index++; index == buflen {
			return index, nil // valid number
		}
		// STATE 3: absorb zero or more digits
		for {
			if b = buf[index]; b < '0' || b > '9' {
				break
			}
			if index++; index == buflen {
				return index, nil // valid number
			}
		}
	} else {
		return 0, fmt.Errorf("unexpected byte: %q", b)
	}
	if floatAllowed {
		// STATE 2: if ., goto 4; otherwise goto 5
		if buf[index] == '.' {
			if index++; index == buflen {
				return 0, io.ErrShortBuffer
			}
			// STATE 4: absorb one or more digits
			for {
				if b = buf[index]; b < '0' || b > '9' {
					break
				}
				count++
				if index++; index == buflen {
					return index, nil // valid number
				}
			}
			if count == 0 {
				// did not get at least one digit
				return 0, fmt.Errorf("unexpected byte: %q", b)
			}
		}
		// STATE 5: if e|e, goto 6; otherwise goto 7
		if b = buf[index]; b == 'e' || b == 'E' {
			if index++; index == buflen {
				return 0, io.ErrShortBuffer
			}
			// STATE 6: if -|+, goto 8; otherwise goto 8
			if b = buf[index]; b == '+' || b == '-' {
				if index++; index == buflen {
					return 0, io.ErrShortBuffer
				}
			}
			// STATE 8: absorb one or more digits
			count = 0
			for {
				if b = buf[index]; b < '0' || b > '9' {
					break
				}
				count++
				if index++; index == buflen {
					return index, nil // valid number
				}
			}
			if count == 0 {
				// did not get at least one digit
				return 0, fmt.Errorf("unexpected byte: %q", b)
			}
		}
	}
	// STATE 7: end
	return index, nil
}

////////////////////////////////////////
// Text Encode
////////////////////////////////////////

func floatTextualFromNative(buf []byte, datum interface{}) ([]byte, error) {
	return floatingTextEncoder(buf, datum, 32)
}

func doubleTextualFromNative(buf []byte, datum interface{}) ([]byte, error) {
	return floatingTextEncoder(buf, datum, 64)
}

func floatingTextEncoder(buf []byte, datum interface{}, bitSize int) ([]byte, error) {
	var isFloat bool
	var someFloat64 float64
	var someInt64 int64
	switch v := datum.(type) {
	case float32:
		isFloat = true
		someFloat64 = float64(v)
	case float64:
		isFloat = true
		someFloat64 = v
	case int:
		if someInt64 = int64(v); int(someInt64) != v {
			if bitSize == 64 {
				return nil, fmt.Errorf("cannot encode textual double: provided Go int would lose precision: %d", v)
			}
			return nil, fmt.Errorf("cannot encode textual float: provided Go int would lose precision: %d", v)
		}
	case int64:
		someInt64 = v
	case int32:
		if someInt64 = int64(v); int32(someInt64) != v {
			if bitSize == 64 {
				return nil, fmt.Errorf("cannot encode textual double: provided Go int32 would lose precision: %d", v)
			}
			return nil, fmt.Errorf("cannot encode textual float: provided Go int32 would lose precision: %d", v)
		}
	default:
		if bitSize == 64 {
			return nil, fmt.Errorf("cannot encode textual double: expected: Go numeric; received: %T", datum)
		}
		return nil, fmt.Errorf("cannot encode textual float: expected: Go numeric; received: %T", datum)
	}

	if isFloat {
		if math.IsNaN(someFloat64) {
			return append(buf, "null"...), nil
		}
		if math.IsInf(someFloat64, 1) {
			return append(buf, "1e999"...), nil
		}
		if math.IsInf(someFloat64, -1) {
			return append(buf, "-1e999"...), nil
		}
		return strconv.AppendFloat(buf, someFloat64, 'g', -1, bitSize), nil
	}
	return strconv.AppendInt(buf, someInt64, 10), nil
}
