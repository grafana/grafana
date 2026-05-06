//  Copyright (c) 2015 Couchbase, Inc.
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

package upsidedown

import (
	"sync"
)

type FieldCache struct {
	fieldIndexes   map[string]uint16
	indexFields    []string
	lastFieldIndex int
	mutex          sync.RWMutex
}

func NewFieldCache() *FieldCache {
	return &FieldCache{
		fieldIndexes:   make(map[string]uint16),
		lastFieldIndex: -1,
	}
}

func (f *FieldCache) AddExisting(field string, index uint16) {
	f.mutex.Lock()
	f.addLOCKED(field, index)
	f.mutex.Unlock()
}

func (f *FieldCache) addLOCKED(field string, index uint16) uint16 {
	f.fieldIndexes[field] = index
	if len(f.indexFields) < int(index)+1 {
		prevIndexFields := f.indexFields
		f.indexFields = make([]string, int(index)+16)
		copy(f.indexFields, prevIndexFields)
	}
	f.indexFields[int(index)] = field
	if int(index) > f.lastFieldIndex {
		f.lastFieldIndex = int(index)
	}
	return index
}

// FieldNamed returns the index of the field, and whether or not it existed
// before this call.  if createIfMissing is true, and new field index is assigned
// but the second return value will still be false
func (f *FieldCache) FieldNamed(field string, createIfMissing bool) (uint16, bool) {
	f.mutex.RLock()
	if index, ok := f.fieldIndexes[field]; ok {
		f.mutex.RUnlock()
		return index, true
	} else if !createIfMissing {
		f.mutex.RUnlock()
		return 0, false
	}
	// trade read lock for write lock
	f.mutex.RUnlock()
	f.mutex.Lock()
	// need to check again with write lock
	if index, ok := f.fieldIndexes[field]; ok {
		f.mutex.Unlock()
		return index, true
	}
	// assign next field id
	index := f.addLOCKED(field, uint16(f.lastFieldIndex+1))
	f.mutex.Unlock()
	return index, false
}

func (f *FieldCache) FieldIndexed(index uint16) (field string) {
	f.mutex.RLock()
	if int(index) < len(f.indexFields) {
		field = f.indexFields[int(index)]
	}
	f.mutex.RUnlock()
	return field
}
