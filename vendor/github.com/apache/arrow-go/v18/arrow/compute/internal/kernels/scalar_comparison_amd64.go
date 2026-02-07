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

//go:build go1.18 && !noasm

package kernels

import (
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"golang.org/x/sys/cpu"
)

var pureGo bool

type cmpfn func(arrow.Type, []byte, []byte, []byte, int64, int)

var comparisonMap map[CompareOperator][3]cmpfn

func genCompareKernel[T arrow.NumericType](op CompareOperator) *CompareData {
	if pureGo {
		return genGoCompareKernel(getCmpOp[T](op))
	}

	ty := arrow.GetType[T]()
	byteWidth := int(unsafe.Sizeof(T(0)))
	comparisonFns := comparisonMap[op]
	return &CompareData{
		funcAA: func(left, right, out []byte, offset int) {
			length := int64(len(left) / byteWidth)
			comparisonFns[0](ty, left, right, out, length, offset)
		},
		funcAS: func(left, right, out []byte, offset int) {
			length := int64(len(left) / byteWidth)
			comparisonFns[1](ty, left, right, out, length, offset)
		},
		funcSA: func(left, right, out []byte, offset int) {
			length := int64(len(right) / byteWidth)
			comparisonFns[2](ty, left, right, out, length, offset)
		},
	}
}

func init() {
	if cpu.X86.HasAVX2 {
		comparisonMap = map[CompareOperator][3]cmpfn{
			CmpEQ: {
				comparisonEqualArrArrAvx2,
				comparisonEqualArrScalarAvx2,
				comparisonEqualScalarArrAvx2,
			},
			CmpNE: {
				comparisonNotEqualArrArrAvx2,
				comparisonNotEqualArrScalarAvx2,
				comparisonNotEqualScalarArrAvx2,
			},
			CmpGT: {
				comparisonGreaterArrArrAvx2,
				comparisonGreaterArrScalarAvx2,
				comparisonGreaterScalarArrAvx2,
			},
			CmpGE: {
				comparisonGreaterEqualArrArrAvx2,
				comparisonGreaterEqualArrScalarAvx2,
				comparisonGreaterEqualScalarArrAvx2,
			},
		}

	} else if cpu.X86.HasSSE42 {
		comparisonMap = map[CompareOperator][3]cmpfn{
			CmpEQ: {
				comparisonEqualArrArrSSE4,
				comparisonEqualArrScalarSSE4,
				comparisonEqualScalarArrSSE4,
			},
			CmpNE: {
				comparisonNotEqualArrArrSSE4,
				comparisonNotEqualArrScalarSSE4,
				comparisonNotEqualScalarArrSSE4,
			},
			CmpGT: {
				comparisonGreaterArrArrSSE4,
				comparisonGreaterArrScalarSSE4,
				comparisonGreaterScalarArrSSE4,
			},
			CmpGE: {
				comparisonGreaterEqualArrArrSSE4,
				comparisonGreaterEqualArrScalarSSE4,
				comparisonGreaterEqualScalarArrSSE4,
			},
		}
	} else {
		pureGo = true
	}
}
