//  Copyright (c) 2020 Couchbase, Inc.
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

package token

import (
	"github.com/blugelabs/bluge/analysis"
)

func (p *Parser) buildTokenFromTerm(buffer []rune) *analysis.Token {
	term := analysis.BuildTermFromRunes(buffer)
	token := &analysis.Token{
		Term:         term,
		PositionIncr: 1,
		Start:        p.index,
		End:          p.index + len(term),
	}
	p.index += len(term)
	return token
}

// Parser accepts a symbol and passes it to the current state (representing a class).
// The state can accept it (and accumulate it). Otherwise, the parser creates a new state that
// starts with the pushed symbol.
//
// Parser accumulates a new resulting token every time it switches state.
// Use FlushTokens() to get the results after the last symbol was pushed.
type Parser struct {
	bufferLen int
	buffer    []rune
	current   State
	tokens    []*analysis.Token
	index     int
}

func NewParser(length, index int) *Parser {
	return &Parser{
		bufferLen: length,
		buffer:    make([]rune, 0, length),
		tokens:    make([]*analysis.Token, 0, length),
		index:     index,
	}
}

func (p *Parser) Push(sym rune, peek *rune) {
	if p.current == nil {
		// the start of parsing
		p.current = p.NewState(sym)
		p.buffer = append(p.buffer, sym)
	} else if p.current.Member(sym, peek) {
		// same state, just accumulate
		p.buffer = append(p.buffer, sym)
	} else {
		// the old state is no more, thus convert the buffer
		p.tokens = append(p.tokens, p.buildTokenFromTerm(p.buffer))

		// let the new state begin
		p.current = p.NewState(sym)
		p.buffer = make([]rune, 0, p.bufferLen)
		p.buffer = append(p.buffer, sym)
	}
}

// Note. States have to have different starting symbols.
func (p *Parser) NewState(sym rune) State {
	var found State

	found = &LowerCaseState{}
	if found.StartSym(sym) {
		return found
	}

	found = &UpperCaseState{}
	if found.StartSym(sym) {
		return found
	}

	found = &NumberCaseState{}
	if found.StartSym(sym) {
		return found
	}

	return &NonAlphaNumericCaseState{}
}

func (p *Parser) FlushTokens() []*analysis.Token {
	p.tokens = append(p.tokens, p.buildTokenFromTerm(p.buffer))
	return p.tokens
}
