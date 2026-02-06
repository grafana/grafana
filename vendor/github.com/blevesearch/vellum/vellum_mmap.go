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

// +build !nommap

package vellum

import (
	"os"

	mmap "github.com/blevesearch/mmap-go"
)

type mmapWrapper struct {
	f  *os.File
	mm mmap.MMap
}

func (m *mmapWrapper) Close() (err error) {
	if m.mm != nil {
		err = m.mm.Unmap()
	}
	// try to close file even if unmap failed
	if m.f != nil {
		err2 := m.f.Close()
		if err == nil {
			// try to return first error
			err = err2
		}
	}
	return
}

func open(path string) (*FST, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	mm, err := mmap.Map(f, mmap.RDONLY, 0)
	if err != nil {
		// mmap failed, try to close the file
		_ = f.Close()
		return nil, err
	}
	return new(mm, &mmapWrapper{
		f:  f,
		mm: mm,
	})
}
