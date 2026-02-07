//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package shared

import (
	"errors"
	"io"
)

type SectionWriter struct {
	Count    int64
	Offset   int64
	Position int64
	WriterAt io.WriterAt
}

func NewSectionWriter(c io.WriterAt, off int64, count int64) *SectionWriter {
	return &SectionWriter{
		Count:    count,
		Offset:   off,
		WriterAt: c,
	}
}

func (c *SectionWriter) Write(p []byte) (int, error) {
	remaining := c.Count - c.Position

	if remaining <= 0 {
		return 0, errors.New("end of section reached")
	}

	slice := p

	if int64(len(slice)) > remaining {
		slice = slice[:remaining]
	}

	n, err := c.WriterAt.WriteAt(slice, c.Offset+c.Position)
	c.Position += int64(n)
	if err != nil {
		return n, err
	}

	if len(p) > n {
		return n, errors.New("not enough space for all bytes")
	}

	return n, nil
}
