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

package search

import (
	"math"
)

func LevenshteinDistance(a, b string) int {
	la := len(a)
	lb := len(b)
	d := make([]int, la+1)
	var lastdiag, olddiag, temp int

	for i := 1; i <= la; i++ {
		d[i] = i
	}
	for i := 1; i <= lb; i++ {
		d[0] = i
		lastdiag = i - 1
		for j := 1; j <= la; j++ {
			olddiag = d[j]
			min := d[j] + 1
			if (d[j-1] + 1) < min {
				min = d[j-1] + 1
			}
			if a[j-1] == b[i-1] {
				temp = 0
			} else {
				temp = 1
			}
			if (lastdiag + temp) < min {
				min = lastdiag + temp
			}
			d[j] = min
			lastdiag = olddiag
		}
	}
	return d[la]
}

// LevenshteinDistanceMax same as LevenshteinDistance but
// attempts to bail early once we know the distance
// will be greater than max
// in which case the first return val will be the max
// and the second will be true, indicating max was exceeded
func LevenshteinDistanceMax(a, b string, max int) (int, bool) {
	v, wasMax, _ := LevenshteinDistanceMaxReuseSlice(a, b, max, nil)
	return v, wasMax
}

func LevenshteinDistanceMaxReuseSlice(a, b string, max int, d []int) (int, bool, []int) {
	la := len(a)
	lb := len(b)

	ld := int(math.Abs(float64(la - lb)))
	if ld > max {
		return max, true, d
	} else if la == 0 || lb == 0 {
		// if one string of the two strings is empty, then ld is
		// the length of the other string and as such is <= max
		return ld, false, d
	}

	if cap(d) < la+1 {
		d = make([]int, la+1)
	}
	d = d[:la+1]

	var lastdiag, olddiag, temp int

	for i := 1; i <= la; i++ {
		d[i] = i
	}
	for i := 1; i <= lb; i++ {
		d[0] = i
		lastdiag = i - 1
		rowmin := max + 1
		for j := 1; j <= la; j++ {
			olddiag = d[j]
			min := d[j] + 1
			if (d[j-1] + 1) < min {
				min = d[j-1] + 1
			}
			if a[j-1] == b[i-1] {
				temp = 0
			} else {
				temp = 1
			}
			if (lastdiag + temp) < min {
				min = lastdiag + temp
			}
			if min < rowmin {
				rowmin = min
			}
			d[j] = min

			lastdiag = olddiag
		}
		// after each row if rowmin isn't less than max stop
		if rowmin > max {
			return max, true, d
		}
	}
	return d[la], false, d
}
