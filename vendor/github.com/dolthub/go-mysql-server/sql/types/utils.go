// Copyright 2025 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package types

import (
	"github.com/dolthub/go-mysql-server/sql"
)

// GetCompareType returns the type to use when comparing values of types left and right.
func GetCompareType(left, right sql.Type) sql.Type {
	// TODO: much of this logic is very similar to castLeftAndRight() from sql/expression/comparison.go
	//  consider consolidating
	if left.Equals(right) {
		return left
	}
	if IsTuple(left) && IsTuple(right) {
		return left
	}
	if IsTime(left) || IsTime(right) {
		return DatetimeMaxPrecision
	}
	if IsJSON(left) || IsJSON(right) {
		return JSON
	}
	if IsBinaryType(left) || IsBinaryType(right) {
		return LongBlob
	}
	if IsNumber(left) || IsNumber(right) {
		if IsDecimal(left) || IsDecimal(right) {
			return InternalDecimalType
		}
		if IsFloat(left) || IsFloat(right) {
			return Float64
		}
		if IsSigned(left) && IsSigned(right) {
			return Int64
		}
		if IsUnsigned(left) && IsUnsigned(right) {
			return Uint64
		}
		return Float64
	}
	return LongText
}
