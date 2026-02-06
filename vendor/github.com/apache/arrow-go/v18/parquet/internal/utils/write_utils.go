// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import "io"

// WriterTell is an interface that adds a Tell function to an io.Writer
type WriterTell interface {
	io.Writer
	Tell() int64
}

// WriteCloserTell is an interface adding a Tell function to a WriteCloser
// so if the underlying writer has a Close function, it is exposed and not
// hidden.
type WriteCloserTell interface {
	io.WriteCloser
	Tell() int64
}

// TellWrapper wraps any io.Writer to add a Tell function that tracks
// the position based on calls to Write. It does not take into account
// any calls to Seek or any Writes that don't go through the TellWrapper
type TellWrapper struct {
	io.Writer
	pos int64
}

// Close makes TellWrapper an io.Closer so that calling Close
// will also call Close on the wrapped writer if it has a Close function.
func (w *TellWrapper) Close() error {
	if closer, ok := w.Writer.(io.WriteCloser); ok {
		return closer.Close()
	}
	return nil
}

func (w *TellWrapper) Tell() int64 { return w.pos }
func (w *TellWrapper) Write(p []byte) (n int, err error) {
	n, err = w.Writer.Write(p)
	w.pos += int64(n)
	return
}
