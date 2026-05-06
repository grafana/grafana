//  Copyright (c) 2017 Couchbase, Inc.
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

package regexp

type sparseSet struct {
	dense  []uint
	sparse []uint
	size   uint
}

func newSparseSet(size uint) *sparseSet {
	return &sparseSet{
		dense:  make([]uint, size),
		sparse: make([]uint, size),
		size:   0,
	}
}

func (s *sparseSet) Len() int {
	return int(s.size)
}

func (s *sparseSet) Add(ip uint) uint {
	i := s.size
	s.dense[i] = ip
	s.sparse[ip] = i
	s.size++
	return i
}

func (s *sparseSet) Get(i uint) uint {
	return s.dense[i]
}

func (s *sparseSet) Contains(ip uint) bool {
	i := s.sparse[ip]
	return i < s.size && s.dense[i] == ip
}

func (s *sparseSet) Clear() {
	s.size = 0
}
