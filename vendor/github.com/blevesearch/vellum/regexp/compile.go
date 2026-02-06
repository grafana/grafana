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
	"regexp/syntax"
	"unicode"

	unicode_utf8 "unicode/utf8"

	"github.com/blevesearch/vellum/utf8"
)

type compiler struct {
	sizeLimit uint
	insts     prog
	instsPool []inst

	sequences  utf8.Sequences
	rangeStack utf8.RangeStack
	startBytes []byte
	endBytes   []byte
}

func newCompiler(sizeLimit uint) *compiler {
	return &compiler{
		sizeLimit:  sizeLimit,
		startBytes: make([]byte, unicode_utf8.UTFMax),
		endBytes:   make([]byte, unicode_utf8.UTFMax),
	}
}

func (c *compiler) compile(ast *syntax.Regexp) (prog, error) {
	err := c.c(ast)
	if err != nil {
		return nil, err
	}
	inst := c.allocInst()
	inst.op = OpMatch
	c.insts = append(c.insts, inst)
	return c.insts, nil
}

func (c *compiler) c(ast *syntax.Regexp) (err error) {
	if ast.Flags&syntax.NonGreedy > 1 {
		return ErrNoLazy
	}

	switch ast.Op {
	case syntax.OpEndLine, syntax.OpBeginLine,
		syntax.OpBeginText, syntax.OpEndText:
		return ErrNoEmpty
	case syntax.OpWordBoundary, syntax.OpNoWordBoundary:
		return ErrNoWordBoundary
	case syntax.OpEmptyMatch:
		return nil
	case syntax.OpLiteral:
		for _, r := range ast.Rune {
			if ast.Flags&syntax.FoldCase > 0 {
				next := syntax.Regexp{
					Op:    syntax.OpCharClass,
					Flags: ast.Flags & syntax.FoldCase,
					Rune0: [2]rune{r, r},
				}
				next.Rune = next.Rune0[0:2]
				// try to find more folded runes
				for r1 := unicode.SimpleFold(r); r1 != r; r1 = unicode.SimpleFold(r1) {
					next.Rune = append(next.Rune, r1, r1)
				}
				err = c.c(&next)
				if err != nil {
					return err
				}
			} else {
				c.sequences, c.rangeStack, err = utf8.NewSequencesPrealloc(
					r, r, c.sequences, c.rangeStack, c.startBytes, c.endBytes)
				if err != nil {
					return err
				}
				for _, seq := range c.sequences {
					c.compileUtf8Ranges(seq)
				}
			}
		}
	case syntax.OpAnyChar:
		next := syntax.Regexp{
			Op:    syntax.OpCharClass,
			Flags: ast.Flags & syntax.FoldCase,
			Rune0: [2]rune{0, unicode.MaxRune},
		}
		next.Rune = next.Rune0[:2]
		return c.c(&next)
	case syntax.OpAnyCharNotNL:
		next := syntax.Regexp{
			Op:    syntax.OpCharClass,
			Flags: ast.Flags & syntax.FoldCase,
			Rune:  []rune{0, 0x09, 0x0B, unicode.MaxRune},
		}
		return c.c(&next)
	case syntax.OpCharClass:
		return c.compileClass(ast)
	case syntax.OpCapture:
		return c.c(ast.Sub[0])
	case syntax.OpConcat:
		for _, sub := range ast.Sub {
			err := c.c(sub)
			if err != nil {
				return err
			}
		}
		return nil
	case syntax.OpAlternate:
		if len(ast.Sub) == 0 {
			return nil
		}
		jmpsToEnd := make([]uint, 0, len(ast.Sub)-1)
		// does not handle last entry
		for i := 0; i < len(ast.Sub)-1; i++ {
			sub := ast.Sub[i]
			split := c.emptySplit()
			j1 := c.top()
			err := c.c(sub)
			if err != nil {
				return err
			}
			jmpsToEnd = append(jmpsToEnd, c.emptyJump())
			j2 := c.top()
			c.setSplit(split, j1, j2)
		}
		// handle last entry
		err := c.c(ast.Sub[len(ast.Sub)-1])
		if err != nil {
			return err
		}
		end := uint(len(c.insts))
		for _, jmpToEnd := range jmpsToEnd {
			c.setJump(jmpToEnd, end)
		}
	case syntax.OpQuest:
		split := c.emptySplit()
		j1 := c.top()
		err := c.c(ast.Sub[0])
		if err != nil {
			return err
		}
		j2 := c.top()
		c.setSplit(split, j1, j2)

	case syntax.OpStar:
		j1 := c.top()
		split := c.emptySplit()
		j2 := c.top()
		err := c.c(ast.Sub[0])
		if err != nil {
			return err
		}
		jmp := c.emptyJump()
		j3 := uint(len(c.insts))

		c.setJump(jmp, j1)
		c.setSplit(split, j2, j3)

	case syntax.OpPlus:
		j1 := c.top()
		err := c.c(ast.Sub[0])
		if err != nil {
			return err
		}
		split := c.emptySplit()
		j2 := c.top()
		c.setSplit(split, j1, j2)

	case syntax.OpRepeat:
		if ast.Max == -1 {
			for i := 0; i < ast.Min; i++ {
				err := c.c(ast.Sub[0])
				if err != nil {
					return err
				}
			}
			next := syntax.Regexp{
				Op:    syntax.OpStar,
				Flags: ast.Flags,
				Sub:   ast.Sub,
				Sub0:  ast.Sub0,
				Rune:  ast.Rune,
				Rune0: ast.Rune0,
			}
			return c.c(&next)
		}
		for i := 0; i < ast.Min; i++ {
			err := c.c(ast.Sub[0])
			if err != nil {
				return err
			}
		}
		splits := make([]uint, 0, ast.Max-ast.Min)
		starts := make([]uint, 0, ast.Max-ast.Min)
		for i := ast.Min; i < ast.Max; i++ {
			splits = append(splits, c.emptySplit())
			starts = append(starts, uint(len(c.insts)))
			err := c.c(ast.Sub[0])
			if err != nil {
				return err
			}
		}
		end := uint(len(c.insts))
		for i := 0; i < len(splits); i++ {
			c.setSplit(splits[i], starts[i], end)
		}

	}

	return c.checkSize()
}

func (c *compiler) checkSize() error {
	if uint(len(c.insts)*instSize) > c.sizeLimit {
		return ErrCompiledTooBig
	}
	return nil
}

func (c *compiler) compileClass(ast *syntax.Regexp) error {
	if len(ast.Rune) == 0 {
		return nil
	}
	jmps := make([]uint, 0, len(ast.Rune)-2)
	// does not do last pair
	for i := 0; i < len(ast.Rune)-2; i += 2 {
		rstart := ast.Rune[i]
		rend := ast.Rune[i+1]

		split := c.emptySplit()
		j1 := c.top()
		err := c.compileClassRange(rstart, rend)
		if err != nil {
			return err
		}
		jmps = append(jmps, c.emptyJump())
		j2 := c.top()
		c.setSplit(split, j1, j2)
	}
	// handle last pair
	rstart := ast.Rune[len(ast.Rune)-2]
	rend := ast.Rune[len(ast.Rune)-1]
	err := c.compileClassRange(rstart, rend)
	if err != nil {
		return err
	}
	end := c.top()
	for _, jmp := range jmps {
		c.setJump(jmp, end)
	}
	return nil
}

func (c *compiler) compileClassRange(startR, endR rune) (err error) {
	c.sequences, c.rangeStack, err = utf8.NewSequencesPrealloc(
		startR, endR, c.sequences, c.rangeStack, c.startBytes, c.endBytes)
	if err != nil {
		return err
	}
	jmps := make([]uint, 0, len(c.sequences)-1)
	// does not do last entry
	for i := 0; i < len(c.sequences)-1; i++ {
		seq := c.sequences[i]
		split := c.emptySplit()
		j1 := c.top()
		c.compileUtf8Ranges(seq)
		jmps = append(jmps, c.emptyJump())
		j2 := c.top()
		c.setSplit(split, j1, j2)
	}
	// handle last entry
	c.compileUtf8Ranges(c.sequences[len(c.sequences)-1])
	end := c.top()
	for _, jmp := range jmps {
		c.setJump(jmp, end)
	}

	return nil
}

func (c *compiler) compileUtf8Ranges(seq utf8.Sequence) {
	for _, r := range seq {
		inst := c.allocInst()
		inst.op = OpRange
		inst.rangeStart = r.Start
		inst.rangeEnd = r.End
		c.insts = append(c.insts, inst)
	}
}

func (c *compiler) emptySplit() uint {
	inst := c.allocInst()
	inst.op = OpSplit
	c.insts = append(c.insts, inst)
	return c.top() - 1
}

func (c *compiler) emptyJump() uint {
	inst := c.allocInst()
	inst.op = OpJmp
	c.insts = append(c.insts, inst)
	return c.top() - 1
}

func (c *compiler) setSplit(i, pc1, pc2 uint) {
	split := c.insts[i]
	split.splitA = pc1
	split.splitB = pc2
}

func (c *compiler) setJump(i, pc uint) {
	jmp := c.insts[i]
	jmp.to = pc
}

func (c *compiler) top() uint {
	return uint(len(c.insts))
}

func (c *compiler) allocInst() *inst {
	if len(c.instsPool) <= 0 {
		c.instsPool = make([]inst, 16)
	}
	inst := &c.instsPool[0]
	c.instsPool = c.instsPool[1:]
	return inst
}
