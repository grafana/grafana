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

//go:build go1.18
// +build go1.18

package example

import (
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/flight/flightsql/schema_ref"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

func GetTypeInfoResult(mem memory.Allocator) arrow.Record {
	typeNames, _, _ := array.FromJSON(mem, arrow.BinaryTypes.String,
		strings.NewReader(`["bit", "tinyint", "bigint", "longvarbinary",
						    "varbinary", "text", "longvarchar", "char",
							"integer", "smallint", "float", "double",
							"numeric", "varchar", "date", "time", "timestamp"]`))
	defer typeNames.Release()

	dataType, _, _ := array.FromJSON(mem, arrow.PrimitiveTypes.Int32,
		strings.NewReader(`[-7, -6, -5, -4, -3, -1, -1, 1, 4, 5, 6, 8, 8, 12, 91, 92, 93]`))
	defer dataType.Release()

	columnSize, _, _ := array.FromJSON(mem, arrow.PrimitiveTypes.Int32,
		strings.NewReader(`[1, 3, 19, 65536, 255, 65536, 65536, 255, 9, 5, 7, 15, 15, 255, 10, 8, 32]`))
	defer columnSize.Release()

	literalPrefix, _, _ := array.FromJSON(mem, arrow.BinaryTypes.String,
		strings.NewReader(`[null, null, null, null, null, "'", "'", "'", null, null, null, null, null, "'" ,"'", "'", "'"]`))
	defer literalPrefix.Release()

	literalSuffix, _, _ := array.FromJSON(mem, arrow.BinaryTypes.String,
		strings.NewReader(`[null, null, null, null, null, "'", "'", "'", null, null, null, null, null, "'" ,"'", "'", "'"]`))
	defer literalSuffix.Release()

	createParams, _, _ := array.FromJSON(mem, arrow.ListOfField(arrow.Field{Name: "item", Type: arrow.BinaryTypes.String, Nullable: false}),
		strings.NewReader(`[[], [], [], [], [], ["length"], ["length"], ["length"], [], [], [], [], [], ["length"], [], [], []]`))
	defer createParams.Release()

	nullable, _, _ := array.FromJSON(mem, arrow.PrimitiveTypes.Int32,
		strings.NewReader(`[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]`))
	defer nullable.Release()

	// reference for creating a boolean() array with only zeros
	zeroBoolArray, _, err := array.FromJSON(mem, arrow.FixedWidthTypes.Boolean,
		strings.NewReader(`[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`), array.WithUseNumber())
	if err != nil {
		panic(err)
	}
	defer zeroBoolArray.Release()
	caseSensitive := zeroBoolArray

	searchable, _, _ := array.FromJSON(mem, arrow.PrimitiveTypes.Int32,
		strings.NewReader(`[3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]`))
	defer searchable.Release()

	unsignedAttribute := zeroBoolArray
	fixedPrecScale := zeroBoolArray
	autoUniqueVal := zeroBoolArray

	localTypeName := typeNames

	zeroIntArray, _, _ := array.FromJSON(mem, arrow.PrimitiveTypes.Int32,
		strings.NewReader(`[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`))
	defer zeroIntArray.Release()

	minimalScale := zeroIntArray
	maximumScale := zeroIntArray
	sqlDataType := dataType
	sqlDateTimeSub := zeroIntArray
	numPrecRadix := zeroIntArray
	intervalPrecision := zeroIntArray

	return array.NewRecord(schema_ref.XdbcTypeInfo, []arrow.Array{
		typeNames, dataType, columnSize, literalPrefix, literalSuffix,
		createParams, nullable, caseSensitive, searchable, unsignedAttribute,
		fixedPrecScale, autoUniqueVal, localTypeName, minimalScale, maximumScale,
		sqlDataType, sqlDateTimeSub, numPrecRadix, intervalPrecision}, 17)
}

func GetFilteredTypeInfoResult(mem memory.Allocator, filter int32) arrow.Record {
	batch := GetTypeInfoResult(mem)
	defer batch.Release()

	dataTypeVector := []int32{-7, -6, -5, -4, -3, -1, -1, 1, 4, 5, 6, 8, 8, 12, 91, 92, 93}
	start, end := -1, -1
	for i, v := range dataTypeVector {
		if filter == v {
			if start == -1 {
				start = i
			}
		} else if start != -1 && end == -1 {
			end = i
			break
		}
	}

	return batch.NewSlice(int64(start), int64(end))
}
