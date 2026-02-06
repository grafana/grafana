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
	"fmt"
	"strconv"
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// A type which represents an immutable sequence of boolean values.
type Boolean struct {
	array
	values []byte
}

// NewBoolean creates a boolean array from the data memory.Buffer and contains length elements.
// The nullBitmap buffer can be nil of there are no null values.
// If nulls is not known, use UnknownNullCount to calculate the value of NullN at runtime from the nullBitmap buffer.
func NewBoolean(length int, data *memory.Buffer, nullBitmap *memory.Buffer, nulls int) *Boolean {
	arrdata := NewData(arrow.FixedWidthTypes.Boolean, length, []*memory.Buffer{nullBitmap, data}, nil, nulls, 0)
	defer arrdata.Release()
	return NewBooleanData(arrdata)
}

func NewBooleanData(data arrow.ArrayData) *Boolean {
	a := &Boolean{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *Boolean) Value(i int) bool {
	if i < 0 || i >= a.data.length {
		panic("arrow/array: index out of range")
	}
	return bitutil.BitIsSet(a.values, a.data.offset+i)
}

func (a *Boolean) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	} else {
		return strconv.FormatBool(a.Value(i))
	}
}

func (a *Boolean) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			fmt.Fprintf(o, " ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString(NullValueStr)
		default:
			fmt.Fprintf(o, "%v", a.Value(i))
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *Boolean) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.values = vals.Bytes()
	}
}

func (a *Boolean) GetOneForMarshal(i int) interface{} {
	if a.IsValid(i) {
		return a.Value(i)
	}
	return nil
}

func (a *Boolean) MarshalJSON() ([]byte, error) {
	vals := make([]interface{}, a.Len())
	for i := 0; i < a.Len(); i++ {
		if a.IsValid(i) {
			vals[i] = a.Value(i)
		} else {
			vals[i] = nil
		}
	}
	return json.Marshal(vals)
}

func arrayEqualBoolean(left, right *Boolean) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if left.Value(i) != right.Value(i) {
			return false
		}
	}
	return true
}

var (
	_ arrow.Array            = (*Boolean)(nil)
	_ arrow.TypedArray[bool] = (*Boolean)(nil)
)
