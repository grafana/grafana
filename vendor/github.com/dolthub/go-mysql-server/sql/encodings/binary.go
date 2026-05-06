// Copyright 2022 Dolthub, Inc.
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

package encodings

import "unicode/utf8"

// binaryEncoder is the implementation of Binary. This returns whatever it is given.
type binaryEncoder struct{}

// Binary represents the `binary` character set encoding.
var Binary Encoder = binaryEncoder{}

// Decode implements the Encoder interface.
func (binaryEncoder) Decode(str []byte) ([]byte, bool) {
	return str, true
}

// Encode implements the Encoder interface.
func (binaryEncoder) Encode(str []byte) ([]byte, bool) {
	return str, true
}

// EncodeReplaceUnknown implements the Encoder interface.
func (binaryEncoder) EncodeReplaceUnknown(str []byte) []byte {
	return str
}

// DecodeRune implements the Encoder interface.
func (binaryEncoder) DecodeRune(r []byte) ([]byte, bool) {
	return r, true
}

// EncodeRune implements the Encoder interface.
func (binaryEncoder) EncodeRune(r []byte) ([]byte, bool) {
	return r, true
}

// Uppercase implements the Encoder interface.
func (binaryEncoder) Uppercase(str string) string {
	return str
}

// Lowercase implements the Encoder interface.
func (binaryEncoder) Lowercase(str string) string {
	return str
}

// UppercaseRune implements the Encoder interface.
func (binaryEncoder) UppercaseRune(r rune) rune {
	return r
}

// LowercaseRune implements the Encoder interface.
func (binaryEncoder) LowercaseRune(r rune) rune {
	return r
}

// NextRune implements the Encoder interface.
func (binaryEncoder) NextRune(str string) (rune, int) {
	if len(str) == 0 {
		return utf8.RuneError, 0
	}
	return rune(str[0]), 1
}

// IsReturnSafe implements the Encoder interface. Since all functions return their input, they are not safe to freely
// modify, and must be copied to preserve the original slice.
func (binaryEncoder) IsReturnSafe() bool {
	return false
}

// Binary_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `binary` collation.
func Binary_RuneWeight(r rune) int32 {
	return int32(r)
}
