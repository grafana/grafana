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
	"fmt"
	"io"
	"math"
	"reflect"
)

func makeArrayCodec(st map[string]*Codec, enclosingNamespace string, schemaMap map[string]interface{}) (*Codec, error) {
	// array type must have items
	itemSchema, ok := schemaMap["items"]
	if !ok {
		return nil, fmt.Errorf("Array ought to have items key")
	}
	itemCodec, err := buildCodec(st, enclosingNamespace, itemSchema)
	if err != nil {
		return nil, fmt.Errorf("Array items ought to be valid Avro type: %s", err)
	}

	return &Codec{
		typeName: &name{"array", nullNamespace},
		nativeFromBinary: func(buf []byte) (interface{}, []byte, error) {
			var value interface{}
			var err error

			// block count and block size
			if value, buf, err = longNativeFromBinary(buf); err != nil {
				return nil, nil, fmt.Errorf("cannot decode binary array block count: %s", err)
			}
			blockCount := value.(int64)
			if blockCount < 0 {
				// NOTE: A negative block count implies there is a long encoded
				// block size following the negative block count. We have no use
				// for the block size in this decoder, so we read and discard
				// the value.
				if blockCount == math.MinInt64 {
					// The minimum number for any signed numerical type can never be made positive
					return nil, nil, fmt.Errorf("cannot decode binary array with block count: %d", blockCount)
				}
				blockCount = -blockCount // convert to its positive equivalent
				if _, buf, err = longNativeFromBinary(buf); err != nil {
					return nil, nil, fmt.Errorf("cannot decode binary array block size: %s", err)
				}
			}
			// Ensure block count does not exceed some sane value.
			if blockCount > MaxBlockCount {
				return nil, nil, fmt.Errorf("cannot decode binary array when block count exceeds MaxBlockCount: %d > %d", blockCount, MaxBlockCount)
			}
			// NOTE: While the attempt of a RAM optimization shown below is not
			// necessary, many encoders will encode all items in a single block.
			// We can optimize amount of RAM allocated by runtime for the array
			// by initializing the array for that number of items.
			arrayValues := make([]interface{}, 0, blockCount)

			for blockCount != 0 {
				// Decode `blockCount` datum values from buffer
				for i := int64(0); i < blockCount; i++ {
					if value, buf, err = itemCodec.nativeFromBinary(buf); err != nil {
						return nil, nil, fmt.Errorf("cannot decode binary array item %d: %s", i+1, err)
					}
					arrayValues = append(arrayValues, value)
				}
				// Decode next blockCount from buffer, because there may be more blocks
				if value, buf, err = longNativeFromBinary(buf); err != nil {
					return nil, nil, fmt.Errorf("cannot decode binary array block count: %s", err)
				}
				blockCount = value.(int64)
				if blockCount < 0 {
					// NOTE: A negative block count implies there is a long
					// encoded block size following the negative block count. We
					// have no use for the block size in this decoder, so we
					// read and discard the value.
					if blockCount == math.MinInt64 {
						// The minimum number for any signed numerical type can
						// never be made positive
						return nil, nil, fmt.Errorf("cannot decode binary array with block count: %d", blockCount)
					}
					blockCount = -blockCount // convert to its positive equivalent
					if _, buf, err = longNativeFromBinary(buf); err != nil {
						return nil, nil, fmt.Errorf("cannot decode binary array block size: %s", err)
					}
				}
				// Ensure block count does not exceed some sane value.
				if blockCount > MaxBlockCount {
					return nil, nil, fmt.Errorf("cannot decode binary array when block count exceeds MaxBlockCount: %d > %d", blockCount, MaxBlockCount)
				}
			}
			return arrayValues, buf, nil
		},
		binaryFromNative: func(buf []byte, datum interface{}) ([]byte, error) {
			arrayValues, err := convertArray(datum)
			if err != nil {
				return nil, fmt.Errorf("cannot encode binary array: %s", err)
			}

			arrayLength := int64(len(arrayValues))
			var alreadyEncoded, remainingInBlock int64

			for i, item := range arrayValues {
				if remainingInBlock == 0 { // start a new block
					remainingInBlock = arrayLength - alreadyEncoded
					if remainingInBlock > MaxBlockCount {
						// limit block count to MacBlockCount
						remainingInBlock = MaxBlockCount
					}
					buf, _ = longBinaryFromNative(buf, remainingInBlock)
				}

				if buf, err = itemCodec.binaryFromNative(buf, item); err != nil {
					return nil, fmt.Errorf("cannot encode binary array item %d: %v: %s", i+1, item, err)
				}

				remainingInBlock--
				alreadyEncoded++
			}

			return longBinaryFromNative(buf, 0) // append trailing 0 block count to signal end of Array
		},
		nativeFromTextual: func(buf []byte) (interface{}, []byte, error) {
			var arrayValues []interface{}
			var value interface{}
			var err error
			var b byte

			if buf, err = advanceAndConsume(buf, '['); err != nil {
				return nil, nil, fmt.Errorf("cannot decode textual array: %s", err)
			}
			if buf, _ = advanceToNonWhitespace(buf); len(buf) == 0 {
				return nil, nil, fmt.Errorf("cannot decode textual array: %s", io.ErrShortBuffer)
			}
			// NOTE: Special case for empty array
			if buf[0] == ']' {
				return arrayValues, buf[1:], nil
			}

			// NOTE: Also terminates when read ']' byte.
			for len(buf) > 0 {
				// decode value
				value, buf, err = itemCodec.nativeFromTextual(buf)
				if err != nil {
					return nil, nil, fmt.Errorf("cannot decode textual array: %s", err)
				}
				arrayValues = append(arrayValues, value)
				// either comma or closing curly brace
				if buf, _ = advanceToNonWhitespace(buf); len(buf) == 0 {
					return nil, nil, fmt.Errorf("cannot decode textual array: %s", io.ErrShortBuffer)
				}
				switch b = buf[0]; b {
				case ']':
					return arrayValues, buf[1:], nil
				case ',':
					// no-op
				default:
					return nil, nil, fmt.Errorf("cannot decode textual array: expected ',' or ']'; received: %q", b)
				}
				// NOTE: consume comma from above
				if buf, _ = advanceToNonWhitespace(buf[1:]); len(buf) == 0 {
					return nil, nil, fmt.Errorf("cannot decode textual array: %s", io.ErrShortBuffer)
				}
			}
			return nil, buf, io.ErrShortBuffer
		},
		textualFromNative: func(buf []byte, datum interface{}) ([]byte, error) {
			arrayValues, err := convertArray(datum)
			if err != nil {
				return nil, fmt.Errorf("cannot encode textual array: %s", err)
			}

			var atLeastOne bool

			buf = append(buf, '[')

			for i, item := range arrayValues {
				atLeastOne = true

				// Encode value
				buf, err = itemCodec.textualFromNative(buf, item)
				if err != nil {
					// field was specified in datum; therefore its value was invalid
					return nil, fmt.Errorf("cannot encode textual array item %d; %v: %s", i+1, item, err)
				}
				buf = append(buf, ',')
			}

			if atLeastOne {
				return append(buf[:len(buf)-1], ']'), nil
			}
			return append(buf, ']'), nil
		},
	}, nil
}

// convertArray converts interface{} to []interface{} if possible.
func convertArray(datum interface{}) ([]interface{}, error) {
	arrayValues, ok := datum.([]interface{})
	if ok {
		return arrayValues, nil
	}
	// NOTE: When given a slice of any other type, zip values to
	// items as a convenience to client.
	v := reflect.ValueOf(datum)
	if v.Kind() != reflect.Slice {
		return nil, fmt.Errorf("cannot create []interface{}: expected slice; received: %T", datum)
	}
	// NOTE: Two better alternatives to the current algorithm are:
	//   (1) mutate the reflection tuple underneath to convert the
	//       []int, for example, to []interface{}, with O(1) complexity
	//   (2) use copy builtin to zip the data items over with O(n) complexity,
	//       but more efficient than what's below.
	// Suggestions?
	arrayValues = make([]interface{}, v.Len())
	for idx := 0; idx < v.Len(); idx++ {
		arrayValues[idx] = v.Index(idx).Interface()
	}
	return arrayValues, nil
}
