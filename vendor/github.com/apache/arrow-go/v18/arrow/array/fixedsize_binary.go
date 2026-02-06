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
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/internal/json"
)

// A type which represents an immutable sequence of fixed-length binary strings.
type FixedSizeBinary struct {
	array

	valueBytes []byte
	bytewidth  int32
}

// NewFixedSizeBinaryData constructs a new fixed-size binary array from data.
func NewFixedSizeBinaryData(data arrow.ArrayData) *FixedSizeBinary {
	a := &FixedSizeBinary{bytewidth: int32(data.DataType().(arrow.FixedWidthDataType).BitWidth() / 8)}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

// Value returns the fixed-size slice at index i. This value should not be mutated.
func (a *FixedSizeBinary) Value(i int) []byte {
	i += a.data.offset
	var (
		bw  = int(a.bytewidth)
		beg = i * bw
		end = (i + 1) * bw
	)
	return a.valueBytes[beg:end]
}

func (a *FixedSizeBinary) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}
	return base64.StdEncoding.EncodeToString(a.Value(i))
}

func (a *FixedSizeBinary) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString(NullValueStr)
		default:
			fmt.Fprintf(o, "%q", a.Value(i))
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *FixedSizeBinary) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.valueBytes = vals.Bytes()
	}
}

func (a *FixedSizeBinary) GetOneForMarshal(i int) interface{} {
	if a.IsNull(i) {
		return nil
	}

	return a.Value(i)
}

func (a *FixedSizeBinary) MarshalJSON() ([]byte, error) {
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

func arrayEqualFixedSizeBinary(left, right *FixedSizeBinary) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if !bytes.Equal(left.Value(i), right.Value(i)) {
			return false
		}
	}
	return true
}

var _ arrow.Array = (*FixedSizeBinary)(nil)
