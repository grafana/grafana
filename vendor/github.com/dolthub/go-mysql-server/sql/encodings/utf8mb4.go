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

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

// utf8mb4Encoder is the implementation of Utf8mb4. As Go's string encoding perfectly matches `utf8mb4`, all of the
// encoding and decoding functions are identity functions.
type utf8mb4Encoder struct{}

// Utf8mb4 represents the `utf8mb4` character set encoding.
var Utf8mb4 Encoder = utf8mb4Encoder{}

// Decode implements the Encoder interface.
func (utf8mb4Encoder) Decode(str []byte) ([]byte, bool) {
	return str, true
}

// Encode implements the Encoder interface.
func (utf8mb4Encoder) Encode(str []byte) ([]byte, bool) {
	return str, true
}

// EncodeReplaceUnknown implements the Encoder interface.
func (utf8mb4Encoder) EncodeReplaceUnknown(str []byte) []byte {
	return str
}

// DecodeRune implements the Encoder interface.
func (utf8mb4Encoder) DecodeRune(r []byte) ([]byte, bool) {
	return r, true
}

// EncodeRune implements the Encoder interface.
func (utf8mb4Encoder) EncodeRune(r []byte) ([]byte, bool) {
	return r, true
}

// Uppercase implements the Encoder interface.
func (utf8mb4Encoder) Uppercase(str string) string {
	return strings.ToUpper(str)
}

// Lowercase implements the Encoder interface.
func (utf8mb4Encoder) Lowercase(str string) string {
	return strings.ToLower(str)
}

// UppercaseRune implements the Encoder interface.
func (utf8mb4Encoder) UppercaseRune(r rune) rune {
	return unicode.ToUpper(r)
}

// LowercaseRune implements the Encoder interface.
func (utf8mb4Encoder) LowercaseRune(r rune) rune {
	return unicode.ToLower(r)
}

// NextRune implements the Encoder interface.
func (utf8mb4Encoder) NextRune(str string) (rune, int) {
	return utf8.DecodeRuneInString(str)
}

// IsReturnSafe implements the Encoder interface. Since the encoding and decoding functions return their input, they are
// not safe to freely modify, and must be copied to preserve the original slice.
func (utf8mb4Encoder) IsReturnSafe() bool {
	return false
}
