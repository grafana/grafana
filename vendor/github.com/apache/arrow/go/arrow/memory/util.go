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

package memory

import "unsafe"

func roundToPowerOf2(v, round int) int {
	forceCarry := round - 1
	truncateMask := ^forceCarry
	return (v + forceCarry) & truncateMask
}

func roundUpToMultipleOf64(v int) int {
	return roundToPowerOf2(v, 64)
}

func isMultipleOfPowerOf2(v int, d int) bool {
	return (v & (d - 1)) == 0
}

func addressOf(b []byte) uintptr {
	return uintptr(unsafe.Pointer(&b[0]))
}
