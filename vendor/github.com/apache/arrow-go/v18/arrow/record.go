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

import "github.com/apache/arrow-go/v18/internal/json"

// RecordBatch is a collection of equal-length arrays matching a particular Schema.
// This corresponds to the RecordBatch concept in the Arrow specification.
//
// It is also possible to construct a Table from a collection of RecordBatches that
// all have the same schema.
type RecordBatch interface {
	json.Marshaler

	Release()
	Retain()

	Schema() *Schema

	NumRows() int64
	NumCols() int64

	Columns() []Array
	Column(i int) Array
	ColumnName(i int) string
	SetColumn(i int, col Array) (RecordBatch, error)

	// NewSlice constructs a zero-copy slice of the record with the indicated
	// indices i and j, corresponding to array[i:j].
	// The returned record must be Release()'d after use.
	//
	// NewSlice panics if the slice is outside the valid range of the record array.
	// NewSlice panics if j < i.
	NewSlice(i, j int64) RecordBatch
}

// Record as a term typically refers to a single row, but this type represents a batch of rows, known in Arrow parlance
// as a RecordBatch. This alias is provided for backwards compatibility.
//
// Deprecated: This is deprecated to avoid the confusion of the terminology where Record refers to a single row,
// use [RecordBatch] instead.
type Record = RecordBatch
