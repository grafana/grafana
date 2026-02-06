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

package arrow

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

type (
	NestedType interface {
		DataType

		// Fields method provides a copy of NestedType fields
		// (so it can be safely mutated and will not result in updating the NestedType).
		Fields() []Field
		// NumFields provides the number of fields without allocating.
		NumFields() int
	}

	ListLikeType interface {
		DataType
		Elem() DataType
		ElemField() Field
	}

	VarLenListLikeType interface {
		ListLikeType
	}
)

// ListType describes a nested type in which each array slot contains
// a variable-size sequence of values, all having the same relative type.
type ListType struct {
	elem Field
}

func ListOfField(f Field) *ListType {
	if f.Type == nil {
		panic("arrow: nil type for list field")
	}
	return &ListType{elem: f}
}

// ListOf returns the list type with element type t.
// For example, if t represents int32, ListOf(t) represents []int32.
//
// ListOf panics if t is nil or invalid. NullableElem defaults to true
func ListOf(t DataType) *ListType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	return &ListType{elem: Field{Name: "item", Type: t, Nullable: true}}
}

// ListOfNonNullable is like ListOf but NullableElem defaults to false, indicating
// that the child type should be marked as non-nullable.
func ListOfNonNullable(t DataType) *ListType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	return &ListType{elem: Field{Name: "item", Type: t, Nullable: false}}
}

func (*ListType) ID() Type     { return LIST }
func (*ListType) Name() string { return "list" }

func (t *ListType) String() string {
	if t.elem.Nullable {
		return fmt.Sprintf("list<%s: %s, nullable>", t.elem.Name, t.elem.Type)
	}
	return fmt.Sprintf("list<%s: %s>", t.elem.Name, t.elem.Type)
}

func (t *ListType) Fingerprint() string {
	child := t.elem.Type.Fingerprint()
	if len(child) > 0 {
		return typeFingerprint(t) + "{" + child + "}"
	}
	return ""
}

func (t *ListType) SetElemMetadata(md Metadata) { t.elem.Metadata = md }

func (t *ListType) SetElemNullable(n bool) { t.elem.Nullable = n }

// Elem returns the ListType's element type.
func (t *ListType) Elem() DataType { return t.elem.Type }

func (t *ListType) ElemField() Field {
	return t.elem
}

func (t *ListType) Fields() []Field { return []Field{t.ElemField()} }

func (t *ListType) NumFields() int { return 1 }

func (*ListType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap(), SpecFixedWidth(Int32SizeBytes)}}
}

func (*ListType) OffsetTypeTraits() OffsetTraits { return Int32Traits }

type LargeListType struct {
	ListType
}

func (LargeListType) ID() Type     { return LARGE_LIST }
func (LargeListType) Name() string { return "large_list" }
func (t *LargeListType) String() string {
	return "large_" + t.ListType.String()
}

func (t *LargeListType) Fingerprint() string {
	child := t.elem.Type.Fingerprint()
	if len(child) > 0 {
		return typeFingerprint(t) + "{" + child + "}"
	}
	return ""
}

func (*LargeListType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap(), SpecFixedWidth(Int64SizeBytes)}}
}

func (*LargeListType) OffsetTypeTraits() OffsetTraits { return Int64Traits }

func LargeListOfField(f Field) *LargeListType {
	if f.Type == nil {
		panic("arrow: nil type for list field")
	}
	return &LargeListType{ListType{elem: f}}
}

// LargeListOf returns the list type with element type t.
// For example, if t represents int32, LargeListOf(t) represents []int32.
//
// LargeListOf panics if t is nil or invalid. NullableElem defaults to true
func LargeListOf(t DataType) *LargeListType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	return &LargeListType{ListType{elem: Field{Name: "item", Type: t, Nullable: true}}}
}

// LargeListOfNonNullable is like ListOf but NullableElem defaults to false, indicating
// that the child type should be marked as non-nullable.
func LargeListOfNonNullable(t DataType) *LargeListType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	return &LargeListType{ListType{elem: Field{Name: "item", Type: t, Nullable: false}}}
}

// FixedSizeListType describes a nested type in which each array slot contains
// a fixed-size sequence of values, all having the same relative type.
type FixedSizeListType struct {
	n    int32 // number of elements in the list
	elem Field
}

func FixedSizeListOfField(n int32, f Field) *FixedSizeListType {
	if f.Type == nil {
		panic("arrow: nil DataType")
	}
	if n <= 0 {
		panic("arrow: invalid size")
	}
	return &FixedSizeListType{n: n, elem: f}
}

// FixedSizeListOf returns the list type with element type t.
// For example, if t represents int32, FixedSizeListOf(10, t) represents [10]int32.
//
// FixedSizeListOf panics if t is nil or invalid.
// FixedSizeListOf panics if n is <= 0.
// NullableElem defaults to true
func FixedSizeListOf(n int32, t DataType) *FixedSizeListType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	if n <= 0 {
		panic("arrow: invalid size")
	}
	return &FixedSizeListType{n: n, elem: Field{Name: "item", Type: t, Nullable: true}}
}

// FixedSizeListOfNonNullable is like FixedSizeListOf but NullableElem defaults to false
// indicating that the child type should be marked as non-nullable.
func FixedSizeListOfNonNullable(n int32, t DataType) *FixedSizeListType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	if n <= 0 {
		panic("arrow: invalid size")
	}
	return &FixedSizeListType{n: n, elem: Field{Name: "item", Type: t, Nullable: false}}
}

func (*FixedSizeListType) ID() Type     { return FIXED_SIZE_LIST }
func (*FixedSizeListType) Name() string { return "fixed_size_list" }
func (t *FixedSizeListType) String() string {
	if t.elem.Nullable {
		return fmt.Sprintf("fixed_size_list<%s: %s, nullable>[%d]", t.elem.Name, t.elem.Type, t.n)
	}
	return fmt.Sprintf("fixed_size_list<%s: %s>[%d]", t.elem.Name, t.elem.Type, t.n)
}

func (t *FixedSizeListType) SetElemNullable(n bool) { t.elem.Nullable = n }

// Elem returns the FixedSizeListType's element type.
func (t *FixedSizeListType) Elem() DataType { return t.elem.Type }

// Len returns the FixedSizeListType's size.
func (t *FixedSizeListType) Len() int32 { return t.n }

func (t *FixedSizeListType) ElemField() Field {
	return t.elem
}

func (t *FixedSizeListType) Fingerprint() string {
	child := t.elem.Type.Fingerprint()
	if len(child) > 0 {
		return fmt.Sprintf("%s[%d]{%s}", typeFingerprint(t), t.n, child)
	}
	return ""
}

func (t *FixedSizeListType) Fields() []Field { return []Field{t.ElemField()} }

func (t *FixedSizeListType) NumFields() int { return 1 }

func (*FixedSizeListType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap()}}
}

type ListViewType struct {
	elem Field
}

func ListViewOfField(f Field) *ListViewType {
	if f.Type == nil {
		panic("arrow: nil DataType")
	}
	return &ListViewType{elem: f}
}

// ListViewOf returns the list-view type with element type t.
// For example, if t represents int32, ListViewOf(t) represents []int32.
//
// ListViewOf panics if t is nil or invalid. NullableElem defaults to true
func ListViewOf(t DataType) *ListViewType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	return &ListViewType{elem: Field{Name: "item", Type: t, Nullable: true}}
}

// ListViewOfNonNullable is like ListViewOf but NullableElem defaults to false, indicating
// that the child type should be marked as non-nullable.
func ListViewOfNonNullable(t DataType) *ListViewType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	return &ListViewType{elem: Field{Name: "item", Type: t, Nullable: false}}
}

func (*ListViewType) ID() Type     { return LIST_VIEW }
func (*ListViewType) Name() string { return "list_view" }

func (t *ListViewType) String() string {
	if t.elem.Nullable {
		return fmt.Sprintf("list_view<%s: %s, nullable>", t.elem.Name, t.elem.Type)
	}
	return fmt.Sprintf("list_view<%s: %s>", t.elem.Name, t.elem.Type)
}

func (t *ListViewType) Fingerprint() string {
	child := t.elem.Type.Fingerprint()
	if len(child) > 0 {
		return typeFingerprint(t) + "{" + child + "}"
	}
	return ""
}

func (t *ListViewType) SetElemMetadata(md Metadata) { t.elem.Metadata = md }

func (t *ListViewType) SetElemNullable(n bool) { t.elem.Nullable = n }

// Elem returns the ListViewType's element type.
func (t *ListViewType) Elem() DataType { return t.elem.Type }

func (t *ListViewType) ElemField() Field {
	return t.elem
}

func (t *ListViewType) Fields() []Field { return []Field{t.ElemField()} }

func (t *ListViewType) NumFields() int { return 1 }

func (*ListViewType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap(), SpecFixedWidth(Int32SizeBytes), SpecFixedWidth(Int32SizeBytes)}}
}

func (*ListViewType) OffsetTypeTraits() OffsetTraits { return Int32Traits }

type LargeListViewType struct {
	elem Field
}

func LargeListViewOfField(f Field) *LargeListViewType {
	if f.Type == nil {
		panic("arrow: nil DataType")
	}
	return &LargeListViewType{elem: f}
}

// LargeListViewOf returns the list-view type with element type t.
// For example, if t represents int32, LargeListViewOf(t) represents []int32.
//
// LargeListViewOf panics if t is nil or invalid. NullableElem defaults to true
func LargeListViewOf(t DataType) *LargeListViewType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	return &LargeListViewType{elem: Field{Name: "item", Type: t, Nullable: true}}
}

// LargeListViewOfNonNullable is like LargeListViewOf but NullableElem defaults
// to false, indicating that the child type should be marked as non-nullable.
func LargeListViewOfNonNullable(t DataType) *LargeListViewType {
	if t == nil {
		panic("arrow: nil DataType")
	}
	return &LargeListViewType{elem: Field{Name: "item", Type: t, Nullable: false}}
}

func (*LargeListViewType) ID() Type     { return LARGE_LIST_VIEW }
func (*LargeListViewType) Name() string { return "large_list_view" }

func (t *LargeListViewType) String() string {
	if t.elem.Nullable {
		return fmt.Sprintf("large_list_view<%s: %s, nullable>", t.elem.Name, t.elem.Type)
	}
	return fmt.Sprintf("large_list_view<%s: %s>", t.elem.Name, t.elem.Type)
}

func (t *LargeListViewType) Fingerprint() string {
	child := t.elem.Type.Fingerprint()
	if len(child) > 0 {
		return typeFingerprint(t) + "{" + child + "}"
	}
	return ""
}

func (t *LargeListViewType) SetElemMetadata(md Metadata) { t.elem.Metadata = md }

func (t *LargeListViewType) SetElemNullable(n bool) { t.elem.Nullable = n }

// Elem returns the LargeListViewType's element type.
func (t *LargeListViewType) Elem() DataType { return t.elem.Type }

func (t *LargeListViewType) ElemField() Field {
	return t.elem
}

func (t *LargeListViewType) Fields() []Field { return []Field{t.ElemField()} }

func (t *LargeListViewType) NumFields() int { return 1 }

func (*LargeListViewType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap(), SpecFixedWidth(Int64SizeBytes), SpecFixedWidth(Int64SizeBytes)}}
}

func (*LargeListViewType) OffsetTypeTraits() OffsetTraits { return Int64Traits }

// StructType describes a nested type parameterized by an ordered sequence
// of relative types, called its fields.
type StructType struct {
	fields []Field
	index  map[string][]int
	meta   Metadata
}

// StructOf returns the struct type with fields fs.
//
// StructOf panics if there is a field with an invalid DataType.
func StructOf(fs ...Field) *StructType {
	n := len(fs)
	if n == 0 {
		return &StructType{}
	}

	t := &StructType{
		fields: make([]Field, n),
		index:  make(map[string][]int, n),
	}
	for i, f := range fs {
		if f.Type == nil {
			panic("arrow: field with nil DataType")
		}
		t.fields[i] = Field{
			Name:     f.Name,
			Type:     f.Type,
			Nullable: f.Nullable,
			Metadata: f.Metadata.clone(),
		}
		if indices, exists := t.index[f.Name]; exists {
			t.index[f.Name] = append(indices, i)
		} else {
			t.index[f.Name] = []int{i}
		}
	}

	return t
}

func (*StructType) ID() Type     { return STRUCT }
func (*StructType) Name() string { return "struct" }

func (t *StructType) String() string {
	var o strings.Builder
	o.WriteString("struct<")
	for i, f := range t.fields {
		if i > 0 {
			o.WriteString(", ")
		}
		o.WriteString(fmt.Sprintf("%s: %v", f.Name, f.Type))
	}
	o.WriteString(">")
	return o.String()
}

// Fields method provides a copy of StructType fields
// (so it can be safely mutated and will not result in updating the StructType).
func (t *StructType) Fields() []Field {
	fields := make([]Field, len(t.fields))
	copy(fields, t.fields)
	return fields
}

func (t *StructType) NumFields() int { return len(t.fields) }

func (t *StructType) Field(i int) Field { return t.fields[i] }

// FieldByName gets the field with the given name.
//
// If there are multiple fields with the given name, FieldByName
// returns the first such field.
func (t *StructType) FieldByName(name string) (Field, bool) {
	i, ok := t.index[name]
	if !ok {
		return Field{}, false
	}
	return t.fields[i[0]], true
}

// FieldIdx gets the index of the field with the given name.
//
// If there are multiple fields with the given name, FieldIdx returns
// the index of the first such field.
func (t *StructType) FieldIdx(name string) (int, bool) {
	i, ok := t.index[name]
	if ok {
		return i[0], true
	}
	return -1, false
}

// FieldsByName returns all fields with the given name.
func (t *StructType) FieldsByName(n string) ([]Field, bool) {
	indices, ok := t.index[n]
	if !ok {
		return nil, ok
	}
	fields := make([]Field, 0, len(indices))
	for _, v := range indices {
		fields = append(fields, t.fields[v])
	}
	return fields, ok
}

// FieldIndices returns indices of all fields with the given name, or nil.
func (t *StructType) FieldIndices(name string) []int {
	return t.index[name]
}

func (t *StructType) Fingerprint() string {
	var b strings.Builder
	b.WriteString(typeFingerprint(t))
	b.WriteByte('{')
	for _, c := range t.fields {
		child := c.Fingerprint()
		if len(child) == 0 {
			return ""
		}
		b.WriteString(child)
		b.WriteByte(';')
	}
	b.WriteByte('}')
	return b.String()
}

func (*StructType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecBitmap()}}
}

type MapType struct {
	value      *ListType
	KeysSorted bool
}

func MapOf(key, item DataType) *MapType {
	if key == nil || item == nil {
		panic("arrow: nil key or item type for MapType")
	}

	return &MapType{value: ListOf(StructOf(Field{Name: "key", Type: key}, Field{Name: "value", Type: item, Nullable: true}))}
}

func MapOfFields(key, item Field) *MapType {
	if key.Type == nil || item.Type == nil {
		panic("arrow: nil key or item type for MapType")
	}

	if key.Nullable {
		panic("arrow: key field must be non-nullable")
	}

	key.Name = "key"
	item.Name = "value"
	return &MapType{value: ListOfField(Field{
		Name: "entries",
		Type: StructOf(key, item),
	})}
}

func MapOfWithMetadata(key DataType, keyMetadata Metadata, item DataType, itemMetadata Metadata) *MapType {
	if key == nil || item == nil {
		panic("arrow: nil key or item type for MapType")
	}

	return &MapType{value: ListOf(StructOf(Field{
		Name:     "key",
		Type:     key,
		Metadata: keyMetadata,
	}, Field{
		Name:     "value",
		Type:     item,
		Nullable: true,
		Metadata: itemMetadata,
	}))}
}

func (*MapType) ID() Type     { return MAP }
func (*MapType) Name() string { return "map" }

func (t *MapType) String() string {
	var o strings.Builder
	o.WriteString(fmt.Sprintf("map<%s, %s",
		t.value.Elem().(*StructType).Field(0).Type,
		t.value.Elem().(*StructType).Field(1).Type))
	if t.KeysSorted {
		o.WriteString(", keys_sorted")
	}
	if t.ItemField().Nullable {
		o.WriteString(", items_nullable")
	} else {
		o.WriteString(", items_non_nullable")
	}
	o.WriteString(">")
	return o.String()
}

func (t *MapType) KeyField() Field    { return t.value.Elem().(*StructType).Field(0) }
func (t *MapType) KeyType() DataType  { return t.KeyField().Type }
func (t *MapType) ItemField() Field   { return t.value.Elem().(*StructType).Field(1) }
func (t *MapType) ItemType() DataType { return t.ItemField().Type }

// Deprecated: use MapType.Elem().(*StructType) instead
func (t *MapType) ValueType() *StructType { return t.Elem().(*StructType) }

// Deprecated: use MapType.ElemField() instead
func (t *MapType) ValueField() Field { return t.ElemField() }

// Elem returns the MapType's element type (if treating MapType as ListLikeType)
func (t *MapType) Elem() DataType { return t.value.Elem() }

// ElemField returns the MapType's element field (if treating MapType as ListLikeType)
func (t *MapType) ElemField() Field { return Field{Name: "entries", Type: t.Elem()} }

func (t *MapType) SetItemNullable(nullable bool) {
	t.value.Elem().(*StructType).fields[1].Nullable = nullable
}

func (t *MapType) Fingerprint() string {
	keyFingerprint := t.KeyType().Fingerprint()
	itemFingerprint := t.ItemType().Fingerprint()
	if keyFingerprint == "" || itemFingerprint == "" {
		return ""
	}

	fingerprint := typeFingerprint(t)
	if t.KeysSorted {
		fingerprint += "s"
	}
	return fingerprint + "{" + keyFingerprint + itemFingerprint + "}"
}

func (t *MapType) Fields() []Field { return []Field{t.ElemField()} }

func (t *MapType) NumFields() int { return 1 }

func (t *MapType) Layout() DataTypeLayout {
	return t.value.Layout()
}

func (*MapType) OffsetTypeTraits() OffsetTraits { return Int32Traits }

type (
	// UnionTypeCode is an alias to int8 which is the type of the ids
	// used for union arrays.
	UnionTypeCode = int8
	UnionMode     int8
)

const (
	MaxUnionTypeCode    UnionTypeCode = 127
	InvalidUnionChildID int           = -1

	SparseMode UnionMode = iota // SPARSE
	DenseMode                   // DENSE
)

// UnionType is an interface to encompass both Dense and Sparse Union types.
//
// A UnionType is a nested type where each logical value is taken
// from a single child. A buffer of 8-bit type ids (typed as UnionTypeCode)
// indicates which child a given logical value is to be taken from. This is
// represented as the "child id" or "child index", which is the index into the
// list of child fields for a given child.
type UnionType interface {
	NestedType
	// Mode returns either SparseMode or DenseMode depending on the current
	// concrete data type.
	Mode() UnionMode
	// ChildIDs returns a slice of ints to map UnionTypeCode values to
	// the index in the Fields that represents the given Type. It is
	// initialized with all values being InvalidUnionChildID (-1)
	// before being populated based on the TypeCodes and fields of the type.
	// The field for a given type can be retrieved by Fields()[ChildIDs()[typeCode]]
	ChildIDs() []int
	// TypeCodes returns the list of available type codes for this union type
	// which will correspond to indexes into the ChildIDs slice to locate the
	// appropriate child. A union Array contains a buffer of these type codes
	// which indicate for a given index, which child has the value for that index.
	TypeCodes() []UnionTypeCode
	// MaxTypeCode returns the value of the largest TypeCode in the list of typecodes
	// that are defined by this Union type
	MaxTypeCode() UnionTypeCode
}

// UnionOf returns an appropriate union type for the given Mode (Sparse or Dense),
// child fields, and type codes. len(fields) == len(typeCodes) must be true, or else
// this will panic. len(fields) can be 0.
func UnionOf(mode UnionMode, fields []Field, typeCodes []UnionTypeCode) UnionType {
	switch mode {
	case SparseMode:
		return SparseUnionOf(fields, typeCodes)
	case DenseMode:
		return DenseUnionOf(fields, typeCodes)
	default:
		panic("arrow: invalid union mode")
	}
}

type unionType struct {
	children  []Field
	typeCodes []UnionTypeCode
	childIDs  [int(MaxUnionTypeCode) + 1]int
}

func (t *unionType) init(fields []Field, typeCodes []UnionTypeCode) {
	// initialize all child IDs to -1
	t.childIDs[0] = InvalidUnionChildID
	for i := 1; i < len(t.childIDs); i *= 2 {
		copy(t.childIDs[i:], t.childIDs[:i])
	}

	t.children = fields
	t.typeCodes = typeCodes

	for i, tc := range t.typeCodes {
		t.childIDs[tc] = i
	}
}

// Fields method provides a copy of union type fields
// (so it can be safely mutated and will not result in updating the union type).
func (t *unionType) Fields() []Field {
	fields := make([]Field, len(t.children))
	copy(fields, t.children)
	return fields
}

func (t *unionType) NumFields() int { return len(t.children) }

func (t *unionType) TypeCodes() []UnionTypeCode { return t.typeCodes }
func (t *unionType) ChildIDs() []int            { return t.childIDs[:] }

func (t *unionType) validate(fields []Field, typeCodes []UnionTypeCode, _ UnionMode) error {
	if len(fields) != len(typeCodes) {
		return errors.New("arrow: union types should have the same number of fields as type codes")
	}

	for _, c := range typeCodes {
		if c < 0 || c > MaxUnionTypeCode {
			return errors.New("arrow: union type code out of bounds")
		}
	}
	return nil
}

func (t *unionType) MaxTypeCode() (max UnionTypeCode) {
	if len(t.typeCodes) == 0 {
		return
	}

	max = t.typeCodes[0]
	for _, c := range t.typeCodes[1:] {
		if c > max {
			max = c
		}
	}
	return
}

func (t *unionType) String() string {
	var b strings.Builder
	b.WriteByte('<')
	for i := range t.typeCodes {
		if i != 0 {
			b.WriteString(", ")
		}
		fmt.Fprintf(&b, "%s=%d", t.children[i], t.typeCodes[i])
	}
	b.WriteByte('>')
	return b.String()
}

func (t *unionType) fingerprint() string {
	var b strings.Builder
	for _, c := range t.typeCodes {
		fmt.Fprintf(&b, ":%d", c)
	}
	b.WriteString("]{")
	for _, c := range t.children {
		fingerprint := c.Fingerprint()
		if len(fingerprint) == 0 {
			return ""
		}
		b.WriteString(fingerprint)
		b.WriteByte(';')
	}
	b.WriteByte('}')
	return b.String()
}

func fieldsFromArrays(arrays []Array, names ...string) (ret []Field) {
	ret = make([]Field, len(arrays))
	if len(names) == 0 {
		for i, c := range arrays {
			ret[i] = Field{Name: strconv.Itoa(i), Type: c.DataType(), Nullable: true}
		}
	} else {
		debug.Assert(len(names) == len(arrays), "mismatch of arrays and names")
		for i, c := range arrays {
			ret[i] = Field{Name: names[i], Type: c.DataType(), Nullable: true}
		}
	}
	return
}

// SparseUnionType is the concrete type for Sparse union data.
//
// A sparse union is a nested type where each logical value is taken
// from a single child. A buffer of 8-bit type ids indicates which child
// a given logical value is to be taken from.
//
// In a sparse union, each child array will have the same length as the
// union array itself, regardless of the actual number of union values which
// refer to it.
//
// Unlike most other types, unions do not have a top-level validity bitmap.
type SparseUnionType struct {
	unionType
}

// SparseUnionFromArrays enables creating a union type from a list of Arrays,
// field names, and type codes. len(fields) should be either 0 or equal to len(children).
// len(codes) should also be either 0, or equal to len(children).
//
// If len(fields) == 0, then the fields will be named numerically as "0", "1", "2"...
// and so on. If len(codes) == 0, then the type codes will be constructed as
// [0, 1, 2, ..., n].
func SparseUnionFromArrays(children []Array, fields []string, codes []UnionTypeCode) *SparseUnionType {
	if len(codes) == 0 {
		codes = make([]UnionTypeCode, len(children))
		for i := range children {
			codes[i] = UnionTypeCode(i)
		}
	}
	return SparseUnionOf(fieldsFromArrays(children, fields...), codes)
}

// SparseUnionOf is equivalent to UnionOf(arrow.SparseMode, fields, typeCodes),
// constructing a SparseUnionType from a list of fields and type codes.
//
// If len(fields) != len(typeCodes) this will panic. They are allowed to be
// of length 0.
func SparseUnionOf(fields []Field, typeCodes []UnionTypeCode) *SparseUnionType {
	ret := &SparseUnionType{}
	if err := ret.validate(fields, typeCodes, ret.Mode()); err != nil {
		panic(err)
	}
	ret.init(fields, typeCodes)
	return ret
}

func (SparseUnionType) ID() Type        { return SPARSE_UNION }
func (SparseUnionType) Name() string    { return "sparse_union" }
func (SparseUnionType) Mode() UnionMode { return SparseMode }
func (t *SparseUnionType) Fingerprint() string {
	return typeFingerprint(t) + "[s" + t.fingerprint()
}
func (SparseUnionType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecFixedWidth(Uint8SizeBytes)}}
}
func (t *SparseUnionType) String() string {
	return t.Name() + t.unionType.String()
}

// DenseUnionType is the concrete type for dense union data.
//
// A dense union is a nested type where each logical value is taken from a
// single child, at a specific offset. A buffer of 8-bit type ids (typed
// as UnionTypeCode) indicates which child a given logical value is to be
// taken from and a buffer of 32-bit offsets indicating which physical position
// in the given child array has the logical value for that index.
//
// Unlike a sparse union, a dense union allows encoding only the child values
// which are actually referred to by the union array. This is counterbalanced
// by the additional footprint of the offsets buffer, and the additional
// indirection cost when looking up values.
//
// Unlike most other types, unions don't have a top-level validity bitmap
type DenseUnionType struct {
	unionType
}

// DenseUnionFromArrays enables creating a union type from a list of Arrays,
// field names, and type codes. len(fields) should be either 0 or equal to len(children).
// len(codes) should also be either 0, or equal to len(children).
//
// If len(fields) == 0, then the fields will be named numerically as "0", "1", "2"...
// and so on. If len(codes) == 0, then the type codes will be constructed as
// [0, 1, 2, ..., n].
func DenseUnionFromArrays(children []Array, fields []string, codes []UnionTypeCode) *DenseUnionType {
	if len(codes) == 0 {
		codes = make([]UnionTypeCode, len(children))
		for i := range children {
			codes[i] = UnionTypeCode(i)
		}
	}
	return DenseUnionOf(fieldsFromArrays(children, fields...), codes)
}

// DenseUnionOf is equivalent to UnionOf(arrow.DenseMode, fields, typeCodes),
// constructing a DenseUnionType from a list of fields and type codes.
//
// If len(fields) != len(typeCodes) this will panic. They are allowed to be
// of length 0.
func DenseUnionOf(fields []Field, typeCodes []UnionTypeCode) *DenseUnionType {
	ret := &DenseUnionType{}
	if err := ret.validate(fields, typeCodes, ret.Mode()); err != nil {
		panic(err)
	}
	ret.init(fields, typeCodes)
	return ret
}

func (DenseUnionType) ID() Type        { return DENSE_UNION }
func (DenseUnionType) Name() string    { return "dense_union" }
func (DenseUnionType) Mode() UnionMode { return DenseMode }
func (t *DenseUnionType) Fingerprint() string {
	return typeFingerprint(t) + "[s" + t.fingerprint()
}

func (DenseUnionType) Layout() DataTypeLayout {
	return DataTypeLayout{Buffers: []BufferSpec{SpecFixedWidth(Uint8SizeBytes), SpecFixedWidth(Int32SizeBytes)}}
}

func (DenseUnionType) OffsetTypeTraits() OffsetTraits { return Int32Traits }

func (t *DenseUnionType) String() string {
	return t.Name() + t.unionType.String()
}

type Field struct {
	Name     string   // Field name
	Type     DataType // The field's data type
	Nullable bool     // Fields can be nullable
	Metadata Metadata // The field's metadata, if any
}

func (f Field) Fingerprint() string {
	typeFingerprint := f.Type.Fingerprint()
	if typeFingerprint == "" {
		return ""
	}

	var b strings.Builder
	b.WriteByte('F')
	if f.Nullable {
		b.WriteByte('n')
	} else {
		b.WriteByte('N')
	}
	b.WriteString(f.Name)
	b.WriteByte('{')
	b.WriteString(typeFingerprint)
	b.WriteByte('}')
	return b.String()
}

func (f Field) HasMetadata() bool { return f.Metadata.Len() != 0 }

func (f Field) Equal(o Field) bool {
	switch {
	case f.Name != o.Name:
		return false
	case f.Nullable != o.Nullable:
		return false
	case !TypeEqual(f.Type, o.Type, CheckMetadata()):
		return false
	case !f.Metadata.Equal(o.Metadata):
		return false
	}
	return true
}

func (f Field) String() string {
	var o strings.Builder
	nullable := ""
	if f.Nullable {
		nullable = ", nullable"
	}
	fmt.Fprintf(&o, "%s: type=%v%v", f.Name, f.Type, nullable)
	if f.HasMetadata() {
		fmt.Fprintf(&o, "\n%*.smetadata: %v", len(f.Name)+2, "", f.Metadata)
	}
	return o.String()
}

var (
	_ DataType = (*ListType)(nil)
	_ DataType = (*LargeListType)(nil)
	_ DataType = (*FixedSizeListType)(nil)
	_ DataType = (*StructType)(nil)
	_ DataType = (*MapType)(nil)
	_ DataType = (*DenseUnionType)(nil)
	_ DataType = (*SparseUnionType)(nil)

	_ NestedType = (*ListType)(nil)
	_ NestedType = (*LargeListType)(nil)
	_ NestedType = (*FixedSizeListType)(nil)
	_ NestedType = (*MapType)(nil)
	_ NestedType = (*DenseUnionType)(nil)
	_ NestedType = (*SparseUnionType)(nil)

	_ ListLikeType = (*ListType)(nil)
	_ ListLikeType = (*LargeListType)(nil)
	_ ListLikeType = (*FixedSizeListType)(nil)
	_ ListLikeType = (*MapType)(nil)

	_ VarLenListLikeType = (*ListType)(nil)
	_ VarLenListLikeType = (*LargeListType)(nil)
	_ VarLenListLikeType = (*ListViewType)(nil)
	_ VarLenListLikeType = (*LargeListViewType)(nil)
	_ VarLenListLikeType = (*FixedSizeListType)(nil)
	_ VarLenListLikeType = (*MapType)(nil)
)
