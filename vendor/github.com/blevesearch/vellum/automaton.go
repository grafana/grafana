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

// Automaton represents the general contract of a byte-based finite automaton
type Automaton interface {

	// Start returns the start state
	Start() int

	// IsMatch returns true if and only if the state is a match
	IsMatch(int) bool

	// CanMatch returns true if and only if it is possible to reach a match
	// in zero or more steps
	CanMatch(int) bool

	// WillAlwaysMatch returns true if and only if the current state matches
	// and will always match no matter what steps are taken
	WillAlwaysMatch(int) bool

	// Accept returns the next state given the input to the specified state
	Accept(int, byte) int
}

// AutomatonContains implements an generic Contains() method which works
// on any implementation of Automaton
func AutomatonContains(a Automaton, k []byte) bool {
	i := 0
	curr := a.Start()
	for a.CanMatch(curr) && i < len(k) {
		curr = a.Accept(curr, k[i])
		if curr == noneAddr {
			break
		}
		i++
	}
	if i != len(k) {
		return false
	}
	return a.IsMatch(curr)
}

// AlwaysMatch is an Automaton implementation which always matches
type AlwaysMatch struct{}

// Start returns the AlwaysMatch start state
func (m *AlwaysMatch) Start() int {
	return 0
}

// IsMatch always returns true
func (m *AlwaysMatch) IsMatch(int) bool {
	return true
}

// CanMatch always returns true
func (m *AlwaysMatch) CanMatch(int) bool {
	return true
}

// WillAlwaysMatch always returns true
func (m *AlwaysMatch) WillAlwaysMatch(int) bool {
	return true
}

// Accept returns the next AlwaysMatch state
func (m *AlwaysMatch) Accept(int, byte) int {
	return 0
}

// creating an alwaysMatchAutomaton to avoid unnecessary repeated allocations.
var alwaysMatchAutomaton = &AlwaysMatch{}

type FuzzyAutomaton interface {
	Automaton
	EditDistance(int) uint8
	MatchAndDistance(input string) (bool, uint8)
}
