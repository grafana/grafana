//  Copyright (c) 2020 The Bluge Authors.
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
	"bytes"
	"fmt"
	"io"
	"sort"
	"sync"

	segment "github.com/blugelabs/bluge_segment_api"
)

type InMemoryDirectory struct {
	segLock  sync.RWMutex
	segments map[uint64]*bytes.Buffer
}

func NewInMemoryDirectory() *InMemoryDirectory {
	return &InMemoryDirectory{
		segLock:  sync.RWMutex{},
		segments: make(map[uint64]*bytes.Buffer),
	}
}

func (d *InMemoryDirectory) Setup(readOnly bool) error {
	return nil
}

func (d *InMemoryDirectory) List(kind string) ([]uint64, error) {
	d.segLock.RLock()
	defer d.segLock.RUnlock()
	var rv uint64Slice
	if kind == ItemKindSegment {
		for id := range d.segments {
			rv = append(rv, id)
		}
	}

	sort.Sort(sort.Reverse(rv))
	return rv, nil
}

func (d *InMemoryDirectory) Load(kind string, id uint64) (*segment.Data, io.Closer, error) {
	d.segLock.RLock()
	defer d.segLock.RUnlock()
	if kind == ItemKindSegment {
		if buf, ok := d.segments[id]; ok {
			return segment.NewDataBytes(buf.Bytes()), nil, nil
		}
		return nil, nil, fmt.Errorf("segment %d not found", id)
	}

	return nil, nil, nil
}

func (d *InMemoryDirectory) Persist(kind string, id uint64, w WriterTo, closeCh chan struct{}) error {
	d.segLock.Lock()
	defer d.segLock.Unlock()
	if kind == ItemKindSegment {
		var buf bytes.Buffer
		_, err := w.WriteTo(&buf, closeCh)
		if err != nil {
			return err
		}
		d.segments[id] = &buf
	}
	return nil
}

func (d *InMemoryDirectory) Remove(kind string, id uint64) error {
	d.segLock.Lock()
	defer d.segLock.Unlock()
	if kind == ItemKindSegment {
		delete(d.segments, id)
	}
	return nil
}

func (d *InMemoryDirectory) Stats() (numItems, numBytes uint64) {
	return 0, 0
}

func (d *InMemoryDirectory) Sync() error {
	return nil
}

func (d *InMemoryDirectory) Lock() error {
	return nil
}

func (d *InMemoryDirectory) Unlock() error {
	return nil
}
