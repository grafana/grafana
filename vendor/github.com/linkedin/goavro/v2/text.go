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
	"unicode"
)

// advanceAndConsume advances to non whitespace and returns an error if the next
// non whitespace byte is not what is expected.
func advanceAndConsume(buf []byte, expected byte) ([]byte, error) {
	var err error
	if buf, err = advanceToNonWhitespace(buf); err != nil {
		return nil, err
	}
	if actual := buf[0]; actual != expected {
		return nil, fmt.Errorf("expected: %q; actual: %q", expected, actual)
	}
	return buf[1:], nil
}

// advanceToNonWhitespace consumes bytes from buf until non-whitespace character
// is found. It returns error when no more bytes remain, because its purpose is
// to scan ahead to the next non-whitespace character.
func advanceToNonWhitespace(buf []byte) ([]byte, error) {
	for i, b := range buf {
		if !unicode.IsSpace(rune(b)) {
			return buf[i:], nil
		}
	}
	return nil, io.ErrShortBuffer
}
