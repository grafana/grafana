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

import segment "github.com/blugelabs/bluge_segment_api"

type Batch struct {
	documents         []segment.Document
	ids               []segment.Term
	persistedCallback func(error)
}

func NewBatch() *Batch {
	return &Batch{}
}

func (b *Batch) Insert(doc segment.Document) {
	b.documents = append(b.documents, doc)
}

func (b *Batch) Update(id segment.Term, doc segment.Document) {
	b.documents = append(b.documents, doc)
	b.ids = append(b.ids, id)
}

func (b *Batch) Delete(id segment.Term) {
	b.ids = append(b.ids, id)
}

func (b *Batch) Reset() {
	b.documents = b.documents[:0]
	b.ids = b.ids[:0]
	b.persistedCallback = nil
}

func (b *Batch) SetPersistedCallback(f func(error)) {
	b.persistedCallback = f
}

func (b *Batch) PersistedCallback() func(error) {
	return b.persistedCallback
}
