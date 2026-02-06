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

import (
	"io"

	"github.com/bits-and-blooms/bitset"
)

// FST is an in-memory representation of a finite state transducer,
// capable of returning the uint64 value associated with
// each []byte key stored, as well as enumerating all of the keys
// in order.
type FST struct {
	f       io.Closer
	ver     int
	len     int
	typ     int
	data    []byte
	decoder decoder
}

func new(data []byte, f io.Closer) (rv *FST, err error) {
	rv = &FST{
		data: data,
		f:    f,
	}

	rv.ver, rv.typ, err = decodeHeader(data)
	if err != nil {
		return nil, err
	}

	rv.decoder, err = loadDecoder(rv.ver, rv.data)
	if err != nil {
		return nil, err
	}

	rv.len = rv.decoder.getLen()

	return rv, nil
}

// Contains returns true if this FST contains the specified key.
func (f *FST) Contains(val []byte) (bool, error) {
	_, exists, err := f.Get(val)
	return exists, err
}

// Get returns the value associated with the key.  NOTE: a value of zero
// does not imply the key does not exist, you must consult the second
// return value as well.
func (f *FST) Get(input []byte) (uint64, bool, error) {
	return f.get(input, nil)
}

func (f *FST) get(input []byte, prealloc fstState) (uint64, bool, error) {
	var total uint64
	curr := f.decoder.getRoot()
	state, err := f.decoder.stateAt(curr, prealloc)
	if err != nil {
		return 0, false, err
	}
	for _, c := range input {
		_, curr, output := state.TransitionFor(c)
		if curr == noneAddr {
			return 0, false, nil
		}

		state, err = f.decoder.stateAt(curr, state)
		if err != nil {
			return 0, false, err
		}

		total += output
	}

	if state.Final() {
		total += state.FinalOutput()
		return total, true, nil
	}
	return 0, false, nil
}

// Version returns the encoding version used by this FST instance.
func (f *FST) Version() int {
	return f.ver
}

// Len returns the number of entries in this FST instance.
func (f *FST) Len() int {
	return f.len
}

// Type returns the type of this FST instance.
func (f *FST) Type() int {
	return f.typ
}

// Close will unmap any mmap'd data (if managed by vellum) and it will close
// the backing file (if managed by vellum).  You MUST call Close() for any
// FST instance that is created.
func (f *FST) Close() error {
	if f.f != nil {
		err := f.f.Close()
		if err != nil {
			return err
		}
	}
	f.data = nil
	f.decoder = nil
	return nil
}

// Start returns the start state of this Automaton
func (f *FST) Start() int {
	return f.decoder.getRoot()
}

// IsMatch returns if this state is a matching state in this Automaton
func (f *FST) IsMatch(addr int) bool {
	match, _ := f.IsMatchWithVal(addr)
	return match
}

// CanMatch returns if this state can ever transition to a matching state
// in this Automaton
func (f *FST) CanMatch(addr int) bool {
	if addr == noneAddr {
		return false
	}
	return true
}

// WillAlwaysMatch returns if from this state the Automaton will always
// be in a matching state
func (f *FST) WillAlwaysMatch(int) bool {
	return false
}

// Accept returns the next state for this Automaton on input of byte b
func (f *FST) Accept(addr int, b byte) int {
	next, _ := f.AcceptWithVal(addr, b)
	return next
}

// IsMatchWithVal returns if this state is a matching state in this Automaton
// and also returns the final output value for this state
func (f *FST) IsMatchWithVal(addr int) (bool, uint64) {
	s, err := f.decoder.stateAt(addr, nil)
	if err != nil {
		return false, 0
	}
	return s.Final(), s.FinalOutput()
}

// AcceptWithVal returns the next state for this Automaton on input of byte b
// and also returns the output value for the transition
func (f *FST) AcceptWithVal(addr int, b byte) (int, uint64) {
	s, err := f.decoder.stateAt(addr, nil)
	if err != nil {
		return noneAddr, 0
	}
	_, next, output := s.TransitionFor(b)
	return next, output
}

// Iterator returns a new Iterator capable of enumerating the key/value pairs
// between the provided startKeyInclusive and endKeyExclusive.
func (f *FST) Iterator(startKeyInclusive, endKeyExclusive []byte) (*FSTIterator, error) {
	return newIterator(f, startKeyInclusive, endKeyExclusive, nil)
}

// Search returns a new Iterator capable of enumerating the key/value pairs
// between the provided startKeyInclusive and endKeyExclusive that also
// satisfy the provided automaton.
func (f *FST) Search(aut Automaton, startKeyInclusive, endKeyExclusive []byte) (*FSTIterator, error) {
	return newIterator(f, startKeyInclusive, endKeyExclusive, aut)
}

// Debug is only intended for debug purposes, it simply asks the underlying
// decoder visit each state, and pass it to the provided callback.
func (f *FST) Debug(callback func(int, interface{}) error) error {

	addr := f.decoder.getRoot()
	set := bitset.New(uint(addr))
	stack := addrStack{addr}

	stateNumber := 0
	stack, addr = stack[:len(stack)-1], stack[len(stack)-1]
	for addr != noneAddr {
		if set.Test(uint(addr)) {
			stack, addr = stack.Pop()
			continue
		}
		set.Set(uint(addr))
		state, err := f.decoder.stateAt(addr, nil)
		if err != nil {
			return err
		}
		err = callback(stateNumber, state)
		if err != nil {
			return err
		}
		for i := 0; i < state.NumTransitions(); i++ {
			tchar := state.TransitionAt(i)
			_, dest, _ := state.TransitionFor(tchar)
			stack = append(stack, dest)
		}
		stateNumber++
		stack, addr = stack.Pop()
	}

	return nil
}

type addrStack []int

func (a addrStack) Pop() (addrStack, int) {
	l := len(a)
	if l < 1 {
		return a, noneAddr
	}
	return a[:l-1], a[l-1]
}

// Reader() returns a Reader instance that a single thread may use to
// retrieve data from the FST
func (f *FST) Reader() (*Reader, error) {
	return &Reader{f: f}, nil
}

func (f *FST) GetMinKey() ([]byte, error) {
	var rv []byte

	curr := f.decoder.getRoot()
	state, err := f.decoder.stateAt(curr, nil)
	if err != nil {
		return nil, err
	}

	for !state.Final() {
		nextTrans := state.TransitionAt(0)
		_, curr, _ = state.TransitionFor(nextTrans)
		state, err = f.decoder.stateAt(curr, state)
		if err != nil {
			return nil, err
		}

		rv = append(rv, nextTrans)
	}

	return rv, nil
}

func (f *FST) GetMaxKey() ([]byte, error) {
	var rv []byte

	curr := f.decoder.getRoot()
	state, err := f.decoder.stateAt(curr, nil)
	if err != nil {
		return nil, err
	}

	for state.NumTransitions() > 0 {
		nextTrans := state.TransitionAt(state.NumTransitions() - 1)
		_, curr, _ = state.TransitionFor(nextTrans)
		state, err = f.decoder.stateAt(curr, state)
		if err != nil {
			return nil, err
		}

		rv = append(rv, nextTrans)
	}

	return rv, nil
}

// A Reader is meant for a single threaded use
type Reader struct {
	f        *FST
	prealloc fstStateV1
}

func (r *Reader) Get(input []byte) (uint64, bool, error) {
	return r.f.get(input, &r.prealloc)
}
