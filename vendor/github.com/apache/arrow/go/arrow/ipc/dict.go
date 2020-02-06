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

package ipc // import "github.com/apache/arrow/go/arrow/ipc"

import (
	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/array"
	"github.com/pkg/errors"
)

type dictMap map[int64]array.Interface
type dictTypeMap map[int64]arrow.Field

type dictMemo struct {
	dict2id map[array.Interface]int64
	id2dict dictMap // map of dictionary ID to dictionary array
}

func newMemo() dictMemo {
	return dictMemo{
		dict2id: make(map[array.Interface]int64),
		id2dict: make(dictMap),
	}
}

func (memo *dictMemo) Len() int { return len(memo.id2dict) }

func (memo *dictMemo) delete() {
	for id, v := range memo.id2dict {
		delete(memo.id2dict, id)
		delete(memo.dict2id, v)
		v.Release()
	}
}

func (memo dictMemo) Dict(id int64) (array.Interface, bool) {
	v, ok := memo.id2dict[id]
	return v, ok
}

func (memo *dictMemo) ID(v array.Interface) int64 {
	id, ok := memo.dict2id[v]
	if ok {
		return id
	}

	v.Retain()
	id = int64(len(memo.dict2id))
	memo.dict2id[v] = id
	memo.id2dict[id] = v
	return id
}

func (memo dictMemo) HasDict(v array.Interface) bool {
	_, ok := memo.dict2id[v]
	return ok
}

func (memo dictMemo) HasID(id int64) bool {
	_, ok := memo.id2dict[id]
	return ok
}

func (memo *dictMemo) Add(id int64, v array.Interface) {
	if _, dup := memo.id2dict[id]; dup {
		panic(errors.Errorf("arrow/ipc: duplicate id=%d", id))
	}
	v.Retain()
	memo.id2dict[id] = v
	memo.dict2id[v] = id
}
