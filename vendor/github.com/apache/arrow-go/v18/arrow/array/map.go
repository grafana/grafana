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

package array

import (
	"bytes"
	"fmt"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// Map represents an immutable sequence of Key/Value structs. It is a
// logical type that is implemented as a List<Struct: key, value>.
type Map struct {
	*List
	keys, items arrow.Array
}

var _ ListLike = (*Map)(nil)

// NewMapData returns a new Map array value, from data
func NewMapData(data arrow.ArrayData) *Map {
	a := &Map{List: &List{}}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

// KeysSorted checks the datatype that was used to construct this array and
// returns the KeysSorted boolean value used to denote if the key array is
// sorted for each list element.
//
// Important note: Nothing is enforced regarding the KeysSorted value, it is
// solely a metadata field that should be set if keys within each value are sorted.
// This value is not used at all in regards to comparisons / equality.
func (a *Map) KeysSorted() bool { return a.DataType().(*arrow.MapType).KeysSorted }

func (a *Map) validateData(data *Data) {
	if len(data.childData) != 1 || data.childData[0] == nil {
		panic("arrow/array: expected one child array for map array")
	}

	if data.childData[0].DataType().ID() != arrow.STRUCT {
		panic("arrow/array: map array child should be struct type")
	}

	if data.childData[0].NullN() != 0 {
		panic("arrow/array: map array child array should have no nulls")
	}

	if len(data.childData[0].Children()) != 2 {
		panic("arrow/array: map array child array should have two fields")
	}

	if data.childData[0].Children()[0].NullN() != 0 {
		panic("arrow/array: map array keys array should have no nulls")
	}
}

func (a *Map) setData(data *Data) {
	a.validateData(data)

	a.List.setData(data)
	a.keys = MakeFromData(data.childData[0].Children()[0])
	a.items = MakeFromData(data.childData[0].Children()[1])
}

// Keys returns the full Array of Key values, equivalent to grabbing
// the key field of the child struct.
func (a *Map) Keys() arrow.Array { return a.keys }

// Items returns the full Array of Item values, equivalent to grabbing
// the Value field (the second field) of the child struct.
func (a *Map) Items() arrow.Array { return a.items }

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (a *Map) Retain() {
	a.List.Retain()
	a.keys.Retain()
	a.items.Retain()
}

// Release decreases the reference count by 1.
// Release may be called simultaneously from multiple goroutines.
// When the reference count goes to zero, the memory is freed.
func (a *Map) Release() {
	a.List.Release()
	a.keys.Release()
	a.items.Release()
}

func arrayEqualMap(left, right *Map) bool {
	// since Map is implemented using a list, we can just use arrayEqualList
	return arrayEqualList(left.List, right.List)
}

type MapBuilder struct {
	listBuilder *ListBuilder

	etype                   *arrow.MapType
	keytype, itemtype       arrow.DataType
	keyBuilder, itemBuilder Builder
	keysSorted              bool
}

// NewMapBuilder returns a builder, using the provided memory allocator.
// The created Map builder will create a map array whose keys will be a non-nullable
// array of type `keytype` and whose mapped items will be a nullable array of itemtype.
//
// KeysSorted is not enforced at all by the builder, it should only be set to true
// building using keys in sorted order for each value. The KeysSorted value will just be
// used when creating the DataType for the map.
//
// # Example
//
// Simple example provided of converting a []map[string]int32 to an array.Map
// by using a MapBuilder:
//
//	/* assume maplist == []map[string]int32 */
//	bldr := array.NewMapBuilder(memory.DefaultAllocator, arrow.BinaryTypes.String, arrow.PrimitiveTypes.Int32, false)
//	defer bldr.Release()
//	kb := bldr.KeyBuilder().(*array.StringBuilder)
//	ib := bldr.ItemBuilder().(*array.Int32Builder)
//	for _, m := range maplist {
//	    bldr.Append(true)
//	    for k, v := range m {
//	         kb.Append(k)
//	         ib.Append(v)
//	    }
//	}
//	maparr := bldr.NewMapArray()
//	defer maparr.Release()
func NewMapBuilder(mem memory.Allocator, keytype, itemtype arrow.DataType, keysSorted bool) *MapBuilder {
	etype := arrow.MapOf(keytype, itemtype)
	etype.KeysSorted = keysSorted
	listBldr := NewListBuilder(mem, etype.Elem())
	keyBldr := listBldr.ValueBuilder().(*StructBuilder).FieldBuilder(0)
	keyBldr.Retain()
	itemBldr := listBldr.ValueBuilder().(*StructBuilder).FieldBuilder(1)
	itemBldr.Retain()
	return &MapBuilder{
		listBuilder: listBldr,
		keyBuilder:  keyBldr,
		itemBuilder: itemBldr,
		etype:       etype,
		keytype:     keytype,
		itemtype:    itemtype,
		keysSorted:  keysSorted,
	}
}

func NewMapBuilderWithType(mem memory.Allocator, dt *arrow.MapType) *MapBuilder {
	listBldr := NewListBuilder(mem, dt.Elem())
	keyBldr := listBldr.ValueBuilder().(*StructBuilder).FieldBuilder(0)
	keyBldr.Retain()
	itemBldr := listBldr.ValueBuilder().(*StructBuilder).FieldBuilder(1)
	itemBldr.Retain()
	return &MapBuilder{
		listBuilder: listBldr,
		keyBuilder:  keyBldr,
		itemBuilder: itemBldr,
		etype:       dt,
		keytype:     dt.KeyType(),
		itemtype:    dt.ItemType(),
		keysSorted:  dt.KeysSorted,
	}
}

func (b *MapBuilder) Type() arrow.DataType { return b.etype }

// Retain increases the reference count by 1 for the sub-builders (list, key, item).
// Retain may be called simultaneously from multiple goroutines.
func (b *MapBuilder) Retain() {
	b.listBuilder.Retain()
	b.keyBuilder.Retain()
	b.itemBuilder.Retain()
}

// Release decreases the reference count by 1 for the sub builders (list, key, item).
func (b *MapBuilder) Release() {
	b.listBuilder.Release()
	b.keyBuilder.Release()
	b.itemBuilder.Release()
}

// Len returns the current number of Maps that are in the builder
func (b *MapBuilder) Len() int { return b.listBuilder.Len() }

// Cap returns the total number of elements that can be stored
// without allocating additional memory.
func (b *MapBuilder) Cap() int { return b.listBuilder.Cap() }

// NullN returns the number of null values in the array builder.
func (b *MapBuilder) NullN() int { return b.listBuilder.NullN() }

// IsNull returns if a previously appended value at a given index is null or not.
func (b *MapBuilder) IsNull(i int) bool {
	return b.listBuilder.IsNull(i)
}

// Append adds a new Map element to the array, calling Append(false) is
// equivalent to calling AppendNull.
func (b *MapBuilder) Append(v bool) {
	b.adjustStructBuilderLen()
	b.listBuilder.Append(v)
}

func (b *MapBuilder) AppendWithSize(v bool, _ int) {
	b.Append(v)
}

// AppendNull adds a null map entry to the array.
func (b *MapBuilder) AppendNull() {
	b.Append(false)
}

// AppendNulls adds null map entry to the array.
func (b *MapBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *MapBuilder) SetNull(i int) {
	b.listBuilder.SetNull(i)
}

func (b *MapBuilder) AppendEmptyValue() {
	b.Append(true)
}

func (b *MapBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

// Reserve enough space for n maps
func (b *MapBuilder) Reserve(n int) { b.listBuilder.Reserve(n) }

// Resize adjust the space allocated by b to n map elements. If n is greater than
// b.Cap(), additional memory will be allocated. If n is smaller, the allocated memory may be reduced.
func (b *MapBuilder) Resize(n int) { b.listBuilder.Resize(n) }

// AppendValues is for bulk appending a group of elements with offsets provided
// and validity booleans provided.
func (b *MapBuilder) AppendValues(offsets []int32, valid []bool) {
	b.adjustStructBuilderLen()
	b.listBuilder.AppendValues(offsets, valid)
}

func (b *MapBuilder) UnsafeAppendBoolToBitmap(v bool) {
	b.listBuilder.UnsafeAppendBoolToBitmap(v)
}

func (b *MapBuilder) init(capacity int)                  { b.listBuilder.init(capacity) }
func (b *MapBuilder) resize(newBits int, init func(int)) { b.listBuilder.resize(newBits, init) }

func (b *MapBuilder) adjustStructBuilderLen() {
	sb := b.listBuilder.ValueBuilder().(*StructBuilder)
	if sb.Len() < b.keyBuilder.Len() {
		valids := make([]bool, b.keyBuilder.Len()-sb.Len())
		for i := range valids {
			valids[i] = true
		}
		sb.AppendValues(valids)
	}
}

// NewArray creates a new Map array from the memory buffers used by the builder, and
// resets the builder so it can be used again to build a new Map array.
func (b *MapBuilder) NewArray() arrow.Array {
	return b.NewMapArray()
}

// NewMapArray creates a new Map array from the memory buffers used by the builder, and
// resets the builder so it can be used again to build a new Map array.
func (b *MapBuilder) NewMapArray() (a *Map) {
	if !b.etype.ItemField().Nullable && b.ItemBuilder().NullN() > 0 {
		panic("arrow/array: item not nullable")
	}

	data := b.newData()
	defer data.Release()
	a = NewMapData(data)
	return
}

func (b *MapBuilder) newData() (data *Data) {
	b.adjustStructBuilderLen()
	values := b.listBuilder.NewListArray()
	defer values.Release()

	data = NewData(b.etype,
		values.Len(), values.data.buffers,
		values.data.childData, values.NullN(), 0)
	return
}

// KeyBuilder returns a builder that can be used to populate the keys of the maps.
func (b *MapBuilder) KeyBuilder() Builder { return b.keyBuilder }

// ItemBuilder returns a builder that can be used to populate the values that the
// keys point to.
func (b *MapBuilder) ItemBuilder() Builder { return b.itemBuilder }

// ValueBuilder can be used instead of separately using the Key/Item builders
// to build the list as a List of Structs rather than building the keys/items
// separately.
func (b *MapBuilder) ValueBuilder() Builder {
	return b.listBuilder.ValueBuilder()
}

func (b *MapBuilder) AppendValueFromString(s string) error {
	return b.listBuilder.AppendValueFromString(s)
}

func (b *MapBuilder) UnmarshalOne(dec *json.Decoder) error {
	return b.listBuilder.UnmarshalOne(dec)
}

func (b *MapBuilder) Unmarshal(dec *json.Decoder) error {
	return b.listBuilder.Unmarshal(dec)
}

func (b *MapBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("map builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

var (
	_ arrow.Array     = (*Map)(nil)
	_ Builder         = (*MapBuilder)(nil)
	_ ListLikeBuilder = (*MapBuilder)(nil)
)
