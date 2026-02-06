//  Copyright (c) 2018 Couchbase, Inc.
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

package levenshtein

import (
	"math"
	"sort"
)

/// Levenshtein Distance computed by a Levenshtein Automaton.
///
/// Levenshtein automata can only compute the exact Levenshtein distance
/// up to a given `max_distance`.
///
/// Over this distance, the automaton will invariably
/// return `Distance::AtLeast(max_distance + 1)`.
type Distance interface {
	distance() uint8
}

type Exact struct {
	d uint8
}

func (e Exact) distance() uint8 {
	return e.d
}

type Atleast struct {
	d uint8
}

func (a Atleast) distance() uint8 {
	return a.d
}

func characteristicVector(query []rune, c rune) uint64 {
	chi := uint64(0)
	for i := 0; i < len(query); i++ {
		if query[i] == c {
			chi |= 1 << uint64(i)
		}
	}
	return chi
}

type NFAState struct {
	Offset      uint32
	Distance    uint8
	InTranspose bool
}

type NFAStates []NFAState

func (ns NFAStates) Len() int {
	return len(ns)
}

func (ns NFAStates) Less(i, j int) bool {
	if ns[i].Offset != ns[j].Offset {
		return ns[i].Offset < ns[j].Offset
	}

	if ns[i].Distance != ns[j].Distance {
		return ns[i].Distance < ns[j].Distance
	}

	return !ns[i].InTranspose && ns[j].InTranspose
}

func (ns NFAStates) Swap(i, j int) {
	ns[i], ns[j] = ns[j], ns[i]
}

func (ns *NFAState) imply(other NFAState) bool {
	transposeImply := ns.InTranspose
	if !other.InTranspose {
		transposeImply = !other.InTranspose
	}

	deltaOffset := ns.Offset - other.Offset
	if ns.Offset < other.Offset {
		deltaOffset = other.Offset - ns.Offset
	}

	if transposeImply {
		return uint32(other.Distance) >= (uint32(ns.Distance) + deltaOffset)
	}

	return uint32(other.Distance) > (uint32(ns.Distance) + deltaOffset)
}

type MultiState struct {
	states []NFAState
}

func (ms *MultiState) States() []NFAState {
	return ms.states
}

func (ms *MultiState) Clear() {
	ms.states = ms.states[:0]
}

func newMultiState() *MultiState {
	return &MultiState{states: make([]NFAState, 0)}
}

func (ms *MultiState) normalize() uint32 {
	minOffset := uint32(math.MaxUint32)

	for _, s := range ms.states {
		if s.Offset < minOffset {
			minOffset = s.Offset
		}
	}
	if minOffset == uint32(math.MaxUint32) {
		minOffset = 0
	}

	for i := 0; i < len(ms.states); i++ {
		ms.states[i].Offset -= minOffset
	}

	sort.Sort(NFAStates(ms.states))

	return minOffset
}

func (ms *MultiState) addStates(nState NFAState) {

	for _, s := range ms.states {
		if s.imply(nState) {
			return
		}
	}

	i := 0
	for i < len(ms.states) {
		if nState.imply(ms.states[i]) {
			ms.states = append(ms.states[:i], ms.states[i+1:]...)
		} else {
			i++
		}
	}
	ms.states = append(ms.states, nState)

}

func extractBit(bitset uint64, pos uint8) bool {
	shift := bitset >> pos
	bit := shift & 1
	return bit == uint64(1)
}

func dist(left, right uint32) uint32 {
	if left > right {
		return left - right
	}
	return right - left
}

type LevenshteinNFA struct {
	mDistance uint8
	damerau   bool
}

func newLevenshtein(maxD uint8, transposition bool) *LevenshteinNFA {
	return &LevenshteinNFA{mDistance: maxD,
		damerau: transposition,
	}
}

func (la *LevenshteinNFA) maxDistance() uint8 {
	return la.mDistance
}

func (la *LevenshteinNFA) msDiameter() uint8 {
	return 2*la.mDistance + 1
}

func (la *LevenshteinNFA) initialStates() *MultiState {
	ms := MultiState{}
	nfaState := NFAState{}
	ms.addStates(nfaState)
	return &ms
}

func (la *LevenshteinNFA) multistateDistance(ms *MultiState,
	queryLen uint32) Distance {
	minDistance := Atleast{d: la.mDistance + 1}
	for _, s := range ms.states {
		t := s.Distance + uint8(dist(queryLen, s.Offset))
		if t <= uint8(la.mDistance) {
			if minDistance.distance() > t {
				minDistance.d = t
			}
		}
	}

	if minDistance.distance() == la.mDistance+1 {
		return Atleast{d: la.mDistance + 1}
	}

	return minDistance
}

func (la *LevenshteinNFA) simpleTransition(state NFAState,
	symbol uint64, ms *MultiState) {

	if state.Distance < la.mDistance {
		// insertion
		ms.addStates(NFAState{Offset: state.Offset,
			Distance:    state.Distance + 1,
			InTranspose: false})

		// substitution
		ms.addStates(NFAState{Offset: state.Offset + 1,
			Distance:    state.Distance + 1,
			InTranspose: false})

		n := la.mDistance + 1 - state.Distance
		for d := uint8(1); d < n; d++ {
			if extractBit(symbol, d) {
				//  for d > 0, as many deletion and character match
				ms.addStates(NFAState{Offset: state.Offset + 1 + uint32(d),
					Distance:    state.Distance + d,
					InTranspose: false})
			}
		}

		if la.damerau && extractBit(symbol, 1) {
			ms.addStates(NFAState{
				Offset:      state.Offset,
				Distance:    state.Distance + 1,
				InTranspose: true})
		}

	}

	if extractBit(symbol, 0) {
		ms.addStates(NFAState{Offset: state.Offset + 1,
			Distance:    state.Distance,
			InTranspose: false})
	}

	if state.InTranspose && extractBit(symbol, 0) {
		ms.addStates(NFAState{Offset: state.Offset + 2,
			Distance:    state.Distance,
			InTranspose: false})
	}

}

func (la *LevenshteinNFA) transition(cState *MultiState,
	dState *MultiState, scv uint64) {
	dState.Clear()
	mask := (uint64(1) << la.msDiameter()) - uint64(1)

	for _, state := range cState.states {
		cv := (scv >> state.Offset) & mask
		la.simpleTransition(state, cv, dState)
	}

	sort.Sort(NFAStates(dState.states))
}

func (la *LevenshteinNFA) computeDistance(query, other []rune) Distance {
	cState := la.initialStates()
	nState := newMultiState()

	for _, i := range other {
		nState.Clear()
		chi := characteristicVector(query, i)
		la.transition(cState, nState, chi)
		cState, nState = nState, cState
	}

	return la.multistateDistance(cState, uint32(len(query)))
}
