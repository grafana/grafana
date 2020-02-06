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
	"strings"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/float16"
)

// A type which represents an immutable sequence of Float16 values.
type Float16 struct {
	array
	values []float16.Num
}

func NewFloat16Data(data *Data) *Float16 {
	a := &Float16{}
	a.refCount = 1
	a.setData(data)
	return a
}

func (a *Float16) Value(i int) float16.Num { return a.values[i] }

func (a *Float16) Values() []float16.Num { return a.values }

func (a *Float16) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			fmt.Fprintf(o, " ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString("(null)")
		default:
			fmt.Fprintf(o, "%v", a.values[i].Float32())
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *Float16) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.values = arrow.Float16Traits.CastFromBytes(vals.Bytes())
		beg := a.array.data.offset
		end := beg + a.array.data.length
		a.values = a.values[beg:end]
	}
}

func arrayEqualFloat16(left, right *Float16) bool {
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
	_ Interface = (*Float16)(nil)
)
