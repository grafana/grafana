//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package shared

import (
	"errors"
)

type bytesWriter []byte

func NewBytesWriter(b []byte) bytesWriter {
	return b
}

func (c bytesWriter) WriteAt(b []byte, off int64) (int, error) {
	if off >= int64(len(c)) || off < 0 {
		return 0, errors.New("offset value is out of range")
	}

	n := copy(c[int(off):], b)
	if n < len(b) {
		return n, errors.New("not enough space for all bytes")
	}

	return n, nil
}
