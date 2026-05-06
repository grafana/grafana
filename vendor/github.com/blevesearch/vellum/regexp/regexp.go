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
	"fmt"
	"regexp/syntax"
)

// ErrNoEmpty returned when "zero width assertions" are used
var ErrNoEmpty = fmt.Errorf("zero width assertions not allowed")

// ErrNoWordBoundary returned when word boundaries are used
var ErrNoWordBoundary = fmt.Errorf("word boundaries are not allowed")

// ErrNoBytes returned when byte literals are used
var ErrNoBytes = fmt.Errorf("byte literals are not allowed")

// ErrNoLazy returned when lazy quantifiers are used
var ErrNoLazy = fmt.Errorf("lazy quantifiers are not allowed")

// ErrCompiledTooBig returned when regular expression parses into
// too many instructions
var ErrCompiledTooBig = fmt.Errorf("too many instructions")

var DefaultLimit = uint(10 * (1 << 20))

// Regexp implements the vellum.Automaton interface for matcing a user
// specified regular expression.
type Regexp struct {
	orig string
	dfa  *dfa
}

// NewRegexp creates a new Regular Expression automaton with the specified
// expression.  By default it is limited to approximately 10MB for the
// compiled finite state automaton.  If this size is exceeded,
// ErrCompiledTooBig will be returned.
func New(expr string) (*Regexp, error) {
	return NewWithLimit(expr, DefaultLimit)
}

// NewRegexpWithLimit creates a new Regular Expression automaton with
// the specified expression.  The size of the compiled finite state
// automaton exceeds the user specified size,  ErrCompiledTooBig will be
// returned.
func NewWithLimit(expr string, size uint) (*Regexp, error) {
	parsed, err := syntax.Parse(expr, syntax.Perl)
	if err != nil {
		return nil, err
	}
	return NewParsedWithLimit(expr, parsed, size)
}

func NewParsedWithLimit(expr string, parsed *syntax.Regexp, size uint) (*Regexp, error) {
	compiler := newCompiler(size)
	insts, err := compiler.compile(parsed)
	if err != nil {
		return nil, err
	}
	dfaBuilder := newDfaBuilder(insts)
	dfa, err := dfaBuilder.build()
	if err != nil {
		return nil, err
	}
	return &Regexp{
		orig: expr,
		dfa:  dfa,
	}, nil
}

// Start returns the start state of this automaton.
func (r *Regexp) Start() int {
	return 1
}

// IsMatch returns if the specified state is a matching state.
func (r *Regexp) IsMatch(s int) bool {
	if s < len(r.dfa.states) {
		return r.dfa.states[s].match
	}
	return false
}

// CanMatch returns if the specified state can ever transition to a matching
// state.
func (r *Regexp) CanMatch(s int) bool {
	if s < len(r.dfa.states) && s > 0 {
		return true
	}
	return false
}

// WillAlwaysMatch returns if the specified state will always end in a
// matching state.
func (r *Regexp) WillAlwaysMatch(int) bool {
	return false
}

// Accept returns the new state, resulting from the transition byte b
// when currently in the state s.
func (r *Regexp) Accept(s int, b byte) int {
	if s < len(r.dfa.states) {
		return r.dfa.states[s].next[b]
	}
	return 0
}

func (r *Regexp) MatchesRegex(input string) bool {
	currentState := r.Start()
	index := 0
	// Traverse the DFA while characters can still match
	for r.CanMatch(currentState) && index < len(input) {
		currentState = r.Accept(currentState, input[index])
		index++
	}
	return index == len(input) && r.IsMatch(currentState)
}
