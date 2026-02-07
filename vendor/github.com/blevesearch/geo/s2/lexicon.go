// Copyright 2020 Google Inc. All rights reserved.
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

package s2

import (
	"encoding/binary"
	"hash/adler32"
	"math"
	"sort"
)

// TODO(roberts): If any of these are worth making public, change the
// method signatures and type names.

// emptySetID represents the last ID that will ever be generated.
// (Non-negative IDs are reserved for singleton sets.)
var emptySetID = int32(math.MinInt32)

// idSetLexicon compactly represents a set of non-negative
// integers such as array indices ("ID sets"). It is especially suitable when
// either (1) there are many duplicate sets, or (2) there are many singleton
// or empty sets. See also sequenceLexicon.
//
// Each distinct ID set is mapped to a 32-bit integer. Empty and singleton
// sets take up no additional space; the set itself is represented
// by the unique ID assigned to the set. Duplicate sets are automatically
// eliminated. Note also that ID sets are referred to using 32-bit integers
// rather than pointers.
type idSetLexicon struct {
	idSets *sequenceLexicon
}

func newIDSetLexicon() *idSetLexicon {
	return &idSetLexicon{
		idSets: newSequenceLexicon(),
	}
}

// add adds the given set of integers to the lexicon if it is not already
// present, and return the unique ID for this set. The values are automatically
// sorted and duplicates are removed.
//
// The primary difference between this and sequenceLexicon are:
// 1. Empty and singleton sets are represented implicitly; they use no space.
// 2. Sets are represented rather than sequences; the ordering of values is
//
//	not important and duplicates are removed.
//
// 3. The values must be 32-bit non-negative integers only.
func (l *idSetLexicon) add(ids ...int32) int32 {
	// Empty sets have a special ID chosen not to conflict with other IDs.
	if len(ids) == 0 {
		return emptySetID
	}

	// Singleton sets are represented by their element.
	if len(ids) == 1 {
		return ids[0]
	}

	// Canonicalize the set by sorting and removing duplicates.
	//
	// Creates a new slice in order to not alter the supplied values.
	set := uniqueInt32s(ids)

	// Non-singleton sets are represented by the bitwise complement of the ID
	// returned by the sequenceLexicon
	return ^l.idSets.add(set)
}

// idSet returns the set of integers corresponding to an ID returned by add.
func (l *idSetLexicon) idSet(setID int32) []int32 {
	if setID >= 0 {
		return []int32{setID}
	}
	if setID == emptySetID {
		return []int32{}
	}

	return l.idSets.sequence(^setID)
}

func (l *idSetLexicon) clear() {
	l.idSets.clear()
}

// sequenceLexicon compactly represents a sequence of values (e.g., tuples).
// It automatically eliminates duplicates slices, and maps the remaining
// sequences to sequentially increasing integer IDs. See also idSetLexicon.
//
// Each distinct sequence is mapped to a 32-bit integer.
type sequenceLexicon struct {
	values []int32
	begins []uint32

	// idSet is a mapping of a sequence hash to sequence index in the lexicon.
	idSet map[uint32]int32
}

func newSequenceLexicon() *sequenceLexicon {
	return &sequenceLexicon{
		begins: []uint32{0},
		idSet:  make(map[uint32]int32),
	}
}

// clears all data from the lexicon.
func (l *sequenceLexicon) clear() {
	l.values = nil
	l.begins = []uint32{0}
	l.idSet = make(map[uint32]int32)
}

// add adds the given value to the lexicon if it is not already present, and
// returns its ID. IDs are assigned sequentially starting from zero.
func (l *sequenceLexicon) add(ids []int32) int32 {
	if id, ok := l.idSet[hashSet(ids)]; ok {
		return id
	}
	l.values = append(l.values, ids...)
	l.begins = append(l.begins, uint32(len(l.values)))

	id := int32(len(l.begins)) - 2
	l.idSet[hashSet(ids)] = id

	return id
}

// sequence returns the original sequence of values for the given ID.
func (l *sequenceLexicon) sequence(id int32) []int32 {
	return l.values[l.begins[id]:l.begins[id+1]]
}

// size reports the number of value sequences in the lexicon.
func (l *sequenceLexicon) size() int {
	// Subtract one because the list of begins starts out with the first element set to 0.
	return len(l.begins) - 1
}

// hashSet returns a hash of this sequence of int32s.
func hashSet(s []int32) uint32 {
	// TODO(roberts): We just need a way to nicely hash all the values down to
	// a 32-bit value. To ensure no unnecessary dependencies we use the core
	// library types available to do this. Is there a better option?
	a := adler32.New()
	binary.Write(a, binary.LittleEndian, s)
	return a.Sum32()
}

// uniqueInt32s returns the sorted and uniqued set of int32s from the input.
func uniqueInt32s(in []int32) []int32 {
	var vals []int32
	m := make(map[int32]bool)
	for _, i := range in {
		if m[i] {
			continue
		}
		m[i] = true
		vals = append(vals, i)
	}
	sort.Slice(vals, func(i, j int) bool { return vals[i] < vals[j] })
	return vals
}
