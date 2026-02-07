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

//go:build !windows
// +build !windows

package file

import (
	"io"

	"github.com/apache/arrow-go/v18/parquet"
	"golang.org/x/exp/mmap"
	"golang.org/x/xerrors"
)

func mmapOpen(filename string) (parquet.ReaderAtSeeker, error) {
	rdr, err := mmap.Open(filename)
	if err != nil {
		return nil, err
	}
	return &mmapAdapter{rdr, 0}, nil
}

// an adapter for mmap'd files
type mmapAdapter struct {
	*mmap.ReaderAt

	pos int64
}

func (m *mmapAdapter) Close() error {
	return m.ReaderAt.Close()
}

func (m *mmapAdapter) ReadAt(p []byte, off int64) (int, error) {
	return m.ReaderAt.ReadAt(p, off)
}

func (m *mmapAdapter) Read(p []byte) (n int, err error) {
	n, err = m.ReaderAt.ReadAt(p, m.pos)
	m.pos += int64(n)
	return
}

func (m *mmapAdapter) Seek(offset int64, whence int) (int64, error) {
	newPos, offs := int64(0), offset
	switch whence {
	case io.SeekStart:
		newPos = offs
	case io.SeekCurrent:
		newPos = m.pos + offs
	case io.SeekEnd:
		newPos = int64(m.Len()) + offs
	}
	if newPos < 0 {
		return 0, xerrors.New("negative result pos")
	}
	if newPos > int64(m.Len()) {
		return 0, xerrors.New("new position exceeds size of file")
	}
	m.pos = newPos
	return newPos, nil
}
