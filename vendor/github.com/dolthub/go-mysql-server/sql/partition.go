// Copyright 2022 Dolthub, Inc.
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

import "io"

// Partition represents a partition from a SQL table.
type Partition interface {
	Key() []byte
}

// PartitionIter is an iterator that retrieves partitions.
type PartitionIter interface {
	Closer
	Next(*Context) (Partition, error)
}

// PartitionsToPartitionIter creates a PartitionIter that iterates over the given partitions.
func PartitionsToPartitionIter(partitions ...Partition) PartitionIter {
	return &slicePartitionIter{partitions: partitions}
}

type slicePartitionIter struct {
	partitions []Partition
	idx        int
}

func (i *slicePartitionIter) Next(*Context) (Partition, error) {
	if i.idx >= len(i.partitions) {
		return nil, io.EOF
	}
	i.idx++
	return i.partitions[i.idx-1], nil
}
func (i *slicePartitionIter) Close(*Context) error {
	i.partitions = nil
	return nil
}
