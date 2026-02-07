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
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/scanner"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
)

func printNode(node interface{}, f *printer) error {
	s := newFormatter(f)

	ls := labelSimplifier{scope: map[string]bool{}}

	// format node
	f.allowed = nooverride // gobble initial whitespace.
	switch x := node.(type) {
	case *ast.File:
		if f.cfg.simplify {
			ls.markReferences(x)
		}
		s.file(x)
	case ast.Expr:
		if f.cfg.simplify {
			ls.markReferences(x)
		}
		s.expr(x)
	case ast.Decl:
		if f.cfg.simplify {
			ls.markReferences(x)
		}
		s.decl(x)
	// case ast.Node: // TODO: do we need this?
	// 	s.walk(x)
	case []ast.Decl:
		if f.cfg.simplify {
			ls.processDecls(x)
		}
		s.walkDeclList(x)
	default:
		goto unsupported
	}

	return s.errs

unsupported:
	return fmt.Errorf("cue/format: unsupported node type %T", node)
}

func isRegularField(tok token.Token) bool {
	return tok == token.ILLEGAL || tok == token.COLON
}

// Helper functions for common node lists. They may be empty.

func nestDepth(f *ast.Field) int {
	d := 1
	if s, ok := f.Value.(*ast.StructLit); ok {
		switch {
		case len(s.Elts) != 1:
			d = 0
		default:
			if f, ok := s.Elts[0].(*ast.Field); ok {
				d += nestDepth(f)
			}
		}
	}
	return d
}

// TODO: be more accurate and move to astutil
func hasDocComments(d ast.Decl) bool {
	if len(d.Comments()) > 0 {
		return true
	}
	switch x := d.(type) {
	case *ast.Field:
		return len(x.Label.Comments()) > 0
	case *ast.Alias:
		return len(x.Ident.Comments()) > 0
	case *ast.LetClause:
		return len(x.Ident.Comments()) > 0
	}
	return false
}

func (f *formatter) walkDeclList(list []ast.Decl) {
	f.before(nil)
	d := 0
	hasEllipsis := false
	for i, x := range list {
		if i > 0 {
			f.print(declcomma)
			nd := 0
			if f, ok := x.(*ast.Field); ok {
				nd = nestDepth(f)
			}
			if f.current.parentSep == newline && (d == 0 || nd != d) {
				f.print(f.formfeed())
			}
			if hasDocComments(x) {
				switch x := list[i-1].(type) {
				case *ast.Field:
					if internal.IsDefinition(x.Label) {
						f.print(newsection)
					}

				default:
					f.print(newsection)
				}
			}
		}
		if f.printer.cfg.simplify && internal.IsEllipsis(x) {
			hasEllipsis = true
			continue
		}
		f.decl(x)
		d = 0
		if f, ok := x.(*ast.Field); ok {
			d = nestDepth(f)
		}
		if j := i + 1; j < len(list) {
			switch x := list[j].(type) {
			case *ast.Field:
				switch x := x.Value.(type) {
				case *ast.StructLit:
					// TODO: not entirely correct: could have multiple elements,
					// not have a valid Lbrace, and be marked multiline. This
					// cannot occur for ASTs resulting from a parse, though.
					if x.Lbrace.IsValid() || len(x.Elts) != 1 {
						f.print(f.formfeed())
						continue
					}
				case *ast.ListLit:
					f.print(f.formfeed())
					continue
				}
			}
		}
		f.print(f.current.parentSep)
	}
	if hasEllipsis {
		f.decl(&ast.Ellipsis{})
		f.print(f.current.parentSep)
	}
	f.after(nil)
}

func (f *formatter) walkSpecList(list []*ast.ImportSpec) {
	f.before(nil)
	for _, x := range list {
		f.before(x)
		f.importSpec(x)
		f.after(x)
	}
	f.after(nil)
}

func (f *formatter) walkClauseList(list []ast.Clause, ws whiteSpace) {
	f.before(nil)
	for _, x := range list {
		f.before(x)
		f.print(ws)
		f.clause(x)
		f.after(x)
	}
	f.after(nil)
}

func (f *formatter) walkListElems(list []ast.Expr) {
	f.before(nil)
	for _, x := range list {
		f.before(x)
		switch n := x.(type) {
		case *ast.Comprehension:
			f.walkClauseList(n.Clauses, blank)
			f.print(blank, nooverride)
			f.expr(n.Value)

		case *ast.Ellipsis:
			f.ellipsis(n)

		case *ast.Alias:
			f.expr(n.Ident)
			f.print(n.Equal, token.BIND)
			f.expr(n.Expr)

			// TODO: ast.CommentGroup: allows comment groups in ListLits.

		case ast.Expr:
			f.exprRaw(n, token.LowestPrec, 1)
		}
		f.print(comma, blank)
		f.after(x)
	}
	f.after(nil)
}

func (f *formatter) walkArgsList(list []ast.Expr, depth int) {
	f.before(nil)
	for _, x := range list {
		f.before(x)
		f.exprRaw(x, token.LowestPrec, depth)
		f.print(comma, blank)
		f.after(x)
	}
	f.after(nil)
}

func (f *formatter) file(file *ast.File) {
	f.before(file)
	f.walkDeclList(file.Decls)
	f.after(file)
	f.print(token.EOF)
}

func (f *formatter) inlineField(n *ast.Field) *ast.Field {
	regular := internal.IsRegularField(n)
	// shortcut single-element structs.
	// If the label has a valid position, we assume that an unspecified
	// Lbrace signals the intend to collapse fields.
	if !n.Label.Pos().IsValid() && !(f.printer.cfg.simplify && regular) {
		return nil
	}

	obj, ok := n.Value.(*ast.StructLit)
	if !ok || len(obj.Elts) != 1 ||
		(obj.Lbrace.IsValid() && !f.printer.cfg.simplify) ||
		(obj.Lbrace.IsValid() && hasDocComments(n)) ||
		len(n.Attrs) > 0 {
		return nil
	}

	mem, ok := obj.Elts[0].(*ast.Field)
	if !ok || len(mem.Attrs) > 0 {
		return nil
	}

	if hasDocComments(mem) {
		// TODO: this inserts curly braces even in spaces where this
		// may not be desirable, such as:
		// a:
		//   // foo
		//   b: 3
		return nil
	}
	return mem
}

func (f *formatter) decl(decl ast.Decl) {
	if decl == nil {
		return
	}
	defer f.after(decl)
	if !f.before(decl) {
		return
	}

	switch n := decl.(type) {
	case *ast.Field:
		f.label(n.Label, n.Optional != token.NoPos)

		regular := isRegularField(n.Token)
		if regular {
			f.print(noblank, nooverride, n.TokenPos, token.COLON)
		} else {
			f.print(blank, nooverride, n.Token)
		}

		if mem := f.inlineField(n); mem != nil {
			switch {
			default:
				fallthrough

			case regular && f.cfg.simplify:
				f.print(blank, nooverride)
				f.decl(mem)

			case mem.Label.Pos().IsNewline():
				f.print(indent, formfeed)
				f.decl(mem)
				f.indent--
			}
			return
		}

		nextFF := f.nextNeedsFormfeed(n.Value)
		tab := vtab
		if nextFF {
			tab = blank
		}

		f.print(tab)

		if n.Value != nil {
			switch n.Value.(type) {
			case *ast.ListLit, *ast.StructLit:
				f.expr(n.Value)
			default:
				f.print(indent)
				f.expr(n.Value)
				f.markUnindentLine()
			}
		} else {
			f.current.pos++
			f.visitComments(f.current.pos)
		}

		space := tab
		for _, a := range n.Attrs {
			if f.before(a) {
				f.print(space, a.At, a)
			}
			f.after(a)
			space = blank
		}

		if nextFF {
			f.print(formfeed)
		}

	case *ast.BadDecl:
		f.print(n.From, "*bad decl*", declcomma)

	case *ast.Package:
		f.print(n.PackagePos, "package")
		f.print(blank, n.Name, newsection, nooverride)

	case *ast.ImportDecl:
		f.print(n.Import, "import")
		if len(n.Specs) == 0 {
			f.print(blank, n.Lparen, token.LPAREN, n.Rparen, token.RPAREN, newline)
			break
		}
		switch {
		case len(n.Specs) == 1 && len(n.Specs[0].Comments()) == 0:
			if !n.Lparen.IsValid() {
				f.print(blank)
				f.walkSpecList(n.Specs)
				break
			}
			fallthrough
		default:
			f.print(blank, n.Lparen, token.LPAREN, newline, indent)
			f.walkSpecList(n.Specs)
			f.print(unindent, newline, n.Rparen, token.RPAREN, newline)
		}
		f.print(newsection, nooverride)

	case *ast.LetClause:
		if !decl.Pos().HasRelPos() || decl.Pos().RelPos() >= token.Newline {
			f.print(formfeed)
		}
		f.print(n.Let, token.LET, blank, nooverride)
		f.expr(n.Ident)
		f.print(blank, nooverride, n.Equal, token.BIND, blank)
		f.expr(n.Expr)
		f.print(declcomma) // implied

	case *ast.EmbedDecl:
		if !n.Pos().HasRelPos() || n.Pos().RelPos() >= token.Newline {
			f.print(formfeed)
		}
		f.expr(n.Expr)
		f.print(newline, noblank)

	case *ast.Attribute:
		f.print(n.At, n)

	case *ast.CommentGroup:
		f.printComment(n)
		f.print(newsection)

	case ast.Expr:
		f.embedding(n)
	}
}

func (f *formatter) embedding(decl ast.Expr) {
	switch n := decl.(type) {
	case *ast.Comprehension:
		if !n.Pos().HasRelPos() || n.Pos().RelPos() >= token.Newline {
			f.print(formfeed)
		}
		f.walkClauseList(n.Clauses, blank)
		f.print(blank, nooverride)
		f.expr(n.Value)

	case *ast.Ellipsis:
		f.ellipsis(n)

	case *ast.Alias:
		if !decl.Pos().HasRelPos() || decl.Pos().RelPos() >= token.Newline {
			f.print(formfeed)
		}
		f.expr(n.Ident)
		f.print(blank, n.Equal, token.BIND, blank)
		f.expr(n.Expr)
		f.print(declcomma) // implied

		// TODO: ast.CommentGroup: allows comment groups in ListLits.

	case ast.Expr:
		f.exprRaw(n, token.LowestPrec, 1)
	}
}

func (f *formatter) nextNeedsFormfeed(n ast.Expr) bool {
	switch x := n.(type) {
	case *ast.StructLit:
		return true
	case *ast.BasicLit:
		return strings.IndexByte(x.Value, '\n') >= 0
	case *ast.ListLit:
		return true
	}
	return false
}

func (f *formatter) importSpec(x *ast.ImportSpec) {
	if x.Name != nil {
		f.label(x.Name, false)
		f.print(blank)
	} else {
		f.current.pos++
		f.visitComments(f.current.pos)
	}
	f.expr(x.Path)
	f.print(newline)
}

func isValidIdent(ident string) bool {
	var scan scanner.Scanner
	scan.Init(token.NewFile("check", -1, len(ident)), []byte(ident), nil, 0)

	_, tok, lit := scan.Scan()
	if tok == token.IDENT || tok.IsKeyword() {
		return lit == ident
	}
	return false
}

func (f *formatter) label(l ast.Label, optional bool) {
	f.before(l)
	defer f.after(l)
	switch n := l.(type) {
	case *ast.Alias:
		f.expr(n)

	case *ast.Ident:
		// Escape an identifier that has invalid characters. This may happen,
		// if the AST is not generated by the parser.
		name := n.Name
		if !ast.IsValidIdent(name) {
			name = literal.String.Quote(n.Name)
		}
		f.print(n.NamePos, name)

	case *ast.BasicLit:
		str := n.Value
		// Allow any CUE string in the AST, but ensure it is formatted
		// according to spec.
		if strings.HasPrefix(str, `"""`) || strings.HasPrefix(str, "#") {
			if u, err := literal.Unquote(str); err == nil {
				str = literal.String.Quote(u)
			}
		}
		f.print(n.ValuePos, str)

	case *ast.ListLit:
		f.expr(n)

	case *ast.ParenExpr:
		f.expr(n)

	case *ast.Interpolation:
		f.expr(n)

	default:
		panic(fmt.Sprintf("unknown label type %T", n))
	}
	if optional {
		f.print(token.OPTION)
	}
}

func (f *formatter) ellipsis(x *ast.Ellipsis) {
	f.print(x.Ellipsis, token.ELLIPSIS)
	if x.Type != nil && !isTop(x.Type) {
		f.expr(x.Type)
	}
}

func (f *formatter) expr(x ast.Expr) {
	const depth = 1
	f.expr1(x, token.LowestPrec, depth)
}

func (f *formatter) expr0(x ast.Expr, depth int) {
	f.expr1(x, token.LowestPrec, depth)
}

func (f *formatter) expr1(expr ast.Expr, prec1, depth int) {
	if f.before(expr) {
		f.exprRaw(expr, prec1, depth)
	}
	f.after(expr)
}

func (f *formatter) exprRaw(expr ast.Expr, prec1, depth int) {

	switch x := expr.(type) {
	case *ast.BadExpr:
		f.print(x.From, "_|_")

	case *ast.BottomLit:
		f.print(x.Bottom, token.BOTTOM)

	case *ast.Alias:
		// Aliases in expression positions are printed in short form.
		f.label(x.Ident, false)
		f.print(x.Equal, token.BIND)
		f.expr(x.Expr)

	case *ast.Ident:
		f.print(x.NamePos, x)

	case *ast.BinaryExpr:
		if depth < 1 {
			f.internalError("depth < 1:", depth)
			depth = 1
		}
		f.binaryExpr(x, prec1, cutoff(x, depth), depth)

	case *ast.UnaryExpr:
		const prec = token.UnaryPrec
		if prec < prec1 {
			// parenthesis needed
			f.print(token.LPAREN, nooverride)
			f.expr(x)
			f.print(token.RPAREN)
		} else {
			// no parenthesis needed
			f.print(x.OpPos, x.Op, nooverride)
			f.expr1(x.X, prec, depth)
		}

	case *ast.BasicLit:
		f.print(x.ValuePos, x)

	case *ast.Interpolation:
		f.before(nil)
		for _, x := range x.Elts {
			f.expr0(x, depth+1)
		}
		f.after(nil)

	case *ast.ParenExpr:
		if _, hasParens := x.X.(*ast.ParenExpr); hasParens {
			// don't print parentheses around an already parenthesized expression
			// TODO: consider making this more general and incorporate precedence levels
			f.expr0(x.X, depth)
		} else {
			f.print(x.Lparen, token.LPAREN)
			f.expr0(x.X, reduceDepth(depth)) // parentheses undo one level of depth
			f.print(x.Rparen, token.RPAREN)
		}

	case *ast.SelectorExpr:
		f.selectorExpr(x, depth)

	case *ast.IndexExpr:
		f.expr1(x.X, token.HighestPrec, 1)
		f.print(x.Lbrack, token.LBRACK)
		f.expr0(x.Index, depth+1)
		f.print(x.Rbrack, token.RBRACK)

	case *ast.SliceExpr:
		f.expr1(x.X, token.HighestPrec, 1)
		f.print(x.Lbrack, token.LBRACK)
		indices := []ast.Expr{x.Low, x.High}
		for i, y := range indices {
			if i > 0 {
				// blanks around ":" if both sides exist and either side is a binary expression
				x := indices[i-1]
				if depth <= 1 && x != nil && y != nil && (isBinary(x) || isBinary(y)) {
					f.print(blank, token.COLON, blank)
				} else {
					f.print(token.COLON)
				}
			}
			if y != nil {
				f.expr0(y, depth+1)
			}
		}
		f.print(x.Rbrack, token.RBRACK)

	case *ast.CallExpr:
		if len(x.Args) > 1 {
			depth++
		}
		wasIndented := f.possibleSelectorExpr(x.Fun, token.HighestPrec, depth)
		f.print(x.Lparen, token.LPAREN)
		f.walkArgsList(x.Args, depth)
		f.print(trailcomma, noblank, x.Rparen, token.RPAREN)
		if wasIndented {
			f.print(unindent)
		}

	case *ast.StructLit:
		var l line
		ws := noblank
		ff := f.formfeed()

		switch {
		case len(x.Elts) == 0:
			if !x.Rbrace.HasRelPos() {
				// collapse curly braces if the body is empty.
				ffAlt := blank | nooverride
				for _, c := range x.Comments() {
					if c.Position == 1 {
						ffAlt = ff
					}
				}
				ff = ffAlt
			}
		case !x.Rbrace.HasRelPos() || !x.Elts[0].Pos().HasRelPos():
			ws |= newline | nooverride
		}
		f.print(x.Lbrace, token.LBRACE, &l, ws, ff, indent)

		f.walkDeclList(x.Elts)
		f.matchUnindent()

		ws = noblank
		if f.lineout != l {
			ws |= newline
			if f.lastTok != token.RBRACE && f.lastTok != token.RBRACK {
				ws |= nooverride
			}
		}
		f.print(ws, x.Rbrace, token.RBRACE)

	case *ast.ListLit:
		f.print(x.Lbrack, token.LBRACK, indent)
		f.walkListElems(x.Elts)
		f.print(trailcomma, noblank)
		f.visitComments(f.current.pos)
		f.matchUnindent()
		f.print(noblank, x.Rbrack, token.RBRACK)

	case *ast.Ellipsis:
		f.ellipsis(x)

	default:
		panic(fmt.Sprintf("unimplemented type %T", x))
	}
}

func (f *formatter) clause(clause ast.Clause) {
	switch n := clause.(type) {
	case *ast.ForClause:
		f.print(n.For, "for", blank)
		f.print(indent)
		if n.Key != nil {
			f.label(n.Key, false)
			f.print(n.Colon, token.COMMA, blank)
		} else {
			f.current.pos++
			f.visitComments(f.current.pos)
		}
		f.label(n.Value, false)
		f.print(blank, n.In, "in", blank)
		f.expr(n.Source)
		f.markUnindentLine()

	case *ast.IfClause:
		f.print(n.If, "if", blank)
		f.print(indent)
		f.expr(n.Condition)
		f.markUnindentLine()

	case *ast.LetClause:
		f.print(n.Let, token.LET, blank, nooverride)
		f.print(indent)
		f.expr(n.Ident)
		f.print(blank, nooverride, n.Equal, token.BIND, blank)
		f.expr(n.Expr)
		f.markUnindentLine()

	default:
		panic("unknown clause type")
	}
}

func walkBinary(e *ast.BinaryExpr) (has6, has7, has8 bool, maxProblem int) {
	switch e.Op.Precedence() {
	case 6:
		has6 = true
	case 7:
		has7 = true
	case 8:
		has8 = true
	}

	switch l := e.X.(type) {
	case *ast.BinaryExpr:
		if l.Op.Precedence() < e.Op.Precedence() {
			// parens will be inserted.
			// pretend this is an *syntax.ParenExpr and do nothing.
			break
		}
		h6, h7, h8, mp := walkBinary(l)
		has6 = has6 || h6
		has7 = has7 || h7
		has8 = has8 || h8
		if maxProblem < mp {
			maxProblem = mp
		}
	}

	switch r := e.Y.(type) {
	case *ast.BinaryExpr:
		if r.Op.Precedence() <= e.Op.Precedence() {
			// parens will be inserted.
			// pretend this is an *syntax.ParenExpr and do nothing.
			break
		}
		h6, h7, h8, mp := walkBinary(r)
		has6 = has6 || h6
		has7 = has7 || h7
		has8 = has8 || h8
		if maxProblem < mp {
			maxProblem = mp
		}

	case *ast.UnaryExpr:
		switch e.Op.String() + r.Op.String() {
		case "/*":
			maxProblem = 8
		case "++", "--":
			if maxProblem < 6 {
				maxProblem = 6
			}
		}
	}
	return
}

func cutoff(e *ast.BinaryExpr, depth int) int {
	has6, has7, has8, maxProblem := walkBinary(e)
	if maxProblem > 0 {
		return maxProblem + 1
	}
	if (has6 || has7) && has8 {
		if depth == 1 {
			return 8
		}
		if has7 {
			return 7
		}
		return 6
	}
	if has6 && has7 {
		if depth == 1 {
			return 7
		}
		return 6
	}
	if depth == 1 {
		return 8
	}
	return 6
}

func diffPrec(expr ast.Expr, prec int) int {
	x, ok := expr.(*ast.BinaryExpr)
	if !ok || prec != x.Op.Precedence() {
		return 1
	}
	return 0
}

func reduceDepth(depth int) int {
	depth--
	if depth < 1 {
		depth = 1
	}
	return depth
}

// Format the binary expression: decide the cutoff and then format.
// Let's call depth == 1 Normal mode, and depth > 1 Compact mode.
// (Algorithm suggestion by Russ Cox.)
//
// The precedences are:
//
//	7             *  /  % quo rem div mod
//	6             +  -
//	5             ==  !=  <  <=  >  >=
//	4             &&
//	3             ||
//	2             &
//	1             |
//
// The only decision is whether there will be spaces around levels 6 and 7.
// There are never spaces at level 8 (unary), and always spaces at levels 5 and below.
//
// To choose the cutoff, look at the whole expression but excluding primary
// expressions (function calls, parenthesized exprs), and apply these rules:
//
//  1. If there is a binary operator with a right side unary operand
//     that would clash without a space, the cutoff must be (in order):
//
//     /*	8
//     ++	7 // not necessary, but to avoid confusion
//     --	7
//
//     (Comparison operators always have spaces around them.)
//
//  2. If there is a mix of level 7 and level 6 operators, then the cutoff
//     is 7 (use spaces to distinguish precedence) in Normal mode
//     and 6 (never use spaces) in Compact mode.
//
//  3. If there are no level 6 operators or no level 7 operators, then the
//     cutoff is 8 (always use spaces) in Normal mode
//     and 6 (never use spaces) in Compact mode.
func (f *formatter) binaryExpr(x *ast.BinaryExpr, prec1, cutoff, depth int) {
	f.nestExpr++
	defer func() { f.nestExpr-- }()

	prec := x.Op.Precedence()
	if prec < prec1 {
		// parenthesis needed
		// Note: The parser inserts an syntax.ParenExpr node; thus this case
		//       can only occur if the AST is created in a different way.
		// defer p.pushComment(nil).pop()
		f.print(token.LPAREN, nooverride)
		f.expr0(x, reduceDepth(depth)) // parentheses undo one level of depth
		f.print(token.RPAREN)
		return
	}

	printBlank := prec < cutoff

	f.expr1(x.X, prec, depth+diffPrec(x.X, prec))
	f.print(nooverride)
	if printBlank {
		f.print(blank)
	}
	f.print(x.OpPos, x.Op)
	if x.Y.Pos().IsNewline() {
		// at least one line break, but respect an extra empty line
		// in the source
		f.print(formfeed)
		printBlank = false // no blank after line break
	} else {
		f.print(nooverride)
	}
	if printBlank {
		f.print(blank)
	}
	f.expr1(x.Y, prec+1, depth+1)
}

func isBinary(expr ast.Expr) bool {
	_, ok := expr.(*ast.BinaryExpr)
	return ok
}

func (f *formatter) possibleSelectorExpr(expr ast.Expr, prec1, depth int) bool {
	if x, ok := expr.(*ast.SelectorExpr); ok {
		return f.selectorExpr(x, depth)
	}
	f.expr1(expr, prec1, depth)
	return false
}

// selectorExpr handles an *syntax.SelectorExpr node and returns whether x spans
// multiple lines.
func (f *formatter) selectorExpr(x *ast.SelectorExpr, depth int) bool {
	f.expr1(x.X, token.HighestPrec, depth)
	f.print(token.PERIOD)
	if x.Sel.Pos().IsNewline() {
		f.print(indent, formfeed)
		f.expr(x.Sel.(ast.Expr))
		f.print(unindent)
		return true
	}
	f.print(noblank)
	f.expr(x.Sel.(ast.Expr))
	return false
}

func isTop(e ast.Expr) bool {
	ident, ok := e.(*ast.Ident)
	return ok && ident.Name == "_"
}
