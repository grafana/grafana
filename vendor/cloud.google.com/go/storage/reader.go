// Copyright 2016 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"fmt"
	"hash/crc32"
	"io"
)

var crc32cTable = crc32.MakeTable(crc32.Castagnoli)

// Reader reads a Cloud Storage object.
// It implements io.Reader.
type Reader struct {
	body            io.ReadCloser
	remain, size    int64
	contentType     string
	contentEncoding string
	cacheControl    string
	checkCRC        bool   // should we check the CRC?
	wantCRC         uint32 // the CRC32c value the server sent in the header
	gotCRC          uint32 // running crc
}

// Close closes the Reader. It must be called when done reading.
func (r *Reader) Close() error {
	return r.body.Close()
}

func (r *Reader) Read(p []byte) (int, error) {
	n, err := r.body.Read(p)
	if r.remain != -1 {
		r.remain -= int64(n)
	}
	if r.checkCRC {
		r.gotCRC = crc32.Update(r.gotCRC, crc32cTable, p[:n])
		// Check CRC here. It would be natural to check it in Close, but
		// everybody defers Close on the assumption that it doesn't return
		// anything worth looking at.
		if r.remain == 0 && r.gotCRC != r.wantCRC {
			return n, fmt.Errorf("storage: bad CRC on read: got %d, want %d",
				r.gotCRC, r.wantCRC)
		}
	}
	return n, err
}

// Size returns the size of the object in bytes.
// The returned value is always the same and is not affected by
// calls to Read or Close.
func (r *Reader) Size() int64 {
	return r.size
}

// Remain returns the number of bytes left to read, or -1 if unknown.
func (r *Reader) Remain() int64 {
	return r.remain
}

// ContentType returns the content type of the object.
func (r *Reader) ContentType() string {
	return r.contentType
}

// ContentEncoding returns the content encoding of the object.
func (r *Reader) ContentEncoding() string {
	return r.contentEncoding
}

// CacheControl returns the cache control of the object.
func (r *Reader) CacheControl() string {
	return r.cacheControl
}
