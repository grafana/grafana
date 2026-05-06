//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package zap

import (
	"hash/crc32"
	"io"

	segment "github.com/blevesearch/scorch_segment_api/v2"
)

// CountHashWriter is a wrapper around a Writer which counts the number of
// bytes which have been written and computes a crc32 hash
type CountHashWriter struct {
	w   io.Writer
	crc uint32
	n   int
	s   segment.StatsReporter
}

// NewCountHashWriter returns a CountHashWriter which wraps the provided Writer
func NewCountHashWriter(w io.Writer) *CountHashWriter {
	return &CountHashWriter{w: w}
}

func NewCountHashWriterWithStatsReporter(w io.Writer, s segment.StatsReporter) *CountHashWriter {
	return &CountHashWriter{w: w, s: s}
}

// Write writes the provided bytes to the wrapped writer and counts the bytes
func (c *CountHashWriter) Write(b []byte) (int, error) {
	n, err := c.w.Write(b)
	c.crc = crc32.Update(c.crc, crc32.IEEETable, b[:n])
	c.n += n
	if c.s != nil {
		c.s.ReportBytesWritten(uint64(n))
	}
	return n, err
}

// Count returns the number of bytes written
func (c *CountHashWriter) Count() int {
	return c.n
}

// Sum32 returns the CRC-32 hash of the content written to this writer
func (c *CountHashWriter) Sum32() uint32 {
	return c.crc
}
