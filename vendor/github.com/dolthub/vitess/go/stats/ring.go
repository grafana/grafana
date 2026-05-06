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

// Ring of int64 values
// Not thread safe
type RingInt64 struct {
	position int
	values   []int64
}

func NewRingInt64(capacity int) *RingInt64 {
	return &RingInt64{values: make([]int64, 0, capacity)}
}

func (ri *RingInt64) Add(val int64) {
	if len(ri.values) == cap(ri.values) {
		ri.values[ri.position] = val
		ri.position = (ri.position + 1) % cap(ri.values)
	} else {
		ri.values = append(ri.values, val)
	}
}

func (ri *RingInt64) Values() (values []int64) {
	values = make([]int64, len(ri.values))
	for i := 0; i < len(ri.values); i++ {
		values[i] = ri.values[(ri.position+i)%cap(ri.values)]
	}
	return values
}
