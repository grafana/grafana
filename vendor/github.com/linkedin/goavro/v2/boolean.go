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
	"bytes"
	"errors"
	"fmt"
	"io"
)

func booleanNativeFromBinary(buf []byte) (interface{}, []byte, error) {
	if len(buf) < 1 {
		return nil, nil, io.ErrShortBuffer
	}
	var b byte
	b, buf = buf[0], buf[1:]
	switch b {
	case byte(0):
		return false, buf, nil
	case byte(1):
		return true, buf, nil
	default:
		return nil, nil, fmt.Errorf("cannot decode binary boolean: expected: Go byte(0) or byte(1); received: byte(%d)", b)
	}
}

func booleanBinaryFromNative(buf []byte, datum interface{}) ([]byte, error) {
	value, ok := datum.(bool)
	if !ok {
		return nil, fmt.Errorf("cannot encode binary boolean: expected: Go bool; received: %T", datum)
	}
	var b byte
	if value {
		b = 1
	}
	return append(buf, b), nil
}

func booleanNativeFromTextual(buf []byte) (interface{}, []byte, error) {
	if len(buf) < 4 {
		return nil, nil, fmt.Errorf("cannot decode textual boolean: %s", io.ErrShortBuffer)
	}
	if bytes.Equal(buf[:4], []byte("true")) {
		return true, buf[4:], nil
	}
	if len(buf) < 5 {
		return nil, nil, fmt.Errorf("cannot decode textual boolean: %s", io.ErrShortBuffer)
	}
	if bytes.Equal(buf[:5], []byte("false")) {
		return false, buf[5:], nil
	}
	return nil, nil, errors.New("expected false or true")
}

func booleanTextualFromNative(buf []byte, datum interface{}) ([]byte, error) {
	value, ok := datum.(bool)
	if !ok {
		return nil, fmt.Errorf("boolean: expected: Go bool; received: %T", datum)
	}
	if value {
		return append(buf, "true"...), nil
	}
	return append(buf, "false"...), nil
}
