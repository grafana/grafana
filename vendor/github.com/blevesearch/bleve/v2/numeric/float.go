//  Copyright (c) 2014 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package numeric

import (
	"math"
)

func Float64ToInt64(f float64) int64 {
	fasint := int64(math.Float64bits(f))
	if fasint < 0 {
		fasint = fasint ^ 0x7fffffffffffffff
	}
	return fasint
}

func Int64ToFloat64(i int64) float64 {
	if i < 0 {
		i ^= 0x7fffffffffffffff
	}
	return math.Float64frombits(uint64(i))
}
