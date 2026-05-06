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
)

// This file contains the data encoding and decoding functions.

//
// Encoding methods.
//
// The same assumptions are made for all the encoding functions:
// - there is enough space to write the data in the buffer. If not, we
// will panic with out of bounds.
// - all functions start writing at 'pos' in the buffer, and return the next position.

// lenEncIntSize returns the number of bytes required to encode a
// variable-length integer.
func lenEncIntSize(i uint64) int {
	switch {
	case i < 251:
		return 1
	case i < 1<<16:
		return 3
	case i < 1<<24:
		return 4
	default:
		return 9
	}
}

func writeLenEncInt(data []byte, pos int, i uint64) int {
	switch {
	case i < 251:
		data[pos] = byte(i)
		return pos + 1
	case i < 1<<16:
		data[pos] = 0xfc
		data[pos+1] = byte(i)
		data[pos+2] = byte(i >> 8)
		return pos + 3
	case i < 1<<24:
		data[pos] = 0xfd
		data[pos+1] = byte(i)
		data[pos+2] = byte(i >> 8)
		data[pos+3] = byte(i >> 16)
		return pos + 4
	default:
		data[pos] = 0xfe
		data[pos+1] = byte(i)
		data[pos+2] = byte(i >> 8)
		data[pos+3] = byte(i >> 16)
		data[pos+4] = byte(i >> 24)
		data[pos+5] = byte(i >> 32)
		data[pos+6] = byte(i >> 40)
		data[pos+7] = byte(i >> 48)
		data[pos+8] = byte(i >> 56)
		return pos + 9
	}
}

func lenNullString(value string) int {
	return len(value) + 1
}

func lenEOFString(value string) int {
	return len(value)
}

func writeNullString(data []byte, pos int, value string) int {
	pos += copy(data[pos:], value)
	data[pos] = 0
	return pos + 1
}

func writeEOFString(data []byte, pos int, value string) int {
	pos += copy(data[pos:], value)
	return pos
}

func writeByte(data []byte, pos int, value byte) int {
	data[pos] = value
	return pos + 1
}

func writeUint16(data []byte, pos int, value uint16) int {
	data[pos] = byte(value)
	data[pos+1] = byte(value >> 8)
	return pos + 2
}

func writeUint32(data []byte, pos int, value uint32) int {
	data[pos] = byte(value)
	data[pos+1] = byte(value >> 8)
	data[pos+2] = byte(value >> 16)
	data[pos+3] = byte(value >> 24)
	return pos + 4
}

func writeUint64(data []byte, pos int, value uint64) int {
	data[pos] = byte(value)
	data[pos+1] = byte(value >> 8)
	data[pos+2] = byte(value >> 16)
	data[pos+3] = byte(value >> 24)
	data[pos+4] = byte(value >> 32)
	data[pos+5] = byte(value >> 40)
	data[pos+6] = byte(value >> 48)
	data[pos+7] = byte(value >> 56)
	return pos + 8
}

func lenEncStringSize(value string) int {
	l := len(value)
	return lenEncIntSize(uint64(l)) + l
}

func writeLenEncString(data []byte, pos int, value string) int {
	pos = writeLenEncInt(data, pos, uint64(len(value)))
	return writeEOFString(data, pos, value)
}

func writeZeroes(data []byte, pos int, len int) int {
	for i := 0; i < len; i++ {
		data[pos+i] = 0
	}
	return pos + len
}

//
// Decoding methods.
//
// The same assumptions are made for all the decoding functions:
// - they return the decode data, the new position to read from, and ak 'ok' flag.
// - all functions start reading at 'pos' in the buffer, and return the next position.
//

func readByte(data []byte, pos int) (byte, int, bool) {
	if pos >= len(data) {
		return 0, 0, false
	}
	return data[pos], pos + 1, true
}

func readBytes(data []byte, pos int, size int) ([]byte, int, bool) {
	if pos+size-1 >= len(data) {
		return nil, 0, false
	}
	return data[pos : pos+size], pos + size, true
}

// readBytesCopy returns a copy of the bytes in the packet.
// Useful to remember contents of ephemeral packets.
func readBytesCopy(data []byte, pos int, size int) ([]byte, int, bool) {
	if pos+size-1 >= len(data) {
		return nil, 0, false
	}
	result := make([]byte, size)
	copy(result, data[pos:pos+size])
	return result, pos + size, true
}

func readNullString(data []byte, pos int) (string, int, bool) {
	end := bytes.IndexByte(data[pos:], 0)
	if end == -1 {
		return "", 0, false
	}
	return string(data[pos : pos+end]), pos + end + 1, true
}

func readEOFString(data []byte, pos int) (string, int, bool) {
	return string(data[pos:]), len(data) - pos, true
}

func readUint8(data []byte, pos int) (uint8, int, bool) {
	b, pos, ok := readByte(data, pos)
	return uint8(b), pos, ok
}

func readUint16(data []byte, pos int) (uint16, int, bool) {
	if pos+1 >= len(data) {
		return 0, 0, false
	}
	return binary.LittleEndian.Uint16(data[pos : pos+2]), pos + 2, true
}

func readUint32(data []byte, pos int) (uint32, int, bool) {
	if pos+3 >= len(data) {
		return 0, 0, false
	}
	return binary.LittleEndian.Uint32(data[pos : pos+4]), pos + 4, true
}

func readUint64(data []byte, pos int) (uint64, int, bool) {
	if pos+7 >= len(data) {
		return 0, 0, false
	}
	return binary.LittleEndian.Uint64(data[pos : pos+8]), pos + 8, true
}

func readLenEncInt(data []byte, pos int) (uint64, int, bool) {
	if pos >= len(data) {
		return 0, 0, false
	}
	switch data[pos] {
	case 0xfc:
		// Encoded in the next 2 bytes.
		if pos+2 >= len(data) {
			return 0, 0, false
		}
		return uint64(data[pos+1]) |
			uint64(data[pos+2])<<8, pos + 3, true
	case 0xfd:
		// Encoded in the next 3 bytes.
		if pos+3 >= len(data) {
			return 0, 0, false
		}
		return uint64(data[pos+1]) |
			uint64(data[pos+2])<<8 |
			uint64(data[pos+3])<<16, pos + 4, true
	case 0xfe:
		// Encoded in the next 8 bytes.
		if pos+8 >= len(data) {
			return 0, 0, false
		}
		return uint64(data[pos+1]) |
			uint64(data[pos+2])<<8 |
			uint64(data[pos+3])<<16 |
			uint64(data[pos+4])<<24 |
			uint64(data[pos+5])<<32 |
			uint64(data[pos+6])<<40 |
			uint64(data[pos+7])<<48 |
			uint64(data[pos+8])<<56, pos + 9, true
	}
	return uint64(data[pos]), pos + 1, true
}

func readLenEncString(data []byte, pos int) (string, int, bool) {
	size, pos, ok := readLenEncInt(data, pos)
	if !ok {
		return "", 0, false
	}
	s := int(size)
	if pos+s-1 >= len(data) {
		return "", 0, false
	}
	return string(data[pos : pos+s]), pos + s, true
}

func skipLenEncString(data []byte, pos int) (int, bool) {
	size, pos, ok := readLenEncInt(data, pos)
	if !ok {
		return 0, false
	}
	s := int(size)
	if pos+s-1 >= len(data) {
		return 0, false
	}
	return pos + s, true
}

func readLenEncStringAsBytes(data []byte, pos int) ([]byte, int, bool) {
	size, pos, ok := readLenEncInt(data, pos)
	if !ok {
		return nil, 0, false
	}
	s := int(size)
	if pos+s-1 >= len(data) {
		return nil, 0, false
	}
	return data[pos : pos+s], pos + s, true
}

func readLenEncStringAsBytesCopy(data []byte, pos int) ([]byte, int, bool) {
	size, pos, ok := readLenEncInt(data, pos)
	if !ok {
		return nil, 0, false
	}
	s := int(size)
	if pos+s-1 >= len(data) {
		return nil, 0, false
	}
	result := make([]byte, size)
	copy(result, data[pos:pos+s])
	return result, pos + s, true
}
