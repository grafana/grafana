// Copyright 2019 CUE Authors
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

package list

// A Comparer specifies whether one value is strictly less than another value.
Comparer: {
	T:    _
	x:    T
	y:    T
	less: bool // true if x < y
}

// Ascending defines a Comparer to sort comparable values in increasing order.
//
// Example:
//     list.Sort(a, list.Ascending)
Ascending: {
	Comparer
	T:    number | string
	x:    T
	y:    T
	less: x < y
}

// Descending defines a Comparer to sort comparable values in decreasing order.
//
// Example:
//     list.Sort(a, list.Descending)
Descending: {
	Comparer
	T:    number | string
	x:    T
	y:    T
	less: x > y
}
