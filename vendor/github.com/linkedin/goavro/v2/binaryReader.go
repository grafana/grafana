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
)

// bytesBinaryReader reads bytes from io.Reader and returns byte slice of
// specified size or the error encountered while trying to read those bytes.
func bytesBinaryReader(ior io.Reader) ([]byte, error) {
	size, err := longBinaryReader(ior)
	if err != nil {
		return nil, fmt.Errorf("cannot read bytes: cannot read size: %s", err)
	}
	if size < 0 {
		return nil, fmt.Errorf("cannot read bytes: size is negative: %d", size)
	}
	if size > MaxBlockSize {
		return nil, fmt.Errorf("cannot read bytes: size exceeds MaxBlockSize: %d > %d", size, MaxBlockSize)
	}
	buf := make([]byte, size)
	_, err = io.ReadAtLeast(ior, buf, int(size))
	if err != nil {
		return nil, fmt.Errorf("cannot read bytes: %s", err)
	}
	return buf, nil
}

// longBinaryReader reads bytes from io.Reader until has complete long value, or
// read error.
func longBinaryReader(ior io.Reader) (int64, error) {
	var value uint64
	var shift uint
	var err error
	var b byte

	// NOTE: While benchmarks show it's more performant to invoke ReadByte when
	// available, testing whether a variable's data type implements a particular
	// method is quite slow too. So perform the test once, and branch to the
	// appropriate loop based on the results.

	if byteReader, ok := ior.(io.ByteReader); ok {
		for {
			if b, err = byteReader.ReadByte(); err != nil {
				return 0, err // NOTE: must send back unaltered error to detect io.EOF
			}
			value |= uint64(b&intMask) << shift
			if b&intFlag == 0 {
				return (int64(value>>1) ^ -int64(value&1)), nil
			}
			shift += 7
		}
	}

	// NOTE: ior does not also implement io.ByteReader, so we must allocate a
	// byte slice with a single byte, and read each byte into the slice.
	buf := make([]byte, 1)
	for {
		if _, err = ior.Read(buf); err != nil {
			return 0, err // NOTE: must send back unaltered error to detect io.EOF
		}
		b = buf[0]
		value |= uint64(b&intMask) << shift
		if b&intFlag == 0 {
			return (int64(value>>1) ^ -int64(value&1)), nil
		}
		shift += 7
	}
}

// metadataBinaryReader reads bytes from io.Reader until has entire map value,
// or read error.
func metadataBinaryReader(ior io.Reader) (map[string][]byte, error) {
	var err error
	var value interface{}

	// block count and block size
	if value, err = longBinaryReader(ior); err != nil {
		return nil, fmt.Errorf("cannot read map block count: %s", err)
	}
	blockCount := value.(int64)
	if blockCount < 0 {
		if blockCount == math.MinInt64 {
			// The minimum number for any signed numerical type can never be
			// made positive
			return nil, fmt.Errorf("cannot read map with block count: %d", blockCount)
		}
		// NOTE: A negative block count implies there is a long encoded block
		// size following the negative block count. We have no use for the block
		// size in this decoder, so we read and discard the value.
		blockCount = -blockCount // convert to its positive equivalent
		if _, err = longBinaryReader(ior); err != nil {
			return nil, fmt.Errorf("cannot read map block size: %s", err)
		}
	}
	// Ensure block count does not exceed some sane value.
	if blockCount > MaxBlockCount {
		return nil, fmt.Errorf("cannot read map when block count exceeds MaxBlockCount: %d > %d", blockCount, MaxBlockCount)
	}
	// NOTE: While the attempt of a RAM optimization shown below is not
	// necessary, many encoders will encode all items in a single block.  We can
	// optimize amount of RAM allocated by runtime for the array by initializing
	// the array for that number of items.
	mapValues := make(map[string][]byte, blockCount)

	for blockCount != 0 {
		// Decode `blockCount` datum values from buffer
		for i := int64(0); i < blockCount; i++ {
			// first decode the key string
			keyBytes, err := bytesBinaryReader(ior)
			if err != nil {
				return nil, fmt.Errorf("cannot read map key: %s", err)
			}
			key := string(keyBytes)
			if _, ok := mapValues[key]; ok {
				return nil, fmt.Errorf("cannot read map: duplicate key: %q", key)
			}
			// metadata values are always bytes
			buf, err := bytesBinaryReader(ior)
			if err != nil {
				return nil, fmt.Errorf("cannot read map value for key %q: %s", key, err)
			}
			mapValues[key] = buf
		}
		// Decode next blockCount from buffer, because there may be more blocks
		if value, err = longBinaryReader(ior); err != nil {
			return nil, fmt.Errorf("cannot read map block count: %s", err)
		}
		blockCount = value.(int64)
		if blockCount < 0 {
			if blockCount == math.MinInt64 {
				// The minimum number for any signed numerical type can never be
				// made positive
				return nil, fmt.Errorf("cannot read map with block count: %d", blockCount)
			}
			// NOTE: A negative block count implies there is a long encoded
			// block size following the negative block count. We have no use for
			// the block size in this decoder, so we read and discard the value.
			blockCount = -blockCount // convert to its positive equivalent
			if _, err = longBinaryReader(ior); err != nil {
				return nil, fmt.Errorf("cannot read map block size: %s", err)
			}
		}
		// Ensure block count does not exceed some sane value.
		if blockCount > MaxBlockCount {
			return nil, fmt.Errorf("cannot read map when block count exceeds MaxBlockCount: %d > %d", blockCount, MaxBlockCount)
		}
	}
	return mapValues, nil
}
