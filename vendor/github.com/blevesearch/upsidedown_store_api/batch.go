//  Copyright (c) 2014 Couchbase, Inc.
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

package store

type op struct {
	K []byte
	V []byte
}

type EmulatedBatch struct {
	Ops    []*op
	Merger *EmulatedMerge
}

func NewEmulatedBatch(mo MergeOperator) *EmulatedBatch {
	return &EmulatedBatch{
		Ops:    make([]*op, 0, 1000),
		Merger: NewEmulatedMerge(mo),
	}
}

func (b *EmulatedBatch) Set(key, val []byte) {
	ck := make([]byte, len(key))
	copy(ck, key)
	cv := make([]byte, len(val))
	copy(cv, val)
	b.Ops = append(b.Ops, &op{ck, cv})
}

func (b *EmulatedBatch) Delete(key []byte) {
	ck := make([]byte, len(key))
	copy(ck, key)
	b.Ops = append(b.Ops, &op{ck, nil})
}

func (b *EmulatedBatch) Merge(key, val []byte) {
	ck := make([]byte, len(key))
	copy(ck, key)
	cv := make([]byte, len(val))
	copy(cv, val)
	b.Merger.Merge(key, val)
}

func (b *EmulatedBatch) Reset() {
	b.Ops = b.Ops[:0]
}

func (b *EmulatedBatch) Close() error {
	return nil
}
