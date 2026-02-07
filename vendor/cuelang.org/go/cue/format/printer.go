// Copyright 2018 The CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package format

import (
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
)

// A printer takes the stream of formatting tokens and spacing directives
// produced by the formatter and adjusts the spacing based on the original
// source code.
type printer struct {
	cfg *config

	allowed     whiteSpace
	requested   whiteSpace
	indentStack []whiteSpace

	pos     token.Position // current pos in AST
	lineout line

	lastTok token.Token // last token printed (syntax.ILLEGAL if it's whitespace)

	output      []byte
	indent      int
	spaceBefore bool

	errs errors.Error
}

type line int

func (p *printer) init(cfg *config) {
	p.cfg = cfg
	p.pos = token.Position{Line: 1, Column: 1}
}

func (p *printer) errf(n ast.Node, format string, args ...interface{}) {
	p.errs = errors.Append(p.errs, errors.Newf(n.Pos(), format, args...))
}

const debug = false

func (p *printer) internalError(msg ...interface{}) {
	if debug {
		fmt.Print(p.pos.String() + ": ")
		fmt.Println(msg...)
		panic("go/printer")
	}
}

func (p *printer) lineFor(pos token.Pos) int {
	return pos.Line()
}

func (p *printer) Print(v interface{}) {
	var (
		impliedComma = false
		isLit        bool
		data         string
		nextWS       whiteSpace
	)
	switch x := v.(type) {
	case *line:
		*x = p.lineout

	case token.Token:
		s := x.String()
		before, after := mayCombine(p.lastTok, x)
		if before && !p.spaceBefore {
			// the previous and the current token must be
			// separated by a blank otherwise they combine
			// into a different incorrect token sequence
			// (except for syntax.INT followed by a '.' this
			// should never happen because it is taken care
			// of via binary expression formatting)
			if p.allowed&blank != 0 {
				p.internalError("whitespace buffer not empty")
			}
			p.allowed |= blank
		}
		if after {
			nextWS = blank
		}
		data = s
		switch x {
		case token.EOF:
			data = ""
			p.allowed = newline
			p.allowed &^= newsection
		case token.LPAREN, token.LBRACK, token.LBRACE:
		case token.RPAREN, token.RBRACK, token.RBRACE:
			impliedComma = true
		}
		p.lastTok = x

	case *ast.BasicLit:
		data = x.Value
		switch x.Kind {
		case token.STRING:
			// TODO: only do this when simplifying. Right now this does not
			// give the right result, but it should be better if:
			// 1) simplification is done as a separate step
			// 2) simplified structs are explicitly referenced separately
			//    in the AST.
			if p.indent < 6 {
				data = literal.IndentTabs(data, p.cfg.Indent+p.indent+1)
			}

		case token.INT:
			if len(data) > 1 &&
				data[0] == '0' &&
				data[1] >= '0' && data[1] <= '9' {
				data = "0o" + data[1:]
			}
			// Pad trailing dot before multiplier.
			if p := strings.IndexByte(data, '.'); p >= 0 && data[p+1] > '9' {
				data = data[:p+1] + "0" + data[p+1:]
			}
			// Lowercase E, but only if it is not the last character: in the
			// future we may use E for Exa.
			if p := strings.IndexByte(data, 'E'); p != -1 && p < len(data)-1 {
				data = strings.ToLower(data)
			}

		case token.FLOAT:
			// Pad leading or trailing dots.
			switch p := strings.IndexByte(data, '.'); {
			case p < 0:
			case p == 0:
				data = "0" + data
			case p == len(data)-1:
				data += "0"
			case data[p+1] > '9':
				data = data[:p+1] + "0" + data[p+1:]
			}
			if strings.IndexByte(data, 'E') != -1 {
				data = strings.ToLower(data)
			}
		}

		isLit = true
		impliedComma = true
		p.lastTok = x.Kind

	case *ast.Ident:
		data = x.Name
		if !ast.IsValidIdent(data) {
			p.errf(x, "invalid identifier %q", x.Name)
			data = "*bad identifier*"
		}
		impliedComma = true
		p.lastTok = token.IDENT

	case string:
		// We can print a Go string as part of a CUE identifier or literal;
		// for example, see the formatter.label method.
		isLit = true
		data = x
		impliedComma = true
		p.lastTok = token.STRING

	case *ast.CommentGroup:
		rel := x.Pos().RelPos()
		if x.Line { // TODO: we probably don't need this.
			rel = token.Blank
		}
		switch rel {
		case token.NoRelPos:
		case token.Newline, token.NewSection:
		case token.Blank, token.Elided:
			p.allowed |= blank
			fallthrough
		case token.NoSpace:
			p.allowed &^= newline | newsection | formfeed | declcomma
		}
		return

	case *ast.Attribute:
		isLit = true
		data = x.Text
		impliedComma = true
		p.lastTok = token.ATTRIBUTE

	case *ast.Comment:
		// TODO: if implied comma, postpone comment
		isLit = true
		data = x.Text
		p.lastTok = token.COMMENT

	case whiteSpace:
		p.allowed |= x
		return

	case token.Pos:
		// TODO: should we use a known file position to synchronize? Go does,
		// but we don't really have to.
		// pos := x
		if x.HasRelPos() {
			if p.allowed&nooverride == 0 {
				requested := p.allowed
				switch x.RelPos() {
				case token.NoSpace:
					requested &^= newline | newsection | formfeed
				case token.Blank:
					requested |= blank
					requested &^= newline | newsection | formfeed
				case token.Newline:
					requested |= newline
				case token.NewSection:
					requested |= newsection
				}
				p.writeWhitespace(requested)
				p.allowed = 0
				p.requested = 0
			}
			// p.pos = pos
		}
		return

	default:
		fmt.Fprintf(os.Stderr, "print: unsupported argument %v (%T)\n", x, x)
		panic("go/printer type")
	}

	p.writeWhitespace(p.allowed)
	p.allowed = 0
	p.requested = 0
	p.writeString(data, isLit)
	p.allowed = nextWS
	_ = impliedComma // TODO: delay comment printings
}

func (p *printer) writeWhitespace(ws whiteSpace) {
	if ws&comma != 0 {
		switch {
		case ws&(newsection|newline|formfeed) != 0,
			ws&trailcomma == 0:
			p.writeByte(',', 1)
		}
	}
	if ws&indent != 0 {
		p.markLineIndent(ws)
	}
	if ws&unindent != 0 {
		p.markUnindentLine()
	}
	switch {
	case ws&newsection != 0:
		p.maybeIndentLine(ws)
		p.writeByte('\f', 2)
		p.lineout += 2
		p.spaceBefore = true
	case ws&formfeed != 0:
		p.maybeIndentLine(ws)
		p.writeByte('\f', 1)
		p.lineout++
		p.spaceBefore = true
	case ws&newline != 0:
		p.maybeIndentLine(ws)
		p.writeByte('\n', 1)
		p.lineout++
		p.spaceBefore = true
	case ws&declcomma != 0:
		p.writeByte(',', 1)
		p.writeByte(' ', 1)
		p.spaceBefore = true
	case ws&noblank != 0:
	case ws&vtab != 0:
		p.writeByte('\v', 1)
		p.spaceBefore = true
	case ws&blank != 0:
		p.writeByte(' ', 1)
		p.spaceBefore = true
	}
}

func (p *printer) markLineIndent(ws whiteSpace) {
	p.indentStack = append(p.indentStack, ws)
}

func (p *printer) markUnindentLine() (wasUnindented bool) {
	last := len(p.indentStack) - 1
	if ws := p.indentStack[last]; ws&indented != 0 {
		p.indent--
		wasUnindented = true
	}
	p.indentStack = p.indentStack[:last]
	return wasUnindented
}

func (p *printer) maybeIndentLine(ws whiteSpace) {
	if ws&unindent == 0 && len(p.indentStack) > 0 {
		last := len(p.indentStack) - 1
		if ws := p.indentStack[last]; ws&indented != 0 || ws&indent == 0 {
			return
		}
		p.indentStack[last] |= indented
		p.indent++
	}
}

func (f *formatter) matchUnindent() whiteSpace {
	f.allowed |= unindent
	// TODO: make this work. Whitespace from closing bracket should match that
	// of opening if there is no position information.
	// f.allowed &^= nooverride | newline | newsection | formfeed | blank | noblank
	// ws := f.indentStack[len(f.indentStack)-1]
	// mask := blank | noblank | vtab
	// f.allowed |= unindent | blank | noblank
	// if ws&newline != 0 || ws*indented != 0 {
	// 	f.allowed |= newline
	// }
	return 0
}

// writeString writes the string s to p.output and updates p.pos, p.out,
// and p.last. If isLit is set, s is escaped w/ tabwriter.Escape characters
// to protect s from being interpreted by the tabwriter.
//
// Note: writeString is only used to write Go tokens, literals, and
// comments, all of which must be written literally. Thus, it is correct
// to always set isLit = true. However, setting it explicitly only when
// needed (i.e., when we don't know that s contains no tabs or line breaks)
// avoids processing extra escape characters and reduces run time of the
// printer benchmark by up to 10%.
func (p *printer) writeString(s string, isLit bool) {
	if s != "" {
		p.spaceBefore = false
	}

	if isLit {
		// Protect s such that is passes through the tabwriter
		// unchanged. Note that valid Go programs cannot contain
		// tabwriter.Escape bytes since they do not appear in legal
		// UTF-8 sequences.
		p.output = append(p.output, tabwriter.Escape)
	}

	p.output = append(p.output, s...)

	if isLit {
		p.output = append(p.output, tabwriter.Escape)
	}
	// update positions
	nLines := 0
	var li int // index of last newline; valid if nLines > 0
	for i := 0; i < len(s); i++ {
		// CUE tokens cannot contain '\f' - no need to look for it
		if s[i] == '\n' {
			nLines++
			li = i
		}
	}
	p.pos.Offset += len(s)
	if nLines > 0 {
		p.pos.Line += nLines
		c := len(s) - li
		p.pos.Column = c
	} else {
		p.pos.Column += len(s)
	}
}

func (p *printer) writeByte(ch byte, n int) {
	for i := 0; i < n; i++ {
		p.output = append(p.output, ch)
	}

	// update positions
	p.pos.Offset += n
	if ch == '\n' || ch == '\f' {
		p.pos.Line += n
		p.pos.Column = 1

		n := p.cfg.Indent + p.indent // include base indentation
		for i := 0; i < n; i++ {
			p.output = append(p.output, '\t')
		}

		// update positions
		p.pos.Offset += n
		p.pos.Column += n

		return
	}
	p.pos.Column += n
}

func mayCombine(prev, next token.Token) (before, after bool) {
	s := next.String()
	if 'a' <= s[0] && s[0] < 'z' {
		return true, true
	}
	switch prev {
	case token.IQUO, token.IREM, token.IDIV, token.IMOD:
		return false, false
	case token.INT:
		before = next == token.PERIOD // 1.
	case token.ADD:
		before = s[0] == '+' // ++
	case token.SUB:
		before = s[0] == '-' // --
	case token.QUO:
		before = s[0] == '*' // /*
	}
	return before, false
}
