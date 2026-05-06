//  Copyright (c) 2020 Couchbase, Inc.
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

package index

import (
	"hash/crc32"
	"io"
)

// countHashWriter is a wrapper around a Writer which counts the number of
// bytes which have been written and computes a crc32 hash
type countHashWriter struct {
	w   io.Writer
	crc uint32
	n   int
}

// newCountHashWriter returns a countHashWriter which wraps the provided Writer
func newCountHashWriter(w io.Writer) *countHashWriter {
	return &countHashWriter{w: w}
}

// Write writes the provided bytes to the wrapped writer,
// counts the bytes and updates the hash
func (c *countHashWriter) Write(b []byte) (int, error) {
	n, err := c.w.Write(b)
	c.crc = crc32.Update(c.crc, crc32.IEEETable, b[:n])
	c.n += n
	return n, err
}

// Count returns the number of bytes written
func (c *countHashWriter) Count() int {
	return c.n
}

// Sum32 returns the CRC-32 hash of the content written to this writer
func (c *countHashWriter) Sum32() uint32 {
	return c.crc
}

// countHashWriter is a wrapper around a Reader which counts the number of
// bytes which have been read and computes a crc32 hash
type countHashReader struct {
	r   io.Reader
	crc uint32
	n   int
}

// newCountHashReader returns a countHashReader which wraps the provided Reader
func newCountHashReader(r io.Reader) *countHashReader {
	return &countHashReader{r: r}
}

// Read reads from the wrapped reader, counts the bytes and updates the hash
func (c *countHashReader) Read(p []byte) (n int, err error) {
	n, err = c.r.Read(p)
	c.n += n
	c.crc = crc32.Update(c.crc, crc32.IEEETable, p[:n])
	return n, err
}

// Count returns the number of bytes written
func (c *countHashReader) Count() int {
	return c.n
}

// Sum32 returns the CRC-32 hash of the content written to this writer
func (c *countHashReader) Sum32() uint32 {
	return c.crc
}
