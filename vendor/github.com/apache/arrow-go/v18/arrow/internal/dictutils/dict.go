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

package dictutils

import (
	"errors"
	"fmt"
	"hash/maphash"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

type Kind int8

const (
	KindNew Kind = iota
	KindDelta
	KindReplacement
)

type FieldPos struct {
	parent       *FieldPos
	index, depth int32
}

func NewFieldPos() FieldPos { return FieldPos{index: -1} }

func (f *FieldPos) Child(index int32) FieldPos {
	return FieldPos{parent: f, index: index, depth: f.depth + 1}
}

func (f *FieldPos) Path() []int32 {
	path := make([]int32, f.depth)
	cur := f
	for i := f.depth - 1; i >= 0; i-- {
		path[i] = int32(cur.index)
		cur = cur.parent
	}
	return path
}

type Mapper struct {
	pathToID map[uint64]int64
	hasher   maphash.Hash
}

func (d *Mapper) NumDicts() int {
	unique := make(map[int64]bool)
	for _, id := range d.pathToID {
		unique[id] = true
	}
	return len(unique)
}

func (d *Mapper) AddField(id int64, fieldPath []int32) error {
	d.hasher.Write(arrow.Int32Traits.CastToBytes(fieldPath))
	defer d.hasher.Reset()

	sum := d.hasher.Sum64()
	if _, ok := d.pathToID[sum]; ok {
		return errors.New("field already mapped to id")
	}

	d.pathToID[sum] = id
	return nil
}

func (d *Mapper) GetFieldID(fieldPath []int32) (int64, error) {
	d.hasher.Write(arrow.Int32Traits.CastToBytes(fieldPath))
	defer d.hasher.Reset()

	id, ok := d.pathToID[d.hasher.Sum64()]
	if !ok {
		return -1, errors.New("arrow/ipc: dictionary field not found")
	}
	return id, nil
}

func (d *Mapper) NumFields() int {
	return len(d.pathToID)
}

func (d *Mapper) InsertPath(pos FieldPos) {
	id := len(d.pathToID)
	d.hasher.Write(arrow.Int32Traits.CastToBytes(pos.Path()))

	d.pathToID[d.hasher.Sum64()] = int64(id)
	d.hasher.Reset()
}

func (d *Mapper) ImportField(pos FieldPos, field arrow.Field) {
	dt := field.Type
	if dt.ID() == arrow.EXTENSION {
		dt = dt.(arrow.ExtensionType).StorageType()
	}

	if dt.ID() == arrow.DICTIONARY {
		d.InsertPath(pos)
		// import nested dicts
		if nested, ok := dt.(*arrow.DictionaryType).ValueType.(arrow.NestedType); ok {
			d.ImportFields(pos, nested.Fields())
		}
		return
	}

	if nested, ok := dt.(arrow.NestedType); ok {
		d.ImportFields(pos, nested.Fields())
	}
}

func (d *Mapper) ImportFields(pos FieldPos, fields []arrow.Field) {
	for i := range fields {
		d.ImportField(pos.Child(int32(i)), fields[i])
	}
}

func (d *Mapper) ImportSchema(schema *arrow.Schema) {
	d.pathToID = make(map[uint64]int64)
	// This code path intentionally avoids calling ImportFields with
	// schema.Fields to avoid allocations.
	pos := NewFieldPos()
	for i := 0; i < schema.NumFields(); i++ {
		d.ImportField(pos.Child(int32(i)), schema.Field(i))
	}
}

func hasUnresolvedNestedDict(data arrow.ArrayData) bool {
	d := data.(*array.Data)
	if d.DataType().ID() == arrow.DICTIONARY {
		if d.Dictionary().(*array.Data) == nil {
			return true
		}
		if hasUnresolvedNestedDict(d.Dictionary()) {
			return true
		}
	}
	for _, c := range d.Children() {
		if hasUnresolvedNestedDict(c) {
			return true
		}
	}
	return false
}

type dictpair struct {
	ID   int64
	Dict arrow.Array
}

type dictCollector struct {
	dictionaries []dictpair
	mapper       *Mapper
}

func (d *dictCollector) visitChildren(pos FieldPos, typ arrow.DataType, arr arrow.Array) error {
	for i, c := range arr.Data().Children() {
		child := array.MakeFromData(c)
		defer child.Release()
		if err := d.visit(pos.Child(int32(i)), child); err != nil {
			return err
		}
	}
	return nil
}

func (d *dictCollector) visit(pos FieldPos, arr arrow.Array) error {
	dt := arr.DataType()
	if dt.ID() == arrow.EXTENSION {
		dt = dt.(arrow.ExtensionType).StorageType()
		arr = arr.(array.ExtensionArray).Storage()
	}

	if dt.ID() == arrow.DICTIONARY {
		dictarr := arr.(*array.Dictionary)
		dict := dictarr.Dictionary()

		// traverse the dictionary to first gather any nested dictionaries
		// so they appear in the output before their respective parents
		dictType := dt.(*arrow.DictionaryType)
		d.visitChildren(pos, dictType.ValueType, dict)

		id, err := d.mapper.GetFieldID(pos.Path())
		if err != nil {
			return err
		}
		dict.Retain()
		d.dictionaries = append(d.dictionaries, dictpair{ID: id, Dict: dict})
		return nil
	}
	return d.visitChildren(pos, dt, arr)
}

func (d *dictCollector) collect(batch arrow.Record) error {
	var (
		pos    = NewFieldPos()
		schema = batch.Schema()
	)
	d.dictionaries = make([]dictpair, 0, d.mapper.NumFields())
	for i := range schema.Fields() {
		if err := d.visit(pos.Child(int32(i)), batch.Column(i)); err != nil {
			return err
		}
	}
	return nil
}

type dictMap map[int64][]arrow.ArrayData
type dictTypeMap map[int64]arrow.DataType

type Memo struct {
	Mapper  Mapper
	dict2id map[arrow.ArrayData]int64

	id2type dictTypeMap
	id2dict dictMap // map of dictionary ID to dictionary array
}

func NewMemo() Memo {
	return Memo{
		dict2id: make(map[arrow.ArrayData]int64),
		id2dict: make(dictMap),
		id2type: make(dictTypeMap),
		Mapper: Mapper{
			pathToID: make(map[uint64]int64),
		},
	}
}

func (memo *Memo) Len() int { return len(memo.id2dict) }

func (memo *Memo) Clear() {
	for id, v := range memo.id2dict {
		delete(memo.id2dict, id)
		for _, d := range v {
			delete(memo.dict2id, d)
			d.Release()
		}
	}
}

func (memo *Memo) reify(id int64, mem memory.Allocator) (arrow.ArrayData, error) {
	v, ok := memo.id2dict[id]
	if !ok {
		return nil, fmt.Errorf("arrow/ipc: no dictionaries found for id=%d", id)
	}

	if len(v) == 1 {
		return v[0], nil
	}

	// there are deltas we need to concatenate them with the first dictionary
	toCombine := make([]arrow.Array, 0, len(v))
	// NOTE: at this point the dictionary data may not be trusted. it needs to
	// be validated as concatenation can crash on invalid or corrupted data.
	for _, data := range v {
		if hasUnresolvedNestedDict(data) {
			return nil, fmt.Errorf("arrow/ipc: delta dict with unresolved nested dictionary not implemented")
		}
		arr := array.MakeFromData(data)
		defer arr.Release()

		toCombine = append(toCombine, arr)
		defer data.Release()
	}

	combined, err := array.Concatenate(toCombine, mem)
	if err != nil {
		return nil, err
	}
	defer combined.Release()
	combined.Data().Retain()

	memo.id2dict[id] = []arrow.ArrayData{combined.Data()}
	return combined.Data(), nil
}

func (memo *Memo) Dict(id int64, mem memory.Allocator) (arrow.ArrayData, error) {
	return memo.reify(id, mem)
}

func (memo *Memo) AddType(id int64, typ arrow.DataType) error {
	if existing, dup := memo.id2type[id]; dup && !arrow.TypeEqual(existing, typ) {
		return fmt.Errorf("arrow/ipc: conflicting dictionary types for id %d", id)
	}

	memo.id2type[id] = typ
	return nil
}

func (memo *Memo) Type(id int64) (arrow.DataType, bool) {
	t, ok := memo.id2type[id]
	return t, ok
}

// func (memo *dictMemo) ID(v arrow.Array) int64 {
// 	id, ok := memo.dict2id[v]
// 	if ok {
// 		return id
// 	}

// 	v.Retain()
// 	id = int64(len(memo.dict2id))
// 	memo.dict2id[v] = id
// 	memo.id2dict[id] = v
// 	return id
// }

func (memo Memo) HasDict(v arrow.ArrayData) bool {
	_, ok := memo.dict2id[v]
	return ok
}

func (memo Memo) HasID(id int64) bool {
	_, ok := memo.id2dict[id]
	return ok
}

func (memo *Memo) Add(id int64, v arrow.ArrayData) {
	if _, dup := memo.id2dict[id]; dup {
		panic(fmt.Errorf("arrow/ipc: duplicate id=%d", id))
	}
	v.Retain()
	memo.id2dict[id] = []arrow.ArrayData{v}
	memo.dict2id[v] = id
}

func (memo *Memo) AddDelta(id int64, v arrow.ArrayData) {
	d, ok := memo.id2dict[id]
	if !ok {
		panic(fmt.Errorf("arrow/ipc: adding delta to non-existing id=%d", id))
	}
	v.Retain()
	memo.id2dict[id] = append(d, v)
}

// AddOrReplace puts the provided dictionary into the memo table. If it
// already exists, then the new data will replace it. Otherwise it is added
// to the memo table.
func (memo *Memo) AddOrReplace(id int64, v arrow.ArrayData) bool {
	d, ok := memo.id2dict[id]
	if ok {
		// replace the dictionary and release any existing ones
		for _, dict := range d {
			dict.Release()
		}
		d[0] = v
		d = d[:1]
	} else {
		d = []arrow.ArrayData{v}
	}
	v.Retain()
	memo.id2dict[id] = d
	return !ok
}

func CollectDictionaries(batch arrow.Record, mapper *Mapper) (out []dictpair, err error) {
	collector := dictCollector{mapper: mapper}
	err = collector.collect(batch)
	out = collector.dictionaries
	return
}

func ResolveFieldDict(memo *Memo, data arrow.ArrayData, pos FieldPos, mem memory.Allocator) error {
	typ := data.DataType()
	if typ.ID() == arrow.EXTENSION {
		typ = typ.(arrow.ExtensionType).StorageType()
	}
	if typ.ID() == arrow.DICTIONARY {
		id, err := memo.Mapper.GetFieldID(pos.Path())
		if err != nil {
			return err
		}
		dictData, err := memo.Dict(id, mem)
		if err != nil {
			return err
		}
		data.(*array.Data).SetDictionary(dictData)
		if err := ResolveFieldDict(memo, dictData, pos, mem); err != nil {
			return err
		}
	}
	return ResolveDictionaries(memo, data.Children(), pos, mem)
}

func ResolveDictionaries(memo *Memo, cols []arrow.ArrayData, parentPos FieldPos, mem memory.Allocator) error {
	for i, c := range cols {
		if c == nil {
			continue
		}
		if err := ResolveFieldDict(memo, c, parentPos.Child(int32(i)), mem); err != nil {
			return err
		}
	}
	return nil
}
