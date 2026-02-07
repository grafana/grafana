/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package stats

import (
	"fmt"
	"strings"
)

// MultiTracker is a CountTracker that tracks counts grouping them by
// more than one dimension.
type MultiTracker interface {
	CountTracker
	Labels() []string
}

// CounterForDimension returns a CountTracker for the provided
// dimension. It will panic if the dimension isn't a legal label for
// mt.
func CounterForDimension(mt MultiTracker, dimension string) CountTracker {
	for i, lab := range mt.Labels() {
		if lab == dimension {
			return wrappedCountTracker{
				f: func() map[string]int64 {
					result := make(map[string]int64)
					for k, v := range mt.Counts() {
						if k == "All" {
							result[k] = v
							continue
						}
						result[strings.Split(k, ".")[i]] += v
					}
					return result
				},
			}
		}
	}

	panic(fmt.Sprintf("label %v is not one of %v", dimension, mt.Labels()))
}
