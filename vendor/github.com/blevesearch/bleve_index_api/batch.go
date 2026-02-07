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

import "fmt"

type BatchCallback func(error)

type Batch struct {
	IndexOps          map[string]Document
	InternalOps       map[string][]byte
	persistedCallback BatchCallback
}

func NewBatch() *Batch {
	return &Batch{
		IndexOps:    make(map[string]Document),
		InternalOps: make(map[string][]byte),
	}
}

func (b *Batch) Update(doc Document) {
	b.IndexOps[doc.ID()] = doc
}

func (b *Batch) Delete(id string) {
	b.IndexOps[id] = nil
}

func (b *Batch) SetInternal(key, val []byte) {
	b.InternalOps[string(key)] = val
}

func (b *Batch) DeleteInternal(key []byte) {
	b.InternalOps[string(key)] = nil
}

func (b *Batch) SetPersistedCallback(f BatchCallback) {
	b.persistedCallback = f
}

func (b *Batch) PersistedCallback() BatchCallback {
	return b.persistedCallback
}

func (b *Batch) String() string {
	rv := fmt.Sprintf("Batch (%d ops, %d internal ops)\n", len(b.IndexOps), len(b.InternalOps))
	for k, v := range b.IndexOps {
		if v != nil {
			rv += fmt.Sprintf("\tINDEX - '%s'\n", k)
		} else {
			rv += fmt.Sprintf("\tDELETE - '%s'\n", k)
		}
	}
	for k, v := range b.InternalOps {
		if v != nil {
			rv += fmt.Sprintf("\tSET INTERNAL - '%s'\n", k)
		} else {
			rv += fmt.Sprintf("\tDELETE INTERNAL - '%s'\n", k)
		}
	}
	return rv
}

func (b *Batch) Reset() {
	b.IndexOps = make(map[string]Document)
	b.InternalOps = make(map[string][]byte)
	b.persistedCallback = nil
}

func (b *Batch) Merge(o *Batch) {
	for k, v := range o.IndexOps {
		b.IndexOps[k] = v
	}
	for k, v := range o.InternalOps {
		b.InternalOps[k] = v
	}
}

func (b *Batch) TotalDocSize() int {
	var s int
	for k, v := range b.IndexOps {
		if v != nil {
			s += v.Size() + sizeOfString
		}
		s += len(k)
	}
	return s
}
