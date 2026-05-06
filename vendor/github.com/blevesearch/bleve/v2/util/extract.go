//  Copyright (c) 2023 Couchbase, Inc.
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

package util

import (
	"math"
	"reflect"
)

// extract numeric value (if possible) and returns a float64
func ExtractNumericValFloat64(v interface{}) (float64, bool) {
	val := reflect.ValueOf(v)
	if !val.IsValid() {
		return 0, false
	}

	switch {
	case val.CanFloat():
		return val.Float(), true
	case val.CanInt():
		return float64(val.Int()), true
	case val.CanUint():
		return float64(val.Uint()), true
	}

	return 0, false
}

// extract numeric value (if possible) and returns a float32
func ExtractNumericValFloat32(v interface{}) (float32, bool) {
	val := reflect.ValueOf(v)
	if !val.IsValid() {
		return 0, false
	}

	switch {
	case val.CanFloat():
		floatVal := val.Float()
		if !IsValidFloat32(floatVal) {
			return 0, false
		}
		return float32(floatVal), true
	case val.CanInt():
		return float32(val.Int()), true
	case val.CanUint():
		return float32(val.Uint()), true
	}

	return 0, false
}

func IsValidFloat32(val float64) bool {
	return !math.IsNaN(val) && !math.IsInf(val, 0) && val <= math.MaxFloat32
}
