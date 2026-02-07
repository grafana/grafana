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

//go:build !noasm
// +build !noasm

package bitutil

import "golang.org/x/sys/cpu"

func init() {
	if cpu.X86.HasAVX2 {
		bitAndOp.opAligned = bitmapAlignedAndAVX2
		bitOrOp.opAligned = bitmapAlignedOrAVX2
		bitAndNotOp.opAligned = bitmapAlignedAndNotAVX2
		bitXorOp.opAligned = bitmapAlignedXorAVX2
	} else if cpu.X86.HasSSE42 {
		bitAndOp.opAligned = bitmapAlignedAndSSE4
		bitOrOp.opAligned = bitmapAlignedOrSSE4
		bitAndNotOp.opAligned = bitmapAlignedAndNotSSE4
		bitXorOp.opAligned = bitmapAlignedXorSSE4
	} else {
		bitAndOp.opAligned = alignedBitAndGo
		bitOrOp.opAligned = alignedBitOrGo
		bitAndNotOp.opAligned = alignedBitAndNotGo
		bitXorOp.opAligned = alignedBitXorGo
	}
}
