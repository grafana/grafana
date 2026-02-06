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

package flightsql

import (
	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
)

const (
	strValIdx arrow.UnionTypeCode = iota
	boolValIdx
	bigintValIdx
	int32BitMaskIdx
	strListIdx
	int32ToInt32ListIdx
)

// sqlInfoResultBldr is a helper for building up the dense union response
// of a SqlInfo request.
type sqlInfoResultBldr struct {
	valueBldr *array.DenseUnionBuilder

	strBldr              *array.StringBuilder
	boolBldr             *array.BooleanBuilder
	bigintBldr           *array.Int64Builder
	int32BitmaskBldr     *array.Int32Builder
	strListBldr          *array.ListBuilder
	int32Toint32ListBldr *array.MapBuilder
}

func newSqlInfoResultBuilder(valueBldr *array.DenseUnionBuilder) *sqlInfoResultBldr {
	return &sqlInfoResultBldr{
		valueBldr:            valueBldr,
		strBldr:              valueBldr.Child(int(strValIdx)).(*array.StringBuilder),
		boolBldr:             valueBldr.Child(int(boolValIdx)).(*array.BooleanBuilder),
		bigintBldr:           valueBldr.Child(int(bigintValIdx)).(*array.Int64Builder),
		int32BitmaskBldr:     valueBldr.Child(int(int32BitMaskIdx)).(*array.Int32Builder),
		strListBldr:          valueBldr.Child(int(strListIdx)).(*array.ListBuilder),
		int32Toint32ListBldr: valueBldr.Child(int(int32ToInt32ListIdx)).(*array.MapBuilder),
	}
}

func (s *sqlInfoResultBldr) Append(v interface{}) {
	switch v := v.(type) {
	case string:
		s.valueBldr.Append(strValIdx)
		s.strBldr.Append(v)
	case bool:
		s.valueBldr.Append(boolValIdx)
		s.boolBldr.Append(v)
	case int64:
		s.valueBldr.Append(bigintValIdx)
		s.bigintBldr.Append(v)
	case int32:
		s.valueBldr.Append(int32BitMaskIdx)
		s.int32BitmaskBldr.Append(v)
	case []string:
		s.valueBldr.Append(strListIdx)
		s.strListBldr.Append(true)
		chld := s.strListBldr.ValueBuilder().(*array.StringBuilder)
		chld.AppendValues(v, nil)
	case map[int32][]int32:
		s.valueBldr.Append(int32ToInt32ListIdx)
		s.int32Toint32ListBldr.Append(true)

		kb := s.int32Toint32ListBldr.KeyBuilder().(*array.Int32Builder)
		ib := s.int32Toint32ListBldr.ItemBuilder().(*array.ListBuilder)
		ch := ib.ValueBuilder().(*array.Int32Builder)

		for key, val := range v {
			kb.Append(key)
			ib.Append(true)
			for _, c := range val {
				ch.Append(c)
			}
		}
	}
}
