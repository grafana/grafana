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

package store

// At the moment this happens to be the same interface as described by
// RocksDB, but this may not always be the case.

type MergeOperator interface {

	// FullMerge the full sequence of operands on top of the existingValue
	// if no value currently exists, existingValue is nil
	// return the merged value, and success/failure
	FullMerge(key, existingValue []byte, operands [][]byte) ([]byte, bool)

	// Partially merge these two operands.
	// If partial merge cannot be done, return nil,false, which will defer
	// all processing until the FullMerge is done.
	PartialMerge(key, leftOperand, rightOperand []byte) ([]byte, bool)

	// Name returns an identifier for the operator
	Name() string
}

type EmulatedMerge struct {
	Merges map[string][][]byte
	mo     MergeOperator
}

func NewEmulatedMerge(mo MergeOperator) *EmulatedMerge {
	return &EmulatedMerge{
		Merges: make(map[string][][]byte),
		mo:     mo,
	}
}

func (m *EmulatedMerge) Merge(key, val []byte) {
	ops, ok := m.Merges[string(key)]
	if ok && len(ops) > 0 {
		last := ops[len(ops)-1]
		mergedVal, partialMergeOk := m.mo.PartialMerge(key, last, val)
		if partialMergeOk {
			// replace last entry with the result of the merge
			ops[len(ops)-1] = mergedVal
		} else {
			// could not partial merge, append this to the end
			ops = append(ops, val)
		}
	} else {
		ops = [][]byte{val}
	}
	m.Merges[string(key)] = ops
}
