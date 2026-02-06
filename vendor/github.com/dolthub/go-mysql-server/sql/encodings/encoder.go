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
	"reflect"
	"unsafe"
)

// Encoder is used to transcode from one encoding to another, along with handling uppercase and lowercase conversions.
// Decoding always converts to Go's string encoding, while encoding always converts to the target encoding. Encoding and
// decoding are bidirectional.
type Encoder interface {
	// Decode converts from the encoding represented by this Encoder to Go's string encoding (utf8mb4-equivalent). This is
	// intended for decoding whole strings (that are represented as byte slices), to decode individual codepoints use
	// DecodeRune. Do note that the string parameter is NOT modified in any way. Refer to IsReturnSafe to check if the
	// returned byte slice must be copied before modifications may be made.
	Decode(str []byte) ([]byte, bool)
	// Encode converts from Go's string encoding (utf8mb4-equivalent) to the encoding represented by this Encoder. This is
	// intended for encoding whole strings (that are represented as byte slices), to encode individual codepoints use
	// EncodeRune. Do note that the string parameter is NOT modified in any way. Refer to IsReturnSafe to check if the
	// returned byte slice must be copied before modifications may be made.
	Encode(str []byte) ([]byte, bool)
	// EncodeReplaceUnknown converts from Go's string encoding (utf8mb4-equivalent) to the encoding represented by this Encoder.
	// This is intended for encoding whole strings (that are represented as byte slices), to encode individual codepoints use
	// EncodeRune. Do note that the string parameter is NOT modified in any way. Refer to IsReturnSafe to check if the
	// returned byte slice must be copied before modifications may be made. Unlike the standard Encode function, this will
	// replace unknown sequences with a question mark (?), meaning that all encodings will return a result.
	EncodeReplaceUnknown(str []byte) []byte
	// DecodeRune converts from the encoding represented by this Encoder to Go's rune encoding (utf8mb4-equivalent).
	// Refer to IsReturnSafe to check if the returned byte slice must be copied before modifications may be made.
	DecodeRune(r []byte) ([]byte, bool)
	// EncodeRune converts from Go's rune encoding (utf8mb4-equivalent) to the encoding represented by this Encoder.
	// Refer to IsReturnSafe to check if the returned byte slice must be copied before modifications may be made.
	EncodeRune(r []byte) ([]byte, bool)
	// Uppercase returns a new string with all codepoints converted to their uppercase variants as determined by this
	// Encoder.
	Uppercase(str string) string
	// Lowercase returns a new string with all codepoints converted to their lowercase variants as determined by this
	// Encoder.
	Lowercase(str string) string
	// UppercaseRune returns the uppercase variant of the given rune. If the rune does not have such a variant, then the
	// input rune is returned.
	UppercaseRune(r rune) rune
	// LowercaseRune returns the lowercase variant of the given rune. If the rune does not have such a variant, then the
	// input rune is returned.
	LowercaseRune(r rune) rune
	// NextRune returns the next rune of a string that was decoded by this encoder. This is ONLY intended for sorting
	// both character strings and binary strings from a single code path. All non-binary strings will use
	// utf8.DecodeRuneInString internally, therefore it is recommended that all performance-critical code handles binary
	// strings separately, and uses utf8.DecodeRuneInString without having to go through this interface.
	NextRune(str string) (rune, int)
	// IsReturnSafe returns whether it is safe to modify the byte slices returned by Decode, Encode, DecodeRune, and
	// EncodeRune.
	IsReturnSafe() bool
}

// BytesToString returns the byte slice (representing a valid Go/utf8mb4-encoded string) as a string without allocations.
// After this call is made, no further changes should be made to the byte slice, as strings are supposed to be immutable.
// Alterations could lead to undefined behavior. This properly handles nil and empty byte slices.
func BytesToString(str []byte) string {
	// Empty slices may not allocate a backing array (and nil slices definitely do not), so we have to check first
	if len(str) == 0 {
		return ""
	}
	return *(*string)(unsafe.Pointer(&str))
}

// StringToBytes returns the string as a byte slice without allocations. No changes should be made to the returned byte
// slice, as strings are supposed to be immutable. Alterations could lead to undefined behavior. This is only intended
// to allow strings to be passed to any functions that work on string data as a byte slice, and specifically do not
// modify the byte slice. This properly handles empty strings.
func StringToBytes(str string) []byte {
	// Empty strings may not allocate a backing array, so we have to check first
	if len(str) == 0 {
		// It makes sense to return a non-nil empty byte slice since we're passing in a non-nil (although empty) string
		return []byte{}
	}
	return (*[0x7fff0000]byte)(unsafe.Pointer(
		(*reflect.StringHeader)(unsafe.Pointer(&str)).Data),
	)[:len(str):len(str)]
}
