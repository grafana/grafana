// Copyright 2019 The CUE Authors
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

// Package base64 implements base64 encoding as specified by RFC 4648.
package base64

import (
	"encoding/base64"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

// EncodedLen returns the length in bytes of the base64 encoding
// of an input buffer of length n. Encoding needs to be set to null
// as only StdEncoding is supported for now.
func EncodedLen(encoding cue.Value, n int) (int, error) {
	if err := encoding.Null(); err != nil {
		return 0, errors.Wrapf(err, token.NoPos, "base64: unsupported encoding")
	}
	return base64.StdEncoding.EncodedLen(n), nil
}

// DecodedLen returns the maximum length in bytes of the decoded data
// corresponding to n bytes of base64-encoded data. Encoding needs to be set to
// null as only StdEncoding is supported for now.
func DecodedLen(encoding cue.Value, x int) (int, error) {
	if err := encoding.Null(); err != nil {
		return 0, errors.Wrapf(err, token.NoPos, "base64: unsupported encoding")
	}
	return base64.StdEncoding.DecodedLen(x), nil
}

// Encode returns the base64 encoding of src. Encoding needs to be set to null
// as only StdEncoding is supported for now.
func Encode(encoding cue.Value, src []byte) (string, error) {
	if err := encoding.Null(); err != nil {
		return "", errors.Wrapf(err, token.NoPos, "base64: unsupported encoding")
	}
	return base64.StdEncoding.EncodeToString(src), nil
}

// Decode returns the bytes represented by the base64 string s. Encoding needs
// to be set to null as only StdEncoding is supported for now.
func Decode(encoding cue.Value, s string) ([]byte, error) {
	if err := encoding.Null(); err != nil {
		return nil, errors.Wrapf(err, token.NoPos, "base64: unsupported encoding")
	}
	return base64.StdEncoding.DecodeString(s)
}
