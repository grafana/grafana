/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package bytes2

// Buffer implements a subset of the write portion of
// bytes.Buffer, but more efficiently. This is meant to
// be used in very high QPS operations, especially for
// WriteByte, and without abstracting it as a Writer.
// Function signatures contain errors for compatibility,
// but they do not return errors.
type Buffer struct {
	bytes []byte
}

// NewBuffer is equivalent to bytes.NewBuffer.
func NewBuffer(b []byte) *Buffer {
	return &Buffer{bytes: b}
}

// Write is equivalent to bytes.Buffer.Write.
func (buf *Buffer) Write(b []byte) (int, error) {
	buf.bytes = append(buf.bytes, b...)
	return len(b), nil
}

// WriteString is equivalent to bytes.Buffer.WriteString.
func (buf *Buffer) WriteString(s string) (int, error) {
	buf.bytes = append(buf.bytes, s...)
	return len(s), nil
}

// WriteByte is equivalent to bytes.Buffer.WriteByte.
func (buf *Buffer) WriteByte(b byte) error {
	buf.bytes = append(buf.bytes, b)
	return nil
}

// Bytes is equivalent to bytes.Buffer.Bytes.
func (buf *Buffer) Bytes() []byte {
	return buf.bytes
}

// Strings is equivalent to bytes.Buffer.Strings.
func (buf *Buffer) String() string {
	return string(buf.bytes)
}

// Len is equivalent to bytes.Buffer.Len.
func (buf *Buffer) Len() int {
	return len(buf.bytes)
}
