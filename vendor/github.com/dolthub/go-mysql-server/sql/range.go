// Copyright 2021 Dolthub, Inc.
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

package sql

import "fmt"

// RangeCollection is a collection of ranges that represent different (non-overlapping) filter expressions.
type RangeCollection interface {
	DebugStringer
	fmt.Stringer
	Equals(otherCollection RangeCollection) (bool, error)
	Len() int
	ToRanges() []Range
}

// Range represents a set iteration over an integrator's index. Ranges are not required to be contiguous, although they
// are expected to not overlap.
type Range interface {
	DebugStringer
	fmt.Stringer
	Equals(other Range) (bool, error)
}
