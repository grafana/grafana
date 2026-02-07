// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncore

import (
	"strconv"

	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ArrayBuilder builds a bson array
type ArrayBuilder struct {
	arr     []byte
	indexes []int32
	keys    []int
}

// NewArrayBuilder creates a new ArrayBuilder
func NewArrayBuilder() *ArrayBuilder {
	return (&ArrayBuilder{}).startArray()
}

// startArray reserves the array's length and sets the index to where the length begins
func (a *ArrayBuilder) startArray() *ArrayBuilder {
	var index int32
	index, a.arr = AppendArrayStart(a.arr)
	a.indexes = append(a.indexes, index)
	a.keys = append(a.keys, 0)
	return a
}

// Build updates the length of the array and index to the beginning of the documents length
// bytes, then returns the array (bson bytes)
func (a *ArrayBuilder) Build() Array {
	lastIndex := len(a.indexes) - 1
	lastKey := len(a.keys) - 1
	a.arr, _ = AppendArrayEnd(a.arr, a.indexes[lastIndex])
	a.indexes = a.indexes[:lastIndex]
	a.keys = a.keys[:lastKey]
	return a.arr
}

// incrementKey() increments the value keys and returns the key to be used to a.appendArray* functions
func (a *ArrayBuilder) incrementKey() string {
	idx := len(a.keys) - 1
	key := strconv.Itoa(a.keys[idx])
	a.keys[idx]++
	return key
}

// AppendInt32 will append i32 to ArrayBuilder.arr
func (a *ArrayBuilder) AppendInt32(i32 int32) *ArrayBuilder {
	a.arr = AppendInt32Element(a.arr, a.incrementKey(), i32)
	return a
}

// AppendDocument will append doc to ArrayBuilder.arr
func (a *ArrayBuilder) AppendDocument(doc []byte) *ArrayBuilder {
	a.arr = AppendDocumentElement(a.arr, a.incrementKey(), doc)
	return a
}

// AppendArray will append arr to ArrayBuilder.arr
func (a *ArrayBuilder) AppendArray(arr []byte) *ArrayBuilder {
	a.arr = AppendArrayElement(a.arr, a.incrementKey(), arr)
	return a
}

// AppendDouble will append f to ArrayBuilder.doc
func (a *ArrayBuilder) AppendDouble(f float64) *ArrayBuilder {
	a.arr = AppendDoubleElement(a.arr, a.incrementKey(), f)
	return a
}

// AppendString will append str to ArrayBuilder.doc
func (a *ArrayBuilder) AppendString(str string) *ArrayBuilder {
	a.arr = AppendStringElement(a.arr, a.incrementKey(), str)
	return a
}

// AppendObjectID will append oid to ArrayBuilder.doc
func (a *ArrayBuilder) AppendObjectID(oid primitive.ObjectID) *ArrayBuilder {
	a.arr = AppendObjectIDElement(a.arr, a.incrementKey(), oid)
	return a
}

// AppendBinary will append a BSON binary element using subtype, and
// b to a.arr
func (a *ArrayBuilder) AppendBinary(subtype byte, b []byte) *ArrayBuilder {
	a.arr = AppendBinaryElement(a.arr, a.incrementKey(), subtype, b)
	return a
}

// AppendUndefined will append a BSON undefined element using key to a.arr
func (a *ArrayBuilder) AppendUndefined() *ArrayBuilder {
	a.arr = AppendUndefinedElement(a.arr, a.incrementKey())
	return a
}

// AppendBoolean will append a boolean element using b to a.arr
func (a *ArrayBuilder) AppendBoolean(b bool) *ArrayBuilder {
	a.arr = AppendBooleanElement(a.arr, a.incrementKey(), b)
	return a
}

// AppendDateTime will append datetime element dt to a.arr
func (a *ArrayBuilder) AppendDateTime(dt int64) *ArrayBuilder {
	a.arr = AppendDateTimeElement(a.arr, a.incrementKey(), dt)
	return a
}

// AppendNull will append a null element to a.arr
func (a *ArrayBuilder) AppendNull() *ArrayBuilder {
	a.arr = AppendNullElement(a.arr, a.incrementKey())
	return a
}

// AppendRegex will append pattern and options to a.arr
func (a *ArrayBuilder) AppendRegex(pattern, options string) *ArrayBuilder {
	a.arr = AppendRegexElement(a.arr, a.incrementKey(), pattern, options)
	return a
}

// AppendDBPointer will append ns and oid to a.arr
func (a *ArrayBuilder) AppendDBPointer(ns string, oid primitive.ObjectID) *ArrayBuilder {
	a.arr = AppendDBPointerElement(a.arr, a.incrementKey(), ns, oid)
	return a
}

// AppendJavaScript will append js to a.arr
func (a *ArrayBuilder) AppendJavaScript(js string) *ArrayBuilder {
	a.arr = AppendJavaScriptElement(a.arr, a.incrementKey(), js)
	return a
}

// AppendSymbol will append symbol to a.arr
func (a *ArrayBuilder) AppendSymbol(symbol string) *ArrayBuilder {
	a.arr = AppendSymbolElement(a.arr, a.incrementKey(), symbol)
	return a
}

// AppendCodeWithScope will append code and scope to a.arr
func (a *ArrayBuilder) AppendCodeWithScope(code string, scope Document) *ArrayBuilder {
	a.arr = AppendCodeWithScopeElement(a.arr, a.incrementKey(), code, scope)
	return a
}

// AppendTimestamp will append t and i to a.arr
func (a *ArrayBuilder) AppendTimestamp(t, i uint32) *ArrayBuilder {
	a.arr = AppendTimestampElement(a.arr, a.incrementKey(), t, i)
	return a
}

// AppendInt64 will append i64 to a.arr
func (a *ArrayBuilder) AppendInt64(i64 int64) *ArrayBuilder {
	a.arr = AppendInt64Element(a.arr, a.incrementKey(), i64)
	return a
}

// AppendDecimal128 will append d128 to a.arr
func (a *ArrayBuilder) AppendDecimal128(d128 primitive.Decimal128) *ArrayBuilder {
	a.arr = AppendDecimal128Element(a.arr, a.incrementKey(), d128)
	return a
}

// AppendMaxKey will append a max key element to a.arr
func (a *ArrayBuilder) AppendMaxKey() *ArrayBuilder {
	a.arr = AppendMaxKeyElement(a.arr, a.incrementKey())
	return a
}

// AppendMinKey will append a min key element to a.arr
func (a *ArrayBuilder) AppendMinKey() *ArrayBuilder {
	a.arr = AppendMinKeyElement(a.arr, a.incrementKey())
	return a
}

// AppendValue appends a BSON value to the array.
func (a *ArrayBuilder) AppendValue(val Value) *ArrayBuilder {
	a.arr = AppendValueElement(a.arr, a.incrementKey(), val)
	return a
}

// StartArray starts building an inline Array. After this document is completed,
// the user must call a.FinishArray
func (a *ArrayBuilder) StartArray() *ArrayBuilder {
	a.arr = AppendHeader(a.arr, bsontype.Array, a.incrementKey())
	a.startArray()
	return a
}

// FinishArray builds the most recent array created
func (a *ArrayBuilder) FinishArray() *ArrayBuilder {
	a.arr = a.Build()
	return a
}
