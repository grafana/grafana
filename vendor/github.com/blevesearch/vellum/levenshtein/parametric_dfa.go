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
	"crypto/md5"
	"encoding/json"
	"fmt"
	"math"
)

type ParametricState struct {
	shapeID uint32
	offset  uint32
}

func newParametricState() ParametricState {
	return ParametricState{}
}

func (ps *ParametricState) isDeadEnd() bool {
	return ps.shapeID == 0
}

type Transition struct {
	destShapeID uint32
	deltaOffset uint32
}

func (t *Transition) apply(state ParametricState) ParametricState {
	ps := ParametricState{
		shapeID: t.destShapeID}
	// don't need any offset if we are in the dead state,
	// this ensures we have only one dead state.
	if t.destShapeID != 0 {
		ps.offset = state.offset + t.deltaOffset
	}

	return ps
}

type ParametricStateIndex struct {
	stateIndex []uint32
	stateQueue []ParametricState
	numOffsets uint32
}

func newParametricStateIndex(queryLen,
	numParamState uint32) ParametricStateIndex {
	numOffsets := queryLen + 1
	if numParamState == 0 {
		numParamState = numOffsets
	}
	maxNumStates := numParamState * numOffsets
	psi := ParametricStateIndex{
		stateIndex: make([]uint32, maxNumStates),
		stateQueue: make([]ParametricState, 0, 150),
		numOffsets: numOffsets,
	}

	for i := uint32(0); i < maxNumStates; i++ {
		psi.stateIndex[i] = math.MaxUint32
	}
	return psi
}

func (psi *ParametricStateIndex) numStates() int {
	return len(psi.stateQueue)
}

func (psi *ParametricStateIndex) maxNumStates() int {
	return len(psi.stateIndex)
}

func (psi *ParametricStateIndex) get(stateID uint32) ParametricState {
	return psi.stateQueue[stateID]
}

func (psi *ParametricStateIndex) getOrAllocate(ps ParametricState) uint32 {
	bucket := ps.shapeID*psi.numOffsets + ps.offset
	if bucket < uint32(len(psi.stateIndex)) &&
		psi.stateIndex[bucket] != math.MaxUint32 {
		return psi.stateIndex[bucket]
	}
	nState := uint32(len(psi.stateQueue))
	psi.stateQueue = append(psi.stateQueue, ps)

	psi.stateIndex[bucket] = nState
	return nState
}

type ParametricDFA struct {
	distance         []uint8
	transitions      []Transition
	maxDistance      uint8
	transitionStride uint32
	diameter         uint32
}

func (pdfa *ParametricDFA) initialState() ParametricState {
	return ParametricState{shapeID: 1}
}

// Returns true iff whatever characters come afterward,
// we will never reach a shorter distance
func (pdfa *ParametricDFA) isPrefixSink(state ParametricState, queryLen uint32) bool {
	if state.isDeadEnd() {
		return true
	}

	remOffset := queryLen - state.offset
	if remOffset < pdfa.diameter {
		stateDistances := pdfa.distance[pdfa.diameter*state.shapeID:]
		prefixDistance := stateDistances[remOffset]
		if prefixDistance > pdfa.maxDistance {
			return false
		}

		for _, d := range stateDistances {
			if d < prefixDistance {
				return false
			}
		}
		return true
	}
	return false
}

func (pdfa *ParametricDFA) numStates() int {
	return len(pdfa.transitions) / int(pdfa.transitionStride)
}

func min(x, y uint32) uint32 {
	if x < y {
		return x
	}
	return y
}

func (pdfa *ParametricDFA) transition(state ParametricState,
	chi uint32) Transition {
	return pdfa.transitions[pdfa.transitionStride*state.shapeID+chi]
}

func (pdfa *ParametricDFA) getDistance(state ParametricState,
	qLen uint32) Distance {
	remainingOffset := qLen - state.offset
	if state.isDeadEnd() || remainingOffset >= pdfa.diameter {
		return Atleast{d: pdfa.maxDistance + 1}
	}
	dist := pdfa.distance[int(pdfa.diameter*state.shapeID)+int(remainingOffset)]
	if dist > pdfa.maxDistance {
		return Atleast{d: dist}
	}
	return Exact{d: dist}
}

func (pdfa *ParametricDFA) computeDistance(left, right string) Distance {
	state := pdfa.initialState()
	leftChars := []rune(left)
	for _, chr := range []rune(right) {
		start := state.offset
		stop := min(start+pdfa.diameter, uint32(len(leftChars)))
		chi := characteristicVector(leftChars[start:stop], chr)
		transition := pdfa.transition(state, uint32(chi))
		state = transition.apply(state)
		if state.isDeadEnd() {
			return Atleast{d: pdfa.maxDistance + 1}
		}
	}
	return pdfa.getDistance(state, uint32(len(left)))
}

func (pdfa *ParametricDFA) buildDfa(query string, distance uint8,
	prefix bool) (*DFA, error) {
	qLen := uint32(len([]rune(query)))
	alphabet := queryChars(query)

	psi := newParametricStateIndex(qLen, uint32(pdfa.numStates()))
	maxNumStates := psi.maxNumStates()
	deadEndStateID := psi.getOrAllocate(newParametricState())
	if deadEndStateID != 0 {
		return nil, fmt.Errorf("Invalid dead end state")
	}

	initialStateID := psi.getOrAllocate(pdfa.initialState())
	dfaBuilder := withMaxStates(uint32(maxNumStates))
	mask := uint32((1 << pdfa.diameter) - 1)

	var stateID int
	for stateID = 0; stateID < StateLimit; stateID++ {
		if stateID == psi.numStates() {
			break
		}
		state := psi.get(uint32(stateID))
		if prefix && pdfa.isPrefixSink(state, qLen) {
			distance := pdfa.getDistance(state, qLen)
			dfaBuilder.addState(uint32(stateID), uint32(stateID), distance)
		} else {
			transition := pdfa.transition(state, 0)
			defSuccessor := transition.apply(state)
			defSuccessorID := psi.getOrAllocate(defSuccessor)
			distance := pdfa.getDistance(state, qLen)
			stateBuilder, err := dfaBuilder.addState(uint32(stateID), defSuccessorID, distance)

			if err != nil {
				return nil, fmt.Errorf("parametric_dfa: buildDfa, err: %v", err)
			}

			alphabet.resetNext()
			chr, cv, err := alphabet.next()
			for err == nil {
				chi := cv.shiftAndMask(state.offset, mask)

				transition := pdfa.transition(state, chi)

				destState := transition.apply(state)

				destStateID := psi.getOrAllocate(destState)

				stateBuilder.addTransition(chr, destStateID)

				chr, cv, err = alphabet.next()
			}
		}
	}

	if stateID == StateLimit {
		return nil, ErrTooManyStates
	}

	dfaBuilder.setInitialState(initialStateID)
	return dfaBuilder.build(distance), nil
}

func fromNfa(nfa *LevenshteinNFA) (*ParametricDFA, error) {
	lookUp := newHash()
	lookUp.getOrAllocate(*newMultiState())
	initialState := nfa.initialStates()
	lookUp.getOrAllocate(*initialState)

	maxDistance := nfa.maxDistance()
	msDiameter := nfa.msDiameter()

	numChi := 1 << msDiameter
	chiValues := make([]uint64, numChi)
	for i := 0; i < numChi; i++ {
		chiValues[i] = uint64(i)
	}

	transitions := make([]Transition, 0, numChi*int(msDiameter))
	var stateID int
	for stateID = 0; stateID < StateLimit; stateID++ {
		if stateID == len(lookUp.items) {
			break
		}

		for _, chi := range chiValues {
			destMs := newMultiState()

			ms := lookUp.getFromID(stateID)

			nfa.transition(ms, destMs, chi)

			translation := destMs.normalize()

			destID := lookUp.getOrAllocate(*destMs)

			transitions = append(transitions, Transition{
				destShapeID: uint32(destID),
				deltaOffset: translation,
			})
		}
	}

	if stateID == StateLimit {
		return nil, ErrTooManyStates
	}

	ns := len(lookUp.items)
	diameter := int(msDiameter)

	distances := make([]uint8, 0, diameter*ns)
	for stateID := 0; stateID < ns; stateID++ {
		ms := lookUp.getFromID(stateID)
		for offset := 0; offset < diameter; offset++ {
			dist := nfa.multistateDistance(ms, uint32(offset))
			distances = append(distances, dist.distance())
		}
	}

	return &ParametricDFA{
		diameter:         uint32(msDiameter),
		transitions:      transitions,
		maxDistance:      maxDistance,
		transitionStride: uint32(numChi),
		distance:         distances,
	}, nil
}

type hash struct {
	index map[[16]byte]int
	items []MultiState
}

func newHash() *hash {
	return &hash{
		index: make(map[[16]byte]int, 100),
		items: make([]MultiState, 0, 100),
	}
}

func (h *hash) getOrAllocate(m MultiState) int {
	size := len(h.items)
	var exists bool
	var pos int
	md5 := getHash(&m)
	if pos, exists = h.index[md5]; !exists {
		h.index[md5] = size
		pos = size
		h.items = append(h.items, m)
	}
	return pos
}

func (h *hash) getFromID(id int) *MultiState {
	return &h.items[id]
}

func getHash(ms *MultiState) [16]byte {
	msBytes := []byte{}
	for _, state := range ms.states {
		jsonBytes, _ := json.Marshal(&state)
		msBytes = append(msBytes, jsonBytes...)
	}
	return md5.Sum(msBytes)
}
