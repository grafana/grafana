// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"bytes"
	"fmt"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/hashicorp/hcl/v2"
)

// This is set to true at init() time in tests, to enable more useful output
// if a stack discipline error is detected. It should not be enabled in
// normal mode since there is a performance penalty from accessing the
// runtime stack to produce the traces, but could be temporarily set to
// true for debugging if desired.
var tracePeekerNewlinesStack = false

type peeker struct {
	Tokens    Tokens
	NextIndex int

	IncludeComments      bool
	IncludeNewlinesStack []bool

	// used only when tracePeekerNewlinesStack is set
	newlineStackChanges []peekerNewlineStackChange
}

// for use in debugging the stack usage only
type peekerNewlineStackChange struct {
	Pushing bool // if false, then popping
	Frame   runtime.Frame
	Include bool
}

func newPeeker(tokens Tokens, includeComments bool) *peeker {
	return &peeker{
		Tokens:          tokens,
		IncludeComments: includeComments,

		IncludeNewlinesStack: []bool{true},
	}
}

func (p *peeker) Peek() Token {
	ret, _ := p.nextToken()
	return ret
}

func (p *peeker) Read() Token {
	ret, nextIdx := p.nextToken()
	p.NextIndex = nextIdx
	return ret
}

func (p *peeker) NextRange() hcl.Range {
	return p.Peek().Range
}

func (p *peeker) PrevRange() hcl.Range {
	if p.NextIndex == 0 {
		return p.NextRange()
	}

	return p.Tokens[p.NextIndex-1].Range
}

func (p *peeker) nextToken() (Token, int) {
	for i := p.NextIndex; i < len(p.Tokens); i++ {
		tok := p.Tokens[i]
		switch tok.Type {
		case TokenComment:
			if !p.IncludeComments {
				// Single-line comment tokens, starting with # or //, absorb
				// the trailing newline that terminates them as part of their
				// bytes. When we're filtering out comments, we must as a
				// special case transform these to newline tokens in order
				// to properly parse newline-terminated block items.

				if p.includingNewlines() {
					if len(tok.Bytes) > 0 && tok.Bytes[len(tok.Bytes)-1] == '\n' {
						fakeNewline := Token{
							Type:  TokenNewline,
							Bytes: tok.Bytes[len(tok.Bytes)-1 : len(tok.Bytes)],

							// We use the whole token range as the newline
							// range, even though that's a little... weird,
							// because otherwise we'd need to go count
							// characters again in order to figure out the
							// column of the newline, and that complexity
							// isn't justified when ranges of newlines are
							// so rarely printed anyway.
							Range: tok.Range,
						}
						return fakeNewline, i + 1
					}
				}

				continue
			}
		case TokenNewline:
			if !p.includingNewlines() {
				continue
			}
		}

		return tok, i + 1
	}

	// if we fall out here then we'll return the EOF token, and leave
	// our index pointed off the end of the array so we'll keep
	// returning EOF in future too.
	return p.Tokens[len(p.Tokens)-1], len(p.Tokens)
}

func (p *peeker) includingNewlines() bool {
	return p.IncludeNewlinesStack[len(p.IncludeNewlinesStack)-1]
}

func (p *peeker) PushIncludeNewlines(include bool) {
	if tracePeekerNewlinesStack {
		// Record who called us so that we can more easily track down any
		// mismanagement of the stack in the parser.
		callers := []uintptr{0}
		runtime.Callers(2, callers)
		frames := runtime.CallersFrames(callers)
		frame, _ := frames.Next()
		p.newlineStackChanges = append(p.newlineStackChanges, peekerNewlineStackChange{
			true, frame, include,
		})
	}

	p.IncludeNewlinesStack = append(p.IncludeNewlinesStack, include)
}

func (p *peeker) PopIncludeNewlines() bool {
	stack := p.IncludeNewlinesStack
	remain, ret := stack[:len(stack)-1], stack[len(stack)-1]
	p.IncludeNewlinesStack = remain

	if tracePeekerNewlinesStack {
		// Record who called us so that we can more easily track down any
		// mismanagement of the stack in the parser.
		callers := []uintptr{0}
		runtime.Callers(2, callers)
		frames := runtime.CallersFrames(callers)
		frame, _ := frames.Next()
		p.newlineStackChanges = append(p.newlineStackChanges, peekerNewlineStackChange{
			false, frame, ret,
		})
	}

	return ret
}

// AssertEmptyNewlinesStack checks if the IncludeNewlinesStack is empty, doing
// panicking if it is not. This can be used to catch stack mismanagement that
// might otherwise just cause confusing downstream errors.
//
// This function is a no-op if the stack is empty when called.
//
// If newlines stack tracing is enabled by setting the global variable
// tracePeekerNewlinesStack at init time, a full log of all of the push/pop
// calls will be produced to help identify which caller in the parser is
// misbehaving.
func (p *peeker) AssertEmptyIncludeNewlinesStack() {
	if len(p.IncludeNewlinesStack) != 1 {
		// Should never happen; indicates mismanagement of the stack inside
		// the parser.
		if p.newlineStackChanges != nil { // only if traceNewlinesStack is enabled above
			panic(fmt.Errorf(
				"non-empty IncludeNewlinesStack after parse with %d calls unaccounted for:\n%s",
				len(p.IncludeNewlinesStack)-1,
				formatPeekerNewlineStackChanges(p.newlineStackChanges),
			))
		} else {
			panic(fmt.Errorf("non-empty IncludeNewlinesStack after parse: %#v", p.IncludeNewlinesStack))
		}
	}
}

func formatPeekerNewlineStackChanges(changes []peekerNewlineStackChange) string {
	indent := 0
	var buf bytes.Buffer
	for _, change := range changes {
		funcName := change.Frame.Function
		if idx := strings.LastIndexByte(funcName, '.'); idx != -1 {
			funcName = funcName[idx+1:]
		}
		filename := change.Frame.File
		if idx := strings.LastIndexByte(filename, filepath.Separator); idx != -1 {
			filename = filename[idx+1:]
		}

		switch change.Pushing {

		case true:
			buf.WriteString(strings.Repeat("    ", indent))
			fmt.Fprintf(&buf, "PUSH %#v (%s at %s:%d)\n", change.Include, funcName, filename, change.Frame.Line)
			indent++

		case false:
			indent--
			buf.WriteString(strings.Repeat("    ", indent))
			fmt.Fprintf(&buf, "POP %#v (%s at %s:%d)\n", change.Include, funcName, filename, change.Frame.Line)

		}
	}
	return buf.String()
}
