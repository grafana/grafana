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

package vellum

import (
	"bufio"
	"io"
)

// A writer is a buffered writer used by vellum. It counts how many bytes have
// been written and has some convenience methods used for encoding the data.
type writer struct {
	w       *bufio.Writer
	counter int
}

func newWriter(w io.Writer) *writer {
	return &writer{
		w: bufio.NewWriter(w),
	}
}

func (w *writer) Reset(newWriter io.Writer) {
	w.w.Reset(newWriter)
	w.counter = 0
}

func (w *writer) WriteByte(c byte) error {
	err := w.w.WriteByte(c)
	if err != nil {
		return err
	}
	w.counter++
	return nil
}

func (w *writer) Write(p []byte) (int, error) {
	n, err := w.w.Write(p)
	w.counter += n
	return n, err
}

func (w *writer) Flush() error {
	return w.w.Flush()
}

func (w *writer) WritePackedUintIn(v uint64, n int) error {
	for shift := uint(0); shift < uint(n*8); shift += 8 {
		err := w.WriteByte(byte(v >> shift))
		if err != nil {
			return err
		}
	}

	return nil
}

func (w *writer) WritePackedUint(v uint64) error {
	n := packedSize(v)
	return w.WritePackedUintIn(v, n)
}

func packedSize(n uint64) int {
	if n < 1<<8 {
		return 1
	} else if n < 1<<16 {
		return 2
	} else if n < 1<<24 {
		return 3
	} else if n < 1<<32 {
		return 4
	} else if n < 1<<40 {
		return 5
	} else if n < 1<<48 {
		return 6
	} else if n < 1<<56 {
		return 7
	}
	return 8
}
