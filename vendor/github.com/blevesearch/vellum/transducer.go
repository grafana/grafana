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

package vellum

// Transducer represents the general contract of a byte-based finite transducer
type Transducer interface {

	// all transducers are also automatons
	Automaton

	// IsMatchWithValue returns true if and only if the state is a match
	// additionally it returns a states final value (if any)
	IsMatchWithVal(int) (bool, uint64)

	// Accept returns the next state given the input to the specified state
	// additionally it returns the value associated with the transition
	AcceptWithVal(int, byte) (int, uint64)
}

// TransducerGet implements an generic Get() method which works
// on any implementation of Transducer
// The caller MUST check the boolean return value for a match.
// Zero is a valid value regardless of match status,
// and if it is NOT a match, the value collected so far is returned.
func TransducerGet(t Transducer, k []byte) (bool, uint64) {
	var total uint64
	i := 0
	curr := t.Start()
	for t.CanMatch(curr) && i < len(k) {
		var transVal uint64
		curr, transVal = t.AcceptWithVal(curr, k[i])
		if curr == noneAddr {
			break
		}
		total += transVal
		i++
	}
	if i != len(k) {
		return false, total
	}
	match, finalVal := t.IsMatchWithVal(curr)
	return match, total + finalVal
}
