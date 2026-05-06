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

//go:build !s390x

package utils

var (
	ToLEInt16   = func(x int16) int16 { return x }
	ToLEUint16  = func(x uint16) uint16 { return x }
	ToLEUint32  = func(x uint32) uint32 { return x }
	ToLEUint64  = func(x uint64) uint64 { return x }
	ToLEInt32   = func(x int32) int32 { return x }
	ToLEInt64   = func(x int64) int64 { return x }
	ToLEFloat32 = func(x float32) float32 { return x }
	ToLEFloat64 = func(x float64) float64 { return x }
)
