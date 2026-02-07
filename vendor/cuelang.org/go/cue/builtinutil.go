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

package cue

// TODO: this code could be generated, but currently isn't.

type valueSorter struct {
	a   []Value
	cmp Value
	err error
}

func (s *valueSorter) ret() ([]Value, error) {
	if s.err != nil {
		return nil, s.err
	}
	// The input slice is already a copy and that we can modify it safely.
	return s.a, nil
}

func (s *valueSorter) Len() int      { return len(s.a) }
func (s *valueSorter) Swap(i, j int) { s.a[i], s.a[j] = s.a[j], s.a[i] }
func (s *valueSorter) Less(i, j int) bool {
	v := s.cmp.Fill(s.a[i], "x")
	v = v.Fill(s.a[j], "y")

	isLess, err := v.Lookup("less").Bool()
	if err != nil && s.err == nil {
		s.err = err
		return true
	}
	return isLess
}
