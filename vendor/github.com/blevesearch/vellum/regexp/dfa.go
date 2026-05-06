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

import (
	"encoding/binary"
	"fmt"
)

// StateLimit is the maximum number of states allowed
const StateLimit = 10000

// ErrTooManyStates is returned if you attempt to build a Levenshtein
// automaton which requires too many states.
var ErrTooManyStates = fmt.Errorf("dfa contains more than %d states",
	StateLimit)

type dfaBuilder struct {
	dfa    *dfa
	cache  map[string]int
	keyBuf []byte
}

func newDfaBuilder(insts prog) *dfaBuilder {
	d := &dfaBuilder{
		dfa: &dfa{
			insts:  insts,
			states: make([]state, 0, 16),
		},
		cache: make(map[string]int, 1024),
	}
	// add 0 state that is invalid
	d.dfa.states = append(d.dfa.states, state{
		next:  make([]int, 256),
		match: false,
	})
	return d
}

func (d *dfaBuilder) build() (*dfa, error) {
	cur := newSparseSet(uint(len(d.dfa.insts)))
	next := newSparseSet(uint(len(d.dfa.insts)))

	d.dfa.add(cur, 0)
	ns, instsReuse := d.cachedState(cur, nil)
	states := intStack{ns}
	seen := make(map[int]struct{})
	var s int
	states, s = states.Pop()
	for s != 0 {
		for b := 0; b < 256; b++ {
			var ns int
			ns, instsReuse = d.runState(cur, next, s, byte(b), instsReuse)
			if ns != 0 {
				if _, ok := seen[ns]; !ok {
					seen[ns] = struct{}{}
					states = states.Push(ns)
				}
			}
			if len(d.dfa.states) > StateLimit {
				return nil, ErrTooManyStates
			}
		}
		states, s = states.Pop()
	}
	return d.dfa, nil
}

func (d *dfaBuilder) runState(cur, next *sparseSet, state int, b byte, instsReuse []uint) (
	int, []uint) {
	cur.Clear()
	for _, ip := range d.dfa.states[state].insts {
		cur.Add(ip)
	}
	d.dfa.run(cur, next, b)
	var nextState int
	nextState, instsReuse = d.cachedState(next, instsReuse)
	d.dfa.states[state].next[b] = nextState
	return nextState, instsReuse
}

func instsKey(insts []uint, buf []byte) []byte {
	if cap(buf) < 8*len(insts) {
		buf = make([]byte, 8*len(insts))
	} else {
		buf = buf[0 : 8*len(insts)]
	}
	for i, inst := range insts {
		binary.LittleEndian.PutUint64(buf[i*8:], uint64(inst))
	}
	return buf
}

func (d *dfaBuilder) cachedState(set *sparseSet,
	instsReuse []uint) (int, []uint) {
	insts := instsReuse[:0]
	if cap(insts) == 0 {
		insts = make([]uint, 0, set.Len())
	}
	var isMatch bool
	for i := uint(0); i < uint(set.Len()); i++ {
		ip := set.Get(i)
		switch d.dfa.insts[ip].op {
		case OpRange:
			insts = append(insts, ip)
		case OpMatch:
			isMatch = true
			insts = append(insts, ip)
		}
	}
	if len(insts) == 0 {
		return 0, insts
	}
	d.keyBuf = instsKey(insts, d.keyBuf)
	v, ok := d.cache[string(d.keyBuf)]
	if ok {
		return v, insts
	}
	d.dfa.states = append(d.dfa.states, state{
		insts: insts,
		next:  make([]int, 256),
		match: isMatch,
	})
	newV := len(d.dfa.states) - 1
	d.cache[string(d.keyBuf)] = newV
	return newV, nil
}

type dfa struct {
	insts  prog
	states []state
}

func (d *dfa) add(set *sparseSet, ip uint) {
	if set.Contains(ip) {
		return
	}
	set.Add(ip)
	switch d.insts[ip].op {
	case OpJmp:
		d.add(set, d.insts[ip].to)
	case OpSplit:
		d.add(set, d.insts[ip].splitA)
		d.add(set, d.insts[ip].splitB)
	}
}

func (d *dfa) run(from, to *sparseSet, b byte) bool {
	to.Clear()
	var isMatch bool
	for i := uint(0); i < uint(from.Len()); i++ {
		ip := from.Get(i)
		switch d.insts[ip].op {
		case OpMatch:
			isMatch = true
		case OpRange:
			if d.insts[ip].rangeStart <= b &&
				b <= d.insts[ip].rangeEnd {
				d.add(to, ip+1)
			}
		}
	}
	return isMatch
}

type state struct {
	insts []uint
	next  []int
	match bool
}

type intStack []int

func (s intStack) Push(v int) intStack {
	return append(s, v)
}

func (s intStack) Pop() (intStack, int) {
	l := len(s)
	if l < 1 {
		return s, 0
	}
	return s[:l-1], s[l-1]
}
