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

package parser

import (
	"fmt"
	"strings"
	"unicode"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/scanner"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/astinternal"
)

var debugStr = astinternal.DebugStr

// The parser structure holds the parser's internal state.
type parser struct {
	file    *token.File
	offset  int
	errors  errors.Error
	scanner scanner.Scanner

	// Tracing/debugging
	mode      mode // parsing mode
	trace     bool // == (mode & Trace != 0)
	panicking bool // set if we are bailing out due to too many errors.
	indent    int  // indentation used for tracing output

	// Comments
	leadComment *ast.CommentGroup
	comments    *commentState

	// Next token
	pos token.Pos   // token position
	tok token.Token // one token look-ahead
	lit string      // token literal

	// Error recovery
	// (used to limit the number of calls to syncXXX functions
	// w/o making scanning progress - avoids potential endless
	// loops across multiple parser functions during error recovery)
	syncPos token.Pos // last synchronization position
	syncCnt int       // number of calls to syncXXX without progress

	// Non-syntactic parser control
	exprLev int // < 0: in control clause, >= 0: in expression

	imports []*ast.ImportSpec // list of imports

	version int
}

func (p *parser) init(filename string, src []byte, mode []Option) {
	p.offset = -1
	for _, f := range mode {
		f(p)
	}
	p.file = token.NewFile(filename, p.offset, len(src))

	var m scanner.Mode
	if p.mode&parseCommentsMode != 0 {
		m = scanner.ScanComments
	}
	eh := func(pos token.Pos, msg string, args []interface{}) {
		p.errors = errors.Append(p.errors, errors.Newf(pos, msg, args...))
	}
	p.scanner.Init(p.file, src, eh, m)

	p.trace = p.mode&traceMode != 0 // for convenience (p.trace is used frequently)

	p.comments = &commentState{pos: -1}

	p.next()
}

type commentState struct {
	parent *commentState
	pos    int8
	groups []*ast.CommentGroup

	// lists are not attached to nodes themselves. Enclosed expressions may
	// miss a comment due to commas and line termination. closeLists ensures
	// that comments will be passed to someone.
	isList    int
	lastChild ast.Node
	lastPos   int8
}

// openComments reserves the next doc comment for the caller and flushes
func (p *parser) openComments() *commentState {
	child := &commentState{
		parent: p.comments,
	}
	if c := p.comments; c != nil && c.isList > 0 {
		if c.lastChild != nil {
			var groups []*ast.CommentGroup
			for _, cg := range c.groups {
				if cg.Position == 0 {
					groups = append(groups, cg)
				}
			}
			groups = append(groups, c.lastChild.Comments()...)
			for _, cg := range c.groups {
				if cg.Position != 0 {
					cg.Position = c.lastPos
					groups = append(groups, cg)
				}
			}
			ast.SetComments(c.lastChild, groups)
			c.groups = nil
		} else {
			c.lastChild = nil
			// attach before next
			for _, cg := range c.groups {
				cg.Position = 0
			}
			child.groups = c.groups
			c.groups = nil
		}
	}
	if p.leadComment != nil {
		child.groups = append(child.groups, p.leadComment)
		p.leadComment = nil
	}
	p.comments = child
	return child
}

// openList is used to treat a list of comments as a single comment
// position in a production.
func (p *parser) openList() {
	if p.comments.isList > 0 {
		p.comments.isList++
		return
	}
	c := &commentState{
		parent: p.comments,
		isList: 1,
	}
	p.comments = c
}

func (c *commentState) add(g *ast.CommentGroup) {
	g.Position = c.pos
	c.groups = append(c.groups, g)
}

func (p *parser) closeList() {
	c := p.comments
	if c.lastChild != nil {
		for _, cg := range c.groups {
			cg.Position = c.lastPos
			c.lastChild.AddComment(cg)
		}
		c.groups = nil
	}
	switch c.isList--; {
	case c.isList < 0:
		if !p.panicking {
			err := errors.Newf(p.pos, "unmatched close list")
			p.errors = errors.Append(p.errors, err)
			p.panicking = true
			panic(err)
		}
	case c.isList == 0:
		parent := c.parent
		if len(c.groups) > 0 {
			parent.groups = append(parent.groups, c.groups...)
		}
		parent.pos++
		p.comments = parent
	}
}

func (c *commentState) closeNode(p *parser, n ast.Node) ast.Node {
	if p.comments != c {
		if !p.panicking {
			err := errors.Newf(p.pos, "unmatched comments")
			p.errors = errors.Append(p.errors, err)
			p.panicking = true
			panic(err)
		}
		return n
	}
	p.comments = c.parent
	if c.parent != nil {
		c.parent.lastChild = n
		c.parent.lastPos = c.pos
		c.parent.pos++
	}
	for _, cg := range c.groups {
		if n != nil {
			if cg != nil {
				n.AddComment(cg)
			}
		}
	}
	c.groups = nil
	return n
}

func (c *commentState) closeExpr(p *parser, n ast.Expr) ast.Expr {
	c.closeNode(p, n)
	return n
}

func (c *commentState) closeClause(p *parser, n ast.Clause) ast.Clause {
	c.closeNode(p, n)
	return n
}

// ----------------------------------------------------------------------------
// Parsing support

func (p *parser) printTrace(a ...interface{}) {
	const dots = ". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . "
	const n = len(dots)
	pos := p.file.Position(p.pos)
	fmt.Printf("%5d:%3d: ", pos.Line, pos.Column)
	i := 2 * p.indent
	for i > n {
		fmt.Print(dots)
		i -= n
	}
	// i <= n
	fmt.Print(dots[0:i])
	fmt.Println(a...)
}

func trace(p *parser, msg string) *parser {
	p.printTrace(msg, "(")
	p.indent++
	return p
}

// Usage pattern: defer un(trace(p, "..."))
func un(p *parser) {
	p.indent--
	p.printTrace(")")
}

// Advance to the next
func (p *parser) next0() {
	// Because of one-token look-ahead, print the previous token
	// when tracing as it provides a more readable output. The
	// very first token (!p.pos.IsValid()) is not initialized
	// (it is ILLEGAL), so don't print it .
	if p.trace && p.pos.IsValid() {
		s := p.tok.String()
		switch {
		case p.tok.IsLiteral():
			p.printTrace(s, p.lit)
		case p.tok.IsOperator(), p.tok.IsKeyword():
			p.printTrace("\"" + s + "\"")
		default:
			p.printTrace(s)
		}
	}

	p.pos, p.tok, p.lit = p.scanner.Scan()
}

// Consume a comment and return it and the line on which it ends.
func (p *parser) consumeComment() (comment *ast.Comment, endline int) {
	// /*-style comments may end on a different line than where they start.
	// Scan the comment for '\n' chars and adjust endline accordingly.
	endline = p.file.Line(p.pos)
	if p.lit[1] == '*' {
		p.assertV0(p.pos, 0, 10, "block quotes")

		// don't use range here - no need to decode Unicode code points
		for i := 0; i < len(p.lit); i++ {
			if p.lit[i] == '\n' {
				endline++
			}
		}
	}

	comment = &ast.Comment{Slash: p.pos, Text: p.lit}
	p.next0()

	return
}

// Consume a group of adjacent comments, add it to the parser's
// comments list, and return it together with the line at which
// the last comment in the group ends. A non-comment token or n
// empty lines terminate a comment group.
func (p *parser) consumeCommentGroup(prevLine, n int) (comments *ast.CommentGroup, endline int) {
	var list []*ast.Comment
	var rel token.RelPos
	endline = p.file.Line(p.pos)
	switch endline - prevLine {
	case 0:
		rel = token.Blank
	case 1:
		rel = token.Newline
	default:
		rel = token.NewSection
	}
	for p.tok == token.COMMENT && p.file.Line(p.pos) <= endline+n {
		var comment *ast.Comment
		comment, endline = p.consumeComment()
		list = append(list, comment)
	}

	cg := &ast.CommentGroup{List: list}
	ast.SetRelPos(cg, rel)
	comments = cg
	return
}

// Advance to the next non-comment  In the process, collect
// any comment groups encountered, and refield the last lead and
// and line comments.
//
// A lead comment is a comment group that starts and ends in a
// line without any other tokens and that is followed by a non-comment
// token on the line immediately after the comment group.
//
// A line comment is a comment group that follows a non-comment
// token on the same line, and that has no tokens after it on the line
// where it ends.
//
// Lead and line comments may be considered documentation that is
// stored in the AST.
func (p *parser) next() {
	// A leadComment may not be consumed if it leads an inner token of a node.
	if p.leadComment != nil {
		p.comments.add(p.leadComment)
	}
	p.leadComment = nil
	prev := p.pos
	p.next0()
	p.comments.pos++

	if p.tok == token.COMMENT {
		var comment *ast.CommentGroup
		var endline int

		currentLine := p.file.Line(p.pos)
		prevLine := p.file.Line(prev)
		if prevLine == currentLine {
			// The comment is on same line as the previous token; it
			// cannot be a lead comment but may be a line comment.
			comment, endline = p.consumeCommentGroup(prevLine, 0)
			if p.file.Line(p.pos) != endline {
				// The next token is on a different line, thus
				// the last comment group is a line comment.
				comment.Line = true
			}
		}

		// consume successor comments, if any
		endline = -1
		for p.tok == token.COMMENT {
			if comment != nil {
				p.comments.add(comment)
			}
			comment, endline = p.consumeCommentGroup(prevLine, 1)
			prevLine = currentLine
			currentLine = p.file.Line(p.pos)

		}

		if endline+1 == p.file.Line(p.pos) && p.tok != token.EOF {
			// The next token is following on the line immediately after the
			// comment group, thus the last comment group is a lead comment.
			comment.Doc = true
			p.leadComment = comment
		} else {
			p.comments.add(comment)
		}
	}
}

// assertV0 indicates the last version at which a certain feature was
// supported.
func (p *parser) assertV0(pos token.Pos, minor, patch int, name string) {
	v := internal.Version(minor, patch)
	base := p.version
	if base == 0 {
		base = internal.APIVersionSupported
	}
	if base > v {
		p.errors = errors.Append(p.errors,
			errors.Wrapf(&DeprecationError{v}, pos,
				"use of deprecated %s (deprecated as of v0.%d.%d)", name, minor, patch+1))
	}
}

func (p *parser) errf(pos token.Pos, msg string, args ...interface{}) {
	// ePos := p.file.Position(pos)
	ePos := pos

	// If AllErrors is not set, discard errors reported on the same line
	// as the last recorded error and stop parsing if there are more than
	// 10 errors.
	if p.mode&allErrorsMode == 0 {
		errors := errors.Errors(p.errors)
		n := len(errors)
		if n > 0 && errors[n-1].Position().Line() == ePos.Line() {
			return // discard - likely a spurious error
		}
		if n > 10 {
			p.panicking = true
			panic("too many errors")
		}
	}

	p.errors = errors.Append(p.errors, errors.Newf(ePos, msg, args...))
}

func (p *parser) errorExpected(pos token.Pos, obj string) {
	if pos != p.pos {
		p.errf(pos, "expected %s", obj)
		return
	}
	// the error happened at the current position;
	// make the error message more specific
	if p.tok == token.COMMA && p.lit == "\n" {
		p.errf(pos, "expected %s, found newline", obj)
		return
	}

	if p.tok.IsLiteral() {
		p.errf(pos, "expected %s, found '%s' %s", obj, p.tok, p.lit)
	} else {
		p.errf(pos, "expected %s, found '%s'", obj, p.tok)
	}
}

func (p *parser) expect(tok token.Token) token.Pos {
	pos := p.pos
	if p.tok != tok {
		p.errorExpected(pos, "'"+tok.String()+"'")
	}
	p.next() // make progress
	return pos
}

// expectClosing is like expect but provides a better error message
// for the common case of a missing comma before a newline.
func (p *parser) expectClosing(tok token.Token, context string) token.Pos {
	if p.tok != tok && p.tok == token.COMMA && p.lit == "\n" {
		p.errf(p.pos, "missing ',' before newline in %s", context)
		p.next()
	}
	return p.expect(tok)
}

func (p *parser) expectComma() {
	// semicolon is optional before a closing ')', ']', '}', or newline
	if p.tok != token.RPAREN && p.tok != token.RBRACE && p.tok != token.EOF {
		switch p.tok {
		case token.COMMA:
			p.next()
		default:
			p.errorExpected(p.pos, "','")
			syncExpr(p)
		}
	}
}

func (p *parser) atComma(context string, follow ...token.Token) bool {
	if p.tok == token.COMMA {
		return true
	}
	for _, t := range follow {
		if p.tok == t {
			return false
		}
	}
	// TODO: find a way to detect crossing lines now we don't have a semi.
	if p.lit == "\n" {
		p.errf(p.pos, "missing ',' before newline")
	} else {
		p.errf(p.pos, "missing ',' in %s", context)
	}
	return true // "insert" comma and continue
}

// syncExpr advances to the next field in a field list.
// Used for synchronization after an error.
func syncExpr(p *parser) {
	for {
		switch p.tok {
		case token.COMMA:
			// Return only if parser made some progress since last
			// sync or if it has not reached 10 sync calls without
			// progress. Otherwise consume at least one token to
			// avoid an endless parser loop (it is possible that
			// both parseOperand and parseStmt call syncStmt and
			// correctly do not advance, thus the need for the
			// invocation limit p.syncCnt).
			if p.pos == p.syncPos && p.syncCnt < 10 {
				p.syncCnt++
				return
			}
			if p.syncPos.Before(p.pos) {
				p.syncPos = p.pos
				p.syncCnt = 0
				return
			}
			// Reaching here indicates a parser bug, likely an
			// incorrect token list in this function, but it only
			// leads to skipping of possibly correct code if a
			// previous error is present, and thus is preferred
			// over a non-terminating parse.
		case token.EOF:
			return
		}
		p.next()
	}
}

// safePos returns a valid file position for a given position: If pos
// is valid to begin with, safePos returns pos. If pos is out-of-range,
// safePos returns the EOF position.
//
// This is hack to work around "artificial" end positions in the AST which
// are computed by adding 1 to (presumably valid) token positions. If the
// token positions are invalid due to parse errors, the resulting end position
// may be past the file's EOF position, which would lead to panics if used
// later on.
func (p *parser) safePos(pos token.Pos) (res token.Pos) {
	defer func() {
		if recover() != nil {
			res = p.file.Pos(p.file.Base()+p.file.Size(), pos.RelPos()) // EOF position
		}
	}()
	_ = p.file.Offset(pos) // trigger a panic if position is out-of-range
	return pos
}

// ----------------------------------------------------------------------------
// Identifiers

func (p *parser) parseIdent() *ast.Ident {
	c := p.openComments()
	pos := p.pos
	name := "_"
	if p.tok == token.IDENT {
		name = p.lit
		p.next()
	} else {
		p.expect(token.IDENT) // use expect() error handling
	}
	ident := &ast.Ident{NamePos: pos, Name: name}
	c.closeNode(p, ident)
	return ident
}

func (p *parser) parseKeyIdent() *ast.Ident {
	c := p.openComments()
	pos := p.pos
	name := p.lit
	p.next()
	ident := &ast.Ident{NamePos: pos, Name: name}
	c.closeNode(p, ident)
	return ident
}

// ----------------------------------------------------------------------------
// Expressions

// parseOperand returns an expression.
// Callers must verify the result.
func (p *parser) parseOperand() (expr ast.Expr) {
	if p.trace {
		defer un(trace(p, "Operand"))
	}

	switch p.tok {
	case token.IDENT:
		return p.parseIdent()

	case token.LBRACE:
		return p.parseStruct()

	case token.LBRACK:
		return p.parseList()

	case token.FUNC:
		if p.mode&parseFuncsMode != 0 {
			return p.parseFunc()
		} else {
			return p.parseKeyIdent()
		}

	case token.BOTTOM:
		c := p.openComments()
		x := &ast.BottomLit{Bottom: p.pos}
		p.next()
		return c.closeExpr(p, x)

	case token.NULL, token.TRUE, token.FALSE, token.INT, token.FLOAT, token.STRING:
		c := p.openComments()
		x := &ast.BasicLit{ValuePos: p.pos, Kind: p.tok, Value: p.lit}
		p.next()
		return c.closeExpr(p, x)

	case token.INTERPOLATION:
		return p.parseInterpolation()

	case token.LPAREN:
		c := p.openComments()
		defer func() { c.closeNode(p, expr) }()
		lparen := p.pos
		p.next()
		p.exprLev++
		p.openList()
		x := p.parseRHS() // types may be parenthesized: (some type)
		p.closeList()
		p.exprLev--
		rparen := p.expect(token.RPAREN)
		return &ast.ParenExpr{
			Lparen: lparen,
			X:      x,
			Rparen: rparen}

	default:
		if p.tok.IsKeyword() {
			return p.parseKeyIdent()
		}
	}

	// we have an error
	c := p.openComments()
	pos := p.pos
	p.errorExpected(pos, "operand")
	syncExpr(p)
	return c.closeExpr(p, &ast.BadExpr{From: pos, To: p.pos})
}

func (p *parser) parseIndexOrSlice(x ast.Expr) (expr ast.Expr) {
	if p.trace {
		defer un(trace(p, "IndexOrSlice"))
	}

	c := p.openComments()
	defer func() { c.closeNode(p, expr) }()
	c.pos = 1

	const N = 2
	lbrack := p.expect(token.LBRACK)

	p.exprLev++
	var index [N]ast.Expr
	var colons [N - 1]token.Pos
	if p.tok != token.COLON {
		index[0] = p.parseRHS()
	}
	nColons := 0
	for p.tok == token.COLON && nColons < len(colons) {
		colons[nColons] = p.pos
		nColons++
		p.next()
		if p.tok != token.COLON && p.tok != token.RBRACK && p.tok != token.EOF {
			index[nColons] = p.parseRHS()
		}
	}
	p.exprLev--
	rbrack := p.expect(token.RBRACK)

	if nColons > 0 {
		return &ast.SliceExpr{
			X:      x,
			Lbrack: lbrack,
			Low:    index[0],
			High:   index[1],
			Rbrack: rbrack}
	}

	return &ast.IndexExpr{
		X:      x,
		Lbrack: lbrack,
		Index:  index[0],
		Rbrack: rbrack}
}

func (p *parser) parseCallOrConversion(fun ast.Expr) (expr *ast.CallExpr) {
	if p.trace {
		defer un(trace(p, "CallOrConversion"))
	}
	c := p.openComments()
	defer func() { c.closeNode(p, expr) }()

	p.openList()
	defer p.closeList()

	lparen := p.expect(token.LPAREN)

	p.exprLev++
	var list []ast.Expr
	for p.tok != token.RPAREN && p.tok != token.EOF {
		list = append(list, p.parseRHS()) // builtins may expect a type: make(some type, ...)
		if !p.atComma("argument list", token.RPAREN) {
			break
		}
		p.next()
	}
	p.exprLev--
	rparen := p.expectClosing(token.RPAREN, "argument list")

	return &ast.CallExpr{
		Fun:    fun,
		Lparen: lparen,
		Args:   list,
		Rparen: rparen}
}

// TODO: inline this function in parseFieldList once we no longer user comment
// position information in parsing.
func (p *parser) consumeDeclComma() {
	if p.atComma("struct literal", token.RBRACE, token.EOF) {
		p.next()
	}
}

func (p *parser) parseFieldList() (list []ast.Decl) {
	if p.trace {
		defer un(trace(p, "FieldList"))
	}
	p.openList()
	defer p.closeList()

	for p.tok != token.RBRACE && p.tok != token.EOF {
		switch p.tok {
		case token.ATTRIBUTE:
			list = append(list, p.parseAttribute())
			p.consumeDeclComma()

		case token.ELLIPSIS:
			c := p.openComments()
			ellipsis := &ast.Ellipsis{Ellipsis: p.pos}
			p.next()
			c.closeNode(p, ellipsis)
			list = append(list, ellipsis)
			p.consumeDeclComma()

		default:
			list = append(list, p.parseField())
		}

		// TODO: handle next comma here, after disallowing non-colon separator
		// and we have eliminated the need comment positions.
	}

	return
}

func (p *parser) parseLetDecl() (decl ast.Decl, ident *ast.Ident) {
	if p.trace {
		defer un(trace(p, "Field"))
	}

	c := p.openComments()

	letPos := p.expect(token.LET)
	if p.tok != token.IDENT {
		c.closeNode(p, ident)
		return nil, &ast.Ident{
			NamePos: letPos,
			Name:    "let",
		}
	}
	defer func() { c.closeNode(p, decl) }()

	ident = p.parseIdent()
	assign := p.expect(token.BIND)
	expr := p.parseRHS()

	p.consumeDeclComma()

	return &ast.LetClause{
		Let:   letPos,
		Ident: ident,
		Equal: assign,
		Expr:  expr,
	}, nil
}

func (p *parser) parseComprehension() (decl ast.Decl, ident *ast.Ident) {
	if p.trace {
		defer un(trace(p, "Comprehension"))
	}

	c := p.openComments()
	defer func() { c.closeNode(p, decl) }()

	tok := p.tok
	pos := p.pos
	clauses, fc := p.parseComprehensionClauses(true)
	if fc != nil {
		ident = &ast.Ident{
			NamePos: pos,
			Name:    tok.String(),
		}
		fc.closeNode(p, ident)
		return nil, ident
	}

	sc := p.openComments()
	expr := p.parseStruct()
	sc.closeExpr(p, expr)

	if p.atComma("struct literal", token.RBRACE) { // TODO: may be EOF
		p.next()
	}

	return &ast.Comprehension{
		Clauses: clauses,
		Value:   expr,
	}, nil
}

func (p *parser) parseField() (decl ast.Decl) {
	if p.trace {
		defer un(trace(p, "Field"))
	}

	c := p.openComments()
	defer func() { c.closeNode(p, decl) }()

	pos := p.pos

	this := &ast.Field{Label: nil}
	m := this

	tok := p.tok

	label, expr, decl, ok := p.parseLabel(false)
	if decl != nil {
		return decl
	}
	m.Label = label

	if !ok {
		if expr == nil {
			expr = p.parseRHS()
		}
		if a, ok := expr.(*ast.Alias); ok {
			p.assertV0(a.Pos(), 1, 3, `old-style alias; use "let X = expr" instead`)
			p.consumeDeclComma()
			return a
		}
		e := &ast.EmbedDecl{Expr: expr}
		p.consumeDeclComma()
		return e
	}

	if p.tok == token.OPTION {
		m.Optional = p.pos
		p.next()
	}

	// TODO: consider disallowing comprehensions with more than one label.
	// This can be a bit awkward in some cases, but it would naturally
	// enforce the proper style that a comprehension be defined in the
	// smallest possible scope.
	// allowComprehension = false

	switch p.tok {
	case token.COLON:
	case token.COMMA:
		p.expectComma() // sync parser.
		fallthrough

	case token.RBRACE, token.EOF:
		if a, ok := expr.(*ast.Alias); ok {
			p.assertV0(a.Pos(), 1, 3, `old-style alias; use "let X = expr" instead`)
			return a
		}
		switch tok {
		case token.IDENT, token.LBRACK, token.LPAREN,
			token.STRING, token.INTERPOLATION,
			token.NULL, token.TRUE, token.FALSE,
			token.FOR, token.IF, token.LET, token.IN:
			return &ast.EmbedDecl{Expr: expr}
		}
		fallthrough

	default:
		p.errorExpected(p.pos, "label or ':'")
		return &ast.BadDecl{From: pos, To: p.pos}
	}

	m.TokenPos = p.pos
	m.Token = p.tok
	if p.tok != token.COLON {
		p.errorExpected(pos, "':'")
	}
	p.next() // :

	for {
		if l, ok := m.Label.(*ast.ListLit); ok && len(l.Elts) != 1 {
			p.errf(l.Pos(), "square bracket must have exactly one element")
		}

		label, expr, _, ok := p.parseLabel(true)
		if !ok || (p.tok != token.COLON && p.tok != token.OPTION) {
			if expr == nil {
				expr = p.parseRHS()
			}
			m.Value = expr
			break
		}
		field := &ast.Field{Label: label}
		m.Value = &ast.StructLit{Elts: []ast.Decl{field}}
		m = field

		if p.tok == token.OPTION {
			m.Optional = p.pos
			p.next()
		}

		m.TokenPos = p.pos
		m.Token = p.tok
		if p.tok != token.COLON {
			if p.tok.IsLiteral() {
				p.errf(p.pos, "expected ':'; found %s", p.lit)
			} else {
				p.errf(p.pos, "expected ':'; found %s", p.tok)
			}
			break
		}
		p.next()
	}

	if attrs := p.parseAttributes(); attrs != nil {
		m.Attrs = attrs
	}

	p.consumeDeclComma()

	return this
}

func (p *parser) parseAttributes() (attrs []*ast.Attribute) {
	p.openList()
	for p.tok == token.ATTRIBUTE {
		attrs = append(attrs, p.parseAttribute())
	}
	p.closeList()
	return attrs
}

func (p *parser) parseAttribute() *ast.Attribute {
	c := p.openComments()
	a := &ast.Attribute{At: p.pos, Text: p.lit}
	p.next()
	c.closeNode(p, a)
	return a
}

func (p *parser) parseLabel(rhs bool) (label ast.Label, expr ast.Expr, decl ast.Decl, ok bool) {
	tok := p.tok
	switch tok {

	case token.FOR, token.IF:
		if rhs {
			expr = p.parseExpr()
			break
		}
		comp, ident := p.parseComprehension()
		if comp != nil {
			return nil, nil, comp, false
		}
		expr = ident

	case token.LET:
		let, ident := p.parseLetDecl()
		if let != nil {
			return nil, nil, let, false
		}
		expr = ident

	case token.IDENT, token.STRING, token.INTERPOLATION, token.LPAREN,
		token.NULL, token.TRUE, token.FALSE, token.IN, token.FUNC:
		expr = p.parseExpr()

	case token.LBRACK:
		expr = p.parseRHS()
		switch x := expr.(type) {
		case *ast.ListLit:
			// Note: caller must verify this list is suitable as a label.
			label, ok = x, true
		}
	}

	switch x := expr.(type) {
	case *ast.BasicLit:
		switch x.Kind {
		case token.STRING, token.NULL, token.TRUE, token.FALSE, token.FUNC:
			// Keywords that represent operands.

			// Allowing keywords to be used as a labels should not interfere with
			// generating good errors: any keyword can only appear on the RHS of a
			// field (after a ':'), whereas labels always appear on the LHS.

			label, ok = x, true
		}

	case *ast.Ident:
		if strings.HasPrefix(x.Name, "__") {
			p.errf(x.NamePos, "identifiers starting with '__' are reserved")
		}

		expr = p.parseAlias(x)
		if a, ok := expr.(*ast.Alias); ok {
			if _, ok = a.Expr.(ast.Label); !ok {
				break
			}
			label = a
		} else {
			label = x
		}
		ok = true

	case ast.Label:
		label, ok = x, true
	}
	return label, expr, nil, ok
}

func (p *parser) parseStruct() (expr ast.Expr) {
	lbrace := p.expect(token.LBRACE)

	if p.trace {
		defer un(trace(p, "StructLit"))
	}

	elts := p.parseStructBody()
	rbrace := p.expectClosing(token.RBRACE, "struct literal")
	return &ast.StructLit{
		Lbrace: lbrace,
		Elts:   elts,
		Rbrace: rbrace,
	}
}

func (p *parser) parseStructBody() []ast.Decl {
	if p.trace {
		defer un(trace(p, "StructBody"))
	}

	p.exprLev++
	var elts []ast.Decl

	// TODO: consider "stealing" non-lead comments.
	// for _, cg := range p.comments.groups {
	// 	if cg != nil {
	// 		elts = append(elts, cg)
	// 	}
	// }
	// p.comments.groups = p.comments.groups[:0]

	if p.tok != token.RBRACE {
		elts = p.parseFieldList()
	}
	p.exprLev--

	return elts
}

// parseComprehensionClauses parses either new-style (first==true)
// or old-style (first==false).
// Should we now disallow keywords as identifiers? If not, we need to
// return a list of discovered labels as the alternative.
func (p *parser) parseComprehensionClauses(first bool) (clauses []ast.Clause, c *commentState) {
	// TODO: reuse Template spec, which is possible if it doesn't check the
	// first is an identifier.

	for {
		switch p.tok {
		case token.FOR:
			c := p.openComments()
			forPos := p.expect(token.FOR)
			if first {
				switch p.tok {
				case token.COLON, token.BIND, token.OPTION,
					token.COMMA, token.EOF:
					return nil, c
				}
			}

			var key, value *ast.Ident
			var colon token.Pos
			value = p.parseIdent()
			if p.tok == token.COMMA {
				colon = p.expect(token.COMMA)
				key = value
				value = p.parseIdent()
			}
			c.pos = 4
			// params := p.parseParams(nil, ARROW)
			clauses = append(clauses, c.closeClause(p, &ast.ForClause{
				For:    forPos,
				Key:    key,
				Colon:  colon,
				Value:  value,
				In:     p.expect(token.IN),
				Source: p.parseRHS(),
			}))

		case token.IF:
			c := p.openComments()
			ifPos := p.expect(token.IF)
			if first {
				switch p.tok {
				case token.COLON, token.BIND, token.OPTION,
					token.COMMA, token.EOF:
					return nil, c
				}
			}

			clauses = append(clauses, c.closeClause(p, &ast.IfClause{
				If:        ifPos,
				Condition: p.parseRHS(),
			}))

		case token.LET:
			c := p.openComments()
			letPos := p.expect(token.LET)

			ident := p.parseIdent()
			assign := p.expect(token.BIND)
			expr := p.parseRHS()

			clauses = append(clauses, c.closeClause(p, &ast.LetClause{
				Let:   letPos,
				Ident: ident,
				Equal: assign,
				Expr:  expr,
			}))

		default:
			return clauses, nil
		}
		if p.tok == token.COMMA {
			p.next()
		}

		first = false
	}
}

func (p *parser) parseFunc() (expr ast.Expr) {
	if p.trace {
		defer un(trace(p, "Func"))
	}
	tok := p.tok
	pos := p.pos
	fun := p.expect(token.FUNC)

	// "func" might be used as an identifier, in which case bail out early.
	switch p.tok {
	case token.COLON, token.BIND, token.OPTION,
		token.COMMA, token.EOF:

		return &ast.Ident{
			NamePos: pos,
			Name:    tok.String(),
		}
	}

	p.expect(token.LPAREN)
	args := p.parseFuncArgs()
	p.expectClosing(token.RPAREN, "argument type list")

	p.expect(token.COLON)
	ret := p.parseExpr()

	return &ast.Func{
		Func: fun,
		Args: args,
		Ret:  ret,
	}
}

func (p *parser) parseFuncArgs() (list []ast.Expr) {
	if p.trace {
		defer un(trace(p, "FuncArgs"))
	}
	p.openList()
	defer p.closeList()

	for p.tok != token.RPAREN && p.tok != token.EOF {
		list = append(list, p.parseFuncArg())
		if p.tok != token.RPAREN {
			p.expectComma()
		}
	}

	return list
}

func (p *parser) parseFuncArg() (expr ast.Expr) {
	if p.trace {
		defer un(trace(p, "FuncArg"))
	}
	return p.parseExpr()
}

func (p *parser) parseList() (expr ast.Expr) {
	lbrack := p.expect(token.LBRACK)

	if p.trace {
		defer un(trace(p, "ListLiteral"))
	}

	elts := p.parseListElements()

	if p.tok == token.ELLIPSIS {
		ellipsis := &ast.Ellipsis{
			Ellipsis: p.pos,
		}
		elts = append(elts, ellipsis)
		p.next()
		if p.tok != token.COMMA && p.tok != token.RBRACK {
			ellipsis.Type = p.parseRHS()
		}
		if p.atComma("list literal", token.RBRACK) {
			p.next()
		}
	}

	rbrack := p.expectClosing(token.RBRACK, "list literal")
	return &ast.ListLit{
		Lbrack: lbrack,
		Elts:   elts,
		Rbrack: rbrack}
}

func (p *parser) parseListElements() (list []ast.Expr) {
	if p.trace {
		defer un(trace(p, "ListElements"))
	}
	p.openList()
	defer p.closeList()

	for p.tok != token.RBRACK && p.tok != token.ELLIPSIS && p.tok != token.EOF {
		expr, ok := p.parseListElement()
		list = append(list, expr)
		if !ok {
			break
		}
	}

	return
}

func (p *parser) parseListElement() (expr ast.Expr, ok bool) {
	if p.trace {
		defer un(trace(p, "ListElement"))
	}
	c := p.openComments()
	defer func() { c.closeNode(p, expr) }()

	switch p.tok {
	case token.FOR, token.IF:
		tok := p.tok
		pos := p.pos
		clauses, fc := p.parseComprehensionClauses(true)
		if clauses != nil {
			sc := p.openComments()
			expr := p.parseStruct()
			sc.closeExpr(p, expr)

			if p.atComma("list literal", token.RBRACK) { // TODO: may be EOF
				p.next()
			}

			return &ast.Comprehension{
				Clauses: clauses,
				Value:   expr,
			}, true
		}

		expr = &ast.Ident{
			NamePos: pos,
			Name:    tok.String(),
		}
		fc.closeNode(p, expr)

	default:
		expr = p.parseUnaryExpr()
	}

	expr = p.parseBinaryExprTail(token.LowestPrec+1, expr)
	expr = p.parseAlias(expr)

	// Enforce there is an explicit comma. We could also allow the
	// omission of commas in lists, but this gives rise to some ambiguities
	// with list comprehensions.
	if p.tok == token.COMMA && p.lit != "," {
		p.next()
		// Allow missing comma for last element, though, to be compliant
		// with JSON.
		if p.tok == token.RBRACK || p.tok == token.FOR || p.tok == token.IF {
			return expr, false
		}
		p.errf(p.pos, "missing ',' before newline in list literal")
	} else if !p.atComma("list literal", token.RBRACK, token.FOR, token.IF) {
		return expr, false
	}
	p.next()

	return expr, true
}

// parseAlias turns an expression into an alias.
func (p *parser) parseAlias(lhs ast.Expr) (expr ast.Expr) {
	if p.tok != token.BIND {
		return lhs
	}
	pos := p.pos
	p.next()
	expr = p.parseRHS()
	if expr == nil {
		panic("empty return")
	}
	switch x := lhs.(type) {
	case *ast.Ident:
		return &ast.Alias{Ident: x, Equal: pos, Expr: expr}
	}
	p.errf(p.pos, "expected identifier for alias")
	return expr
}

// checkExpr checks that x is an expression (and not a type).
func (p *parser) checkExpr(x ast.Expr) ast.Expr {
	switch unparen(x).(type) {
	case *ast.BadExpr:
	case *ast.BottomLit:
	case *ast.Ident:
	case *ast.BasicLit:
	case *ast.Interpolation:
	case *ast.Func:
	case *ast.StructLit:
	case *ast.ListLit:
	case *ast.ParenExpr:
		panic("unreachable")
	case *ast.SelectorExpr:
	case *ast.IndexExpr:
	case *ast.SliceExpr:
	case *ast.CallExpr:
	case *ast.UnaryExpr:
	case *ast.BinaryExpr:
	default:
		// all other nodes are not proper expressions
		p.errorExpected(x.Pos(), "expression")
		x = &ast.BadExpr{
			From: x.Pos(), To: p.safePos(x.End()),
		}
	}
	return x
}

// If x is of the form (T), unparen returns unparen(T), otherwise it returns x.
func unparen(x ast.Expr) ast.Expr {
	if p, isParen := x.(*ast.ParenExpr); isParen {
		x = unparen(p.X)
	}
	return x
}

// If lhs is set and the result is an identifier, it is not resolved.
func (p *parser) parsePrimaryExpr() ast.Expr {
	if p.trace {
		defer un(trace(p, "PrimaryExpr"))
	}

	return p.parsePrimaryExprTail(p.parseOperand())
}

func (p *parser) parsePrimaryExprTail(operand ast.Expr) ast.Expr {
	x := operand
L:
	for {
		switch p.tok {
		case token.PERIOD:
			c := p.openComments()
			c.pos = 1
			p.next()
			switch p.tok {
			case token.IDENT:
				x = &ast.SelectorExpr{
					X:   p.checkExpr(x),
					Sel: p.parseIdent(),
				}
			case token.STRING:
				if strings.HasPrefix(p.lit, `"`) && !strings.HasPrefix(p.lit, `""`) {
					str := &ast.BasicLit{
						ValuePos: p.pos,
						Kind:     token.STRING,
						Value:    p.lit,
					}
					p.next()
					x = &ast.SelectorExpr{
						X:   p.checkExpr(x),
						Sel: str,
					}
					break
				}
				fallthrough
			default:
				pos := p.pos
				p.errorExpected(pos, "selector")
				p.next() // make progress
				x = &ast.SelectorExpr{X: x, Sel: &ast.Ident{NamePos: pos, Name: "_"}}
			}
			c.closeNode(p, x)
		case token.LBRACK:
			x = p.parseIndexOrSlice(p.checkExpr(x))
		case token.LPAREN:
			x = p.parseCallOrConversion(p.checkExpr(x))
		default:
			break L
		}
	}

	return x
}

// If lhs is set and the result is an identifier, it is not resolved.
func (p *parser) parseUnaryExpr() ast.Expr {
	if p.trace {
		defer un(trace(p, "UnaryExpr"))
	}

	switch p.tok {
	case token.ADD, token.SUB, token.NOT, token.MUL,
		token.LSS, token.LEQ, token.GEQ, token.GTR,
		token.NEQ, token.MAT, token.NMAT:
		pos, op := p.pos, p.tok
		c := p.openComments()
		p.next()
		return c.closeExpr(p, &ast.UnaryExpr{
			OpPos: pos,
			Op:    op,
			X:     p.checkExpr(p.parseUnaryExpr()),
		})
	}

	return p.parsePrimaryExpr()
}

func (p *parser) tokPrec() (token.Token, int) {
	tok := p.tok
	if tok == token.IDENT {
		switch p.lit {
		case "quo":
			return token.IQUO, 7
		case "rem":
			return token.IREM, 7
		case "div":
			return token.IDIV, 7
		case "mod":
			return token.IMOD, 7
		default:
			return tok, 0
		}
	}
	return tok, tok.Precedence()
}

// If lhs is set and the result is an identifier, it is not resolved.
func (p *parser) parseBinaryExpr(prec1 int) ast.Expr {
	if p.trace {
		defer un(trace(p, "BinaryExpr"))
	}
	p.openList()
	defer p.closeList()

	return p.parseBinaryExprTail(prec1, p.parseUnaryExpr())
}

func (p *parser) parseBinaryExprTail(prec1 int, x ast.Expr) ast.Expr {
	for {
		op, prec := p.tokPrec()
		if prec < prec1 {
			return x
		}
		c := p.openComments()
		c.pos = 1
		pos := p.expect(p.tok)
		x = c.closeExpr(p, &ast.BinaryExpr{
			X:     p.checkExpr(x),
			OpPos: pos,
			Op:    op,
			// Treat nested expressions as RHS.
			Y: p.checkExpr(p.parseBinaryExpr(prec + 1))})
	}
}

func (p *parser) parseInterpolation() (expr ast.Expr) {
	c := p.openComments()
	defer func() { c.closeNode(p, expr) }()

	p.openList()
	defer p.closeList()

	cc := p.openComments()

	lit := p.lit
	pos := p.pos
	p.next()
	last := &ast.BasicLit{ValuePos: pos, Kind: token.STRING, Value: lit}
	exprs := []ast.Expr{last}

	for p.tok == token.LPAREN {
		c.pos = 1
		p.expect(token.LPAREN)
		cc.closeExpr(p, last)

		exprs = append(exprs, p.parseRHS())

		cc = p.openComments()
		if p.tok != token.RPAREN {
			p.errf(p.pos, "expected ')' for string interpolation")
		}
		lit = p.scanner.ResumeInterpolation()
		pos = p.pos
		p.next()
		last = &ast.BasicLit{
			ValuePos: pos,
			Kind:     token.STRING,
			Value:    lit,
		}
		exprs = append(exprs, last)
	}
	cc.closeExpr(p, last)
	return &ast.Interpolation{Elts: exprs}
}

// Callers must check the result (using checkExpr), depending on context.
func (p *parser) parseExpr() (expr ast.Expr) {
	if p.trace {
		defer un(trace(p, "Expression"))
	}

	c := p.openComments()
	defer func() { c.closeExpr(p, expr) }()

	return p.parseBinaryExpr(token.LowestPrec + 1)
}

func (p *parser) parseRHS() ast.Expr {
	x := p.checkExpr(p.parseExpr())
	return x
}

// ----------------------------------------------------------------------------
// Declarations

func isValidImport(lit string) bool {
	const illegalChars = `!"#$%&'()*,:;<=>?[\]^{|}` + "`\uFFFD"
	s, _ := literal.Unquote(lit) // go/scanner returns a legal string literal
	if p := strings.LastIndexByte(s, ':'); p >= 0 {
		s = s[:p]
	}
	for _, r := range s {
		if !unicode.IsGraphic(r) || unicode.IsSpace(r) || strings.ContainsRune(illegalChars, r) {
			return false
		}
	}
	return s != ""
}

func (p *parser) parseImportSpec(_ int) *ast.ImportSpec {
	if p.trace {
		defer un(trace(p, "ImportSpec"))
	}

	c := p.openComments()

	var ident *ast.Ident
	if p.tok == token.IDENT {
		ident = p.parseIdent()
	}

	pos := p.pos
	var path string
	if p.tok == token.STRING {
		path = p.lit
		if !isValidImport(path) {
			p.errf(pos, "invalid import path: %s", path)
		}
		p.next()
		p.expectComma() // call before accessing p.linecomment
	} else {
		p.expect(token.STRING) // use expect() error handling
		if p.tok == token.COMMA {
			p.expectComma() // call before accessing p.linecomment
		}
	}
	// collect imports
	spec := &ast.ImportSpec{
		Name: ident,
		Path: &ast.BasicLit{ValuePos: pos, Kind: token.STRING, Value: path},
	}
	c.closeNode(p, spec)
	p.imports = append(p.imports, spec)

	return spec
}

func (p *parser) parseImports() *ast.ImportDecl {
	if p.trace {
		defer un(trace(p, "Imports"))
	}
	c := p.openComments()

	ident := p.parseIdent()
	var lparen, rparen token.Pos
	var list []*ast.ImportSpec
	if p.tok == token.LPAREN {
		lparen = p.pos
		p.next()
		p.openList()
		for iota := 0; p.tok != token.RPAREN && p.tok != token.EOF; iota++ {
			list = append(list, p.parseImportSpec(iota))
		}
		p.closeList()
		rparen = p.expect(token.RPAREN)
		p.expectComma()
	} else {
		list = append(list, p.parseImportSpec(0))
	}

	d := &ast.ImportDecl{
		Import: ident.Pos(),
		Lparen: lparen,
		Specs:  list,
		Rparen: rparen,
	}
	c.closeNode(p, d)
	return d
}

// ----------------------------------------------------------------------------
// Source files

func (p *parser) parseFile() *ast.File {
	if p.trace {
		defer un(trace(p, "File"))
	}

	c := p.comments

	// Don't bother parsing the rest if we had errors scanning the first
	// Likely not a Go source file at all.
	if p.errors != nil {
		return nil
	}
	p.openList()

	var decls []ast.Decl

	for p.tok == token.ATTRIBUTE {
		decls = append(decls, p.parseAttribute())
		p.consumeDeclComma()
	}

	// The package clause is not a declaration: it does not appear in any
	// scope.
	if p.tok == token.IDENT && p.lit == "package" {
		c := p.openComments()

		pos := p.pos
		var name *ast.Ident
		p.expect(token.IDENT)
		name = p.parseIdent()
		if name.Name == "_" && p.mode&declarationErrorsMode != 0 {
			p.errf(p.pos, "invalid package name _")
		}

		pkg := &ast.Package{
			PackagePos: pos,
			Name:       name,
		}
		decls = append(decls, pkg)
		p.expectComma()
		c.closeNode(p, pkg)
	}

	for p.tok == token.ATTRIBUTE {
		decls = append(decls, p.parseAttribute())
		p.consumeDeclComma()
	}

	if p.mode&packageClauseOnlyMode == 0 {
		// import decls
		for p.tok == token.IDENT && p.lit == "import" {
			decls = append(decls, p.parseImports())
		}

		if p.mode&importsOnlyMode == 0 {
			// rest of package decls
			// TODO: loop and allow multiple expressions.
			decls = append(decls, p.parseFieldList()...)
			p.expect(token.EOF)
		}
	}
	p.closeList()

	f := &ast.File{
		Imports: p.imports,
		Decls:   decls,
	}
	c.closeNode(p, f)
	return f
}
