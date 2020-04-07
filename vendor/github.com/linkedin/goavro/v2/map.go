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
	"io"
	"math"
	"reflect"
)

func makeMapCodec(st map[string]*Codec, namespace string, schemaMap map[string]interface{}) (*Codec, error) {
	// map type must have values
	valueSchema, ok := schemaMap["values"]
	if !ok {
		return nil, errors.New("Map ought to have values key")
	}
	valueCodec, err := buildCodec(st, namespace, valueSchema)
	if err != nil {
		return nil, fmt.Errorf("Map values ought to be valid Avro type: %s", err)
	}

	return &Codec{
		typeName: &name{"map", nullNamespace},
		nativeFromBinary: func(buf []byte) (interface{}, []byte, error) {
			var err error
			var value interface{}

			// block count and block size
			if value, buf, err = longNativeFromBinary(buf); err != nil {
				return nil, nil, fmt.Errorf("cannot decode binary map block count: %s", err)
			}
			blockCount := value.(int64)
			if blockCount < 0 {
				// NOTE: A negative block count implies there is a long encoded
				// block size following the negative block count. We have no use
				// for the block size in this decoder, so we read and discard
				// the value.
				if blockCount == math.MinInt64 {
					// The minimum number for any signed numerical type can
					// never be made positive
					return nil, nil, fmt.Errorf("cannot decode binary map with block count: %d", blockCount)
				}
				blockCount = -blockCount // convert to its positive equivalent
				if _, buf, err = longNativeFromBinary(buf); err != nil {
					return nil, nil, fmt.Errorf("cannot decode binary map block size: %s", err)
				}
			}
			// Ensure block count does not exceed some sane value.
			if blockCount > MaxBlockCount {
				return nil, nil, fmt.Errorf("cannot decode binary map when block count exceeds MaxBlockCount: %d > %d", blockCount, MaxBlockCount)
			}
			// NOTE: While the attempt of a RAM optimization shown below is not
			// necessary, many encoders will encode all items in a single block.
			// We can optimize amount of RAM allocated by runtime for the array
			// by initializing the array for that number of items.
			mapValues := make(map[string]interface{}, blockCount)

			for blockCount != 0 {
				// Decode `blockCount` datum values from buffer
				for i := int64(0); i < blockCount; i++ {
					// first decode the key string
					if value, buf, err = stringNativeFromBinary(buf); err != nil {
						return nil, nil, fmt.Errorf("cannot decode binary map key: %s", err)
					}
					key := value.(string) // string decoder always returns a string
					if _, ok := mapValues[key]; ok {
						return nil, nil, fmt.Errorf("cannot decode binary map: duplicate key: %q", key)
					}
					// then decode the value
					if value, buf, err = valueCodec.nativeFromBinary(buf); err != nil {
						return nil, nil, fmt.Errorf("cannot decode binary map value for key %q: %s", key, err)
					}
					mapValues[key] = value
				}
				// Decode next blockCount from buffer, because there may be more blocks
				if value, buf, err = longNativeFromBinary(buf); err != nil {
					return nil, nil, fmt.Errorf("cannot decode binary map block count: %s", err)
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
						return nil, nil, fmt.Errorf("cannot decode binary map with block count: %d", blockCount)
					}
					blockCount = -blockCount // convert to its positive equivalent
					if _, buf, err = longNativeFromBinary(buf); err != nil {
						return nil, nil, fmt.Errorf("cannot decode binary map block size: %s", err)
					}
				}
				// Ensure block count does not exceed some sane value.
				if blockCount > MaxBlockCount {
					return nil, nil, fmt.Errorf("cannot decode binary map when block count exceeds MaxBlockCount: %d > %d", blockCount, MaxBlockCount)
				}
			}
			return mapValues, buf, nil
		},
		binaryFromNative: func(buf []byte, datum interface{}) ([]byte, error) {
			mapValues, err := convertMap(datum)
			if err != nil {
				return nil, fmt.Errorf("cannot encode binary map: %s", err)
			}

			keyCount := int64(len(mapValues))
			var alreadyEncoded, remainingInBlock int64

			for k, v := range mapValues {
				if remainingInBlock == 0 { // start a new block
					remainingInBlock = keyCount - alreadyEncoded
					if remainingInBlock > MaxBlockCount {
						// limit block count to MacBlockCount
						remainingInBlock = MaxBlockCount
					}
					buf, _ = longBinaryFromNative(buf, remainingInBlock)
				}

				// only fails when given non string, so elide error checking
				buf, _ = stringBinaryFromNative(buf, k)

				// encode the value
				if buf, err = valueCodec.binaryFromNative(buf, v); err != nil {
					return nil, fmt.Errorf("cannot encode binary map value for key %q: %v: %s", k, v, err)
				}

				remainingInBlock--
				alreadyEncoded++
			}
			return longBinaryFromNative(buf, 0) // append tailing 0 block count to signal end of Map
		},
		nativeFromTextual: func(buf []byte) (interface{}, []byte, error) {
			return genericMapTextDecoder(buf, valueCodec, nil) // codecFromKey == nil
		},
		textualFromNative: func(buf []byte, datum interface{}) ([]byte, error) {
			return genericMapTextEncoder(buf, datum, valueCodec, nil)
		},
	}, nil
}

// genericMapTextDecoder decodes a JSON text blob to a native Go map, using the
// codecs from codecFromKey, and if a key is not found in that map, from
// defaultCodec if provided. If defaultCodec is nil, this function returns an
// error if it encounters a map key that is not present in codecFromKey. If
// codecFromKey is nil, every map value will be decoded using defaultCodec, if
// possible.
func genericMapTextDecoder(buf []byte, defaultCodec *Codec, codecFromKey map[string]*Codec) (map[string]interface{}, []byte, error) {
	var value interface{}
	var err error
	var b byte

	lencodec := len(codecFromKey)
	mapValues := make(map[string]interface{}, lencodec)

	if buf, err = advanceAndConsume(buf, '{'); err != nil {
		return nil, nil, err
	}
	if buf, _ = advanceToNonWhitespace(buf); len(buf) == 0 {
		return nil, nil, io.ErrShortBuffer
	}
	// NOTE: Special case empty map
	if buf[0] == '}' {
		return mapValues, buf[1:], nil
	}

	// NOTE: Also terminates when read '}' byte.
	for len(buf) > 0 {
		// decode key string
		value, buf, err = stringNativeFromTextual(buf)
		if err != nil {
			return nil, nil, fmt.Errorf("cannot decode textual map: expected key: %s", err)
		}
		key := value.(string)
		// Is key already used?
		if _, ok := mapValues[key]; ok {
			return nil, nil, fmt.Errorf("cannot decode textual map: duplicate key: %q", key)
		}
		// Find a codec for the key
		fieldCodec := codecFromKey[key]
		if fieldCodec == nil {
			fieldCodec = defaultCodec
		}
		if fieldCodec == nil {
			return nil, nil, fmt.Errorf("cannot decode textual map: cannot determine codec: %q", key)
		}
		// decode colon
		if buf, err = advanceAndConsume(buf, ':'); err != nil {
			return nil, nil, err
		}
		// decode value
		if buf, _ = advanceToNonWhitespace(buf); len(buf) == 0 {
			return nil, nil, io.ErrShortBuffer
		}
		value, buf, err = fieldCodec.nativeFromTextual(buf)
		if err != nil {
			return nil, nil, err
		}
		// set map value for key
		mapValues[key] = value
		// either comma or closing curly brace
		if buf, _ = advanceToNonWhitespace(buf); len(buf) == 0 {
			return nil, nil, io.ErrShortBuffer
		}
		switch b = buf[0]; b {
		case '}':
			return mapValues, buf[1:], nil
		case ',':
			// no-op
		default:
			return nil, nil, fmt.Errorf("cannot decode textual map: expected ',' or '}'; received: %q", b)
		}
		// NOTE: consume comma from above
		if buf, _ = advanceToNonWhitespace(buf[1:]); len(buf) == 0 {
			return nil, nil, io.ErrShortBuffer
		}
	}
	return nil, nil, io.ErrShortBuffer
}

// genericMapTextEncoder encodes a native Go map to a JSON text blob, using the
// codecs from codecFromKey, and if a key is not found in that map, from
// defaultCodec if provided. If defaultCodec is nil, this function returns an
// error if it encounters a map key that is not present in codecFromKey. If
// codecFromKey is nil, every map value will be encoded using defaultCodec, if
// possible.
func genericMapTextEncoder(buf []byte, datum interface{}, defaultCodec *Codec, codecFromKey map[string]*Codec) ([]byte, error) {
	mapValues, err := convertMap(datum)
	if err != nil {
		return nil, fmt.Errorf("cannot encode textual map: %s", err)
	}

	var atLeastOne bool

	buf = append(buf, '{')

	for key, value := range mapValues {
		atLeastOne = true

		// Find a codec for the key
		fieldCodec := codecFromKey[key]
		if fieldCodec == nil {
			fieldCodec = defaultCodec
		}
		if fieldCodec == nil {
			return nil, fmt.Errorf("cannot encode textual map: cannot determine codec: %q", key)
		}
		// Encode key string
		buf, err = stringTextualFromNative(buf, key)
		if err != nil {
			return nil, err
		}
		buf = append(buf, ':')
		// Encode value
		buf, err = fieldCodec.textualFromNative(buf, value)
		if err != nil {
			// field was specified in datum; therefore its value was invalid
			return nil, fmt.Errorf("cannot encode textual map: value for %q does not match its schema: %s", key, err)
		}
		buf = append(buf, ',')
	}

	if atLeastOne {
		return append(buf[:len(buf)-1], '}'), nil
	}
	return append(buf, '}'), nil
}

// convertMap converts datum to map[string]interface{} if possible.
func convertMap(datum interface{}) (map[string]interface{}, error) {
	mapValues, ok := datum.(map[string]interface{})
	if ok {
		return mapValues, nil
	}
	// NOTE: When given a map of any other type, zip values to items as a
	// convenience to client.
	v := reflect.ValueOf(datum)
	if v.Kind() != reflect.Map {
		return nil, fmt.Errorf("cannot create map[string]interface{}: expected map[string]...; received: %T", datum)
	}
	// NOTE: Two better alternatives to the current algorithm are:
	//   (1) mutate the reflection tuple underneath to convert the
	//       map[string]int, for example, to map[string]interface{}, with
	//       O(1) complexity.
	//   (2) use copy builtin to zip the data items over with O(n) complexity,
	//       but more efficient than what's below.
	mapValues = make(map[string]interface{}, v.Len())
	for _, key := range v.MapKeys() {
		k, ok := key.Interface().(string)
		if !ok {
			// bail when map key type is not string
			return nil, fmt.Errorf("cannot create map[string]interface{}: expected map[string]...; received: %T", datum)
		}
		mapValues[string(k)] = v.MapIndex(key).Interface()
	}
	return mapValues, nil
}
