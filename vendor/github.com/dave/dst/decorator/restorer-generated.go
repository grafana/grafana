package decorator

import (
	"fmt"
	"go/ast"
	"go/token"

	"github.com/dave/dst"
)

func (r *FileRestorer) restoreNode(n dst.Node, parentName, parentField, parentFieldType string, allowDuplicate bool) ast.Node {
	if an, ok := r.Ast.Nodes[n]; ok {
		if allowDuplicate {
			return an
		} else {
			panic(fmt.Sprintf("duplicate node: %#v", n))
		}
	}
	switch n := n.(type) {
	case *dst.ArrayType:
		out := &ast.ArrayType{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Lbrack
		out.Lbrack = r.cursor
		r.cursor += token.Pos(len(token.LBRACK.String()))

		// Decoration: Lbrack
		r.applyDecorations(out, "Lbrack", n.Decs.Lbrack, false)

		// Node: Len
		if n.Len != nil {
			out.Len = r.restoreNode(n.Len, "ArrayType", "Len", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: Rbrack
		r.cursor += token.Pos(len(token.RBRACK.String()))

		// Decoration: Len
		r.applyDecorations(out, "Len", n.Decs.Len, false)

		// Node: Elt
		if n.Elt != nil {
			out.Elt = r.restoreNode(n.Elt, "ArrayType", "Elt", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.AssignStmt:
		out := &ast.AssignStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// List: Lhs
		for _, v := range n.Lhs {
			out.Lhs = append(out.Lhs, r.restoreNode(v, "AssignStmt", "Lhs", "Expr", allowDuplicate).(ast.Expr))
		}

		// Token: Tok
		out.Tok = n.Tok
		out.TokPos = r.cursor
		r.cursor += token.Pos(len(n.Tok.String()))

		// Decoration: Tok
		r.applyDecorations(out, "Tok", n.Decs.Tok, false)

		// List: Rhs
		for _, v := range n.Rhs {
			out.Rhs = append(out.Rhs, r.restoreNode(v, "AssignStmt", "Rhs", "Expr", allowDuplicate).(ast.Expr))
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.BadDecl:
		out := &ast.BadDecl{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Bad
		out.From = r.cursor
		r.cursor += token.Pos(n.Length)
		out.To = r.cursor

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.BadExpr:
		out := &ast.BadExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Bad
		out.From = r.cursor
		r.cursor += token.Pos(n.Length)
		out.To = r.cursor

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.BadStmt:
		out := &ast.BadStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Bad
		out.From = r.cursor
		r.cursor += token.Pos(n.Length)
		out.To = r.cursor

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.BasicLit:
		out := &ast.BasicLit{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// String: Value
		r.applyLiteral(n.Value)
		out.ValuePos = r.cursor
		out.Value = n.Value
		r.cursor += token.Pos(len(n.Value))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)

		// Value: Kind
		out.Kind = n.Kind
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.BinaryExpr:
		out := &ast.BinaryExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "BinaryExpr", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// Token: Op
		out.Op = n.Op
		out.OpPos = r.cursor
		r.cursor += token.Pos(len(n.Op.String()))

		// Decoration: Op
		r.applyDecorations(out, "Op", n.Decs.Op, false)

		// Node: Y
		if n.Y != nil {
			out.Y = r.restoreNode(n.Y, "BinaryExpr", "Y", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.BlockStmt:
		out := &ast.BlockStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Lbrace
		out.Lbrace = r.cursor
		r.cursor += token.Pos(len(token.LBRACE.String()))

		// Decoration: Lbrace
		r.applyDecorations(out, "Lbrace", n.Decs.Lbrace, false)

		// List: List
		for _, v := range n.List {
			out.List = append(out.List, r.restoreNode(v, "BlockStmt", "List", "Stmt", allowDuplicate).(ast.Stmt))
		}

		// Token: Rbrace
		if n.RbraceHasNoPos {
			out.Rbrace = token.NoPos
		} else {
			out.Rbrace = r.cursor
		}
		r.cursor += token.Pos(len(token.RBRACE.String()))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.BranchStmt:
		out := &ast.BranchStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Tok
		out.Tok = n.Tok
		out.TokPos = r.cursor
		r.cursor += token.Pos(len(n.Tok.String()))

		// Decoration: Tok
		r.applyDecorations(out, "Tok", n.Decs.Tok, false)

		// Node: Label
		if n.Label != nil {
			out.Label = r.restoreNode(n.Label, "BranchStmt", "Label", "Ident", allowDuplicate).(*ast.Ident)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.CallExpr:
		out := &ast.CallExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: Fun
		if n.Fun != nil {
			out.Fun = r.restoreNode(n.Fun, "CallExpr", "Fun", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Fun
		r.applyDecorations(out, "Fun", n.Decs.Fun, false)

		// Token: Lparen
		out.Lparen = r.cursor
		r.cursor += token.Pos(len(token.LPAREN.String()))

		// Decoration: Lparen
		r.applyDecorations(out, "Lparen", n.Decs.Lparen, false)

		// List: Args
		for _, v := range n.Args {
			out.Args = append(out.Args, r.restoreNode(v, "CallExpr", "Args", "Expr", allowDuplicate).(ast.Expr))
		}

		// Token: Ellipsis
		if n.Ellipsis {
			out.Ellipsis = r.cursor
			r.cursor += token.Pos(len(token.ELLIPSIS.String()))
		}

		// Decoration: Ellipsis
		r.applyDecorations(out, "Ellipsis", n.Decs.Ellipsis, false)

		// Token: Rparen
		out.Rparen = r.cursor
		r.cursor += token.Pos(len(token.RPAREN.String()))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.CaseClause:
		out := &ast.CaseClause{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Case
		out.Case = r.cursor
		r.cursor += token.Pos(len(func() token.Token {
			if n.List == nil {
				return token.DEFAULT
			}
			return token.CASE
		}().String()))

		// Decoration: Case
		r.applyDecorations(out, "Case", n.Decs.Case, false)

		// List: List
		for _, v := range n.List {
			out.List = append(out.List, r.restoreNode(v, "CaseClause", "List", "Expr", allowDuplicate).(ast.Expr))
		}

		// Token: Colon
		out.Colon = r.cursor
		r.cursor += token.Pos(len(token.COLON.String()))

		// Decoration: Colon
		r.applyDecorations(out, "Colon", n.Decs.Colon, false)

		// List: Body
		for _, v := range n.Body {
			out.Body = append(out.Body, r.restoreNode(v, "CaseClause", "Body", "Stmt", allowDuplicate).(ast.Stmt))
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.ChanType:
		out := &ast.ChanType{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Begin
		out.Begin = r.cursor
		r.cursor += token.Pos(len(func() token.Token {
			if n.Dir == dst.RECV {
				return token.ARROW
			}
			return token.CHAN
		}().String()))

		// Token: Chan
		if n.Dir == dst.RECV {
			r.cursor += token.Pos(len(token.CHAN.String()))
		}

		// Decoration: Begin
		r.applyDecorations(out, "Begin", n.Decs.Begin, false)

		// Token: Arrow
		if n.Dir == dst.SEND {
			out.Arrow = r.cursor
			r.cursor += token.Pos(len(token.ARROW.String()))
		}

		// Decoration: Arrow
		r.applyDecorations(out, "Arrow", n.Decs.Arrow, false)

		// Node: Value
		if n.Value != nil {
			out.Value = r.restoreNode(n.Value, "ChanType", "Value", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)

		// Value: Dir
		out.Dir = ast.ChanDir(n.Dir)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.CommClause:
		out := &ast.CommClause{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Case
		out.Case = r.cursor
		r.cursor += token.Pos(len(func() token.Token {
			if n.Comm == nil {
				return token.DEFAULT
			}
			return token.CASE
		}().String()))

		// Decoration: Case
		r.applyDecorations(out, "Case", n.Decs.Case, false)

		// Node: Comm
		if n.Comm != nil {
			out.Comm = r.restoreNode(n.Comm, "CommClause", "Comm", "Stmt", allowDuplicate).(ast.Stmt)
		}

		// Decoration: Comm
		r.applyDecorations(out, "Comm", n.Decs.Comm, false)

		// Token: Colon
		out.Colon = r.cursor
		r.cursor += token.Pos(len(token.COLON.String()))

		// Decoration: Colon
		r.applyDecorations(out, "Colon", n.Decs.Colon, false)

		// List: Body
		for _, v := range n.Body {
			out.Body = append(out.Body, r.restoreNode(v, "CommClause", "Body", "Stmt", allowDuplicate).(ast.Stmt))
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.CompositeLit:
		out := &ast.CompositeLit{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: Type
		if n.Type != nil {
			out.Type = r.restoreNode(n.Type, "CompositeLit", "Type", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Type
		r.applyDecorations(out, "Type", n.Decs.Type, false)

		// Token: Lbrace
		out.Lbrace = r.cursor
		r.cursor += token.Pos(len(token.LBRACE.String()))

		// Decoration: Lbrace
		r.applyDecorations(out, "Lbrace", n.Decs.Lbrace, false)

		// List: Elts
		for _, v := range n.Elts {
			out.Elts = append(out.Elts, r.restoreNode(v, "CompositeLit", "Elts", "Expr", allowDuplicate).(ast.Expr))
		}

		// Token: Rbrace
		out.Rbrace = r.cursor
		r.cursor += token.Pos(len(token.RBRACE.String()))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)

		// Value: Incomplete
		out.Incomplete = n.Incomplete
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.DeclStmt:
		out := &ast.DeclStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: Decl
		if n.Decl != nil {
			out.Decl = r.restoreNode(n.Decl, "DeclStmt", "Decl", "Decl", allowDuplicate).(ast.Decl)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.DeferStmt:
		out := &ast.DeferStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Defer
		out.Defer = r.cursor
		r.cursor += token.Pos(len(token.DEFER.String()))

		// Decoration: Defer
		r.applyDecorations(out, "Defer", n.Decs.Defer, false)

		// Node: Call
		if n.Call != nil {
			out.Call = r.restoreNode(n.Call, "DeferStmt", "Call", "CallExpr", allowDuplicate).(*ast.CallExpr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.Ellipsis:
		out := &ast.Ellipsis{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Ellipsis
		out.Ellipsis = r.cursor
		r.cursor += token.Pos(len(token.ELLIPSIS.String()))

		// Decoration: Ellipsis
		r.applyDecorations(out, "Ellipsis", n.Decs.Ellipsis, false)

		// Node: Elt
		if n.Elt != nil {
			out.Elt = r.restoreNode(n.Elt, "Ellipsis", "Elt", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.EmptyStmt:
		out := &ast.EmptyStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Semicolon
		if !n.Implicit {
			out.Semicolon = r.cursor
			r.cursor += token.Pos(len(token.ARROW.String()))
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)

		// Value: Implicit
		out.Implicit = n.Implicit
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.ExprStmt:
		out := &ast.ExprStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "ExprStmt", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.Field:
		out := &ast.Field{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// List: Names
		for _, v := range n.Names {
			out.Names = append(out.Names, r.restoreNode(v, "Field", "Names", "Ident", allowDuplicate).(*ast.Ident))
		}

		// Node: Type
		if n.Type != nil {
			out.Type = r.restoreNode(n.Type, "Field", "Type", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Type
		r.applyDecorations(out, "Type", n.Decs.Type, false)

		// Node: Tag
		if n.Tag != nil {
			out.Tag = r.restoreNode(n.Tag, "Field", "Tag", "BasicLit", allowDuplicate).(*ast.BasicLit)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.FieldList:
		out := &ast.FieldList{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Opening
		if n.Opening {
			out.Opening = r.cursor
			r.cursor += token.Pos(len(token.LPAREN.String()))
		}

		// Decoration: Opening
		r.applyDecorations(out, "Opening", n.Decs.Opening, false)

		// List: List
		for _, v := range n.List {
			out.List = append(out.List, r.restoreNode(v, "FieldList", "List", "Field", allowDuplicate).(*ast.Field))
		}

		// Token: Closing
		if n.Closing {
			out.Closing = r.cursor
			r.cursor += token.Pos(len(token.RPAREN.String()))
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.File:
		out := &ast.File{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Package
		out.Package = r.cursor
		r.cursor += token.Pos(len(token.PACKAGE.String()))

		// Decoration: Package
		r.applyDecorations(out, "Package", n.Decs.Package, false)

		// Node: Name
		if n.Name != nil {
			out.Name = r.restoreNode(n.Name, "File", "Name", "Ident", allowDuplicate).(*ast.Ident)
		}

		// Decoration: Name
		r.applyDecorations(out, "Name", n.Decs.Name, false)

		// List: Decls
		for _, v := range n.Decls {
			out.Decls = append(out.Decls, r.restoreNode(v, "File", "Decls", "Decl", allowDuplicate).(ast.Decl))
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)

		// Scope: Scope
		out.Scope = r.restoreScope(n.Scope)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.ForStmt:
		out := &ast.ForStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: For
		out.For = r.cursor
		r.cursor += token.Pos(len(token.FOR.String()))

		// Decoration: For
		r.applyDecorations(out, "For", n.Decs.For, false)

		// Node: Init
		if n.Init != nil {
			out.Init = r.restoreNode(n.Init, "ForStmt", "Init", "Stmt", allowDuplicate).(ast.Stmt)
		}

		// Token: InitSemicolon
		if n.Init != nil {
			r.cursor += token.Pos(len(token.SEMICOLON.String()))
		}

		// Decoration: Init
		r.applyDecorations(out, "Init", n.Decs.Init, false)

		// Node: Cond
		if n.Cond != nil {
			out.Cond = r.restoreNode(n.Cond, "ForStmt", "Cond", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: CondSemicolon
		if n.Post != nil {
			r.cursor += token.Pos(len(token.SEMICOLON.String()))
		}

		// Decoration: Cond
		r.applyDecorations(out, "Cond", n.Decs.Cond, false)

		// Node: Post
		if n.Post != nil {
			out.Post = r.restoreNode(n.Post, "ForStmt", "Post", "Stmt", allowDuplicate).(ast.Stmt)
		}

		// Decoration: Post
		r.applyDecorations(out, "Post", n.Decs.Post, false)

		// Node: Body
		if n.Body != nil {
			out.Body = r.restoreNode(n.Body, "ForStmt", "Body", "BlockStmt", allowDuplicate).(*ast.BlockStmt)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.FuncDecl:
		out := &ast.FuncDecl{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Init: Type
		out.Type = &ast.FuncType{}

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Special decoration: Start
		r.applyDecorations(out, "Start", n.Type.Decs.Start, false)

		// Token: Func
		if true {
			out.Type.Func = r.cursor
			r.cursor += token.Pos(len(token.FUNC.String()))
		}

		// Decoration: Func
		r.applyDecorations(out, "Func", n.Decs.Func, false)

		// Special decoration: Func
		r.applyDecorations(out, "Func", n.Type.Decs.Func, false)

		// Node: Recv
		if n.Recv != nil {
			out.Recv = r.restoreNode(n.Recv, "FuncDecl", "Recv", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: Recv
		r.applyDecorations(out, "Recv", n.Decs.Recv, false)

		// Node: Name
		if n.Name != nil {
			out.Name = r.restoreNode(n.Name, "FuncDecl", "Name", "Ident", allowDuplicate).(*ast.Ident)
		}

		// Decoration: Name
		r.applyDecorations(out, "Name", n.Decs.Name, false)

		// Node: TypeParams
		if n.Type.TypeParams != nil {
			out.Type.TypeParams = r.restoreNode(n.Type.TypeParams, "FuncDecl", "TypeParams", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: TypeParams
		r.applyDecorations(out, "TypeParams", n.Decs.TypeParams, false)

		// Special decoration: TypeParams
		r.applyDecorations(out, "TypeParams", n.Type.Decs.TypeParams, false)

		// Node: Params
		if n.Type.Params != nil {
			out.Type.Params = r.restoreNode(n.Type.Params, "FuncDecl", "Params", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: Params
		r.applyDecorations(out, "Params", n.Decs.Params, false)

		// Special decoration: Params
		r.applyDecorations(out, "Params", n.Type.Decs.Params, false)

		// Node: Results
		if n.Type.Results != nil {
			out.Type.Results = r.restoreNode(n.Type.Results, "FuncDecl", "Results", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: Results
		r.applyDecorations(out, "Results", n.Decs.Results, false)

		// Special decoration: End
		r.applyDecorations(out, "End", n.Type.Decs.End, false)

		// Node: Body
		if n.Body != nil {
			out.Body = r.restoreNode(n.Body, "FuncDecl", "Body", "BlockStmt", allowDuplicate).(*ast.BlockStmt)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.FuncLit:
		out := &ast.FuncLit{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: Type
		if n.Type != nil {
			out.Type = r.restoreNode(n.Type, "FuncLit", "Type", "FuncType", allowDuplicate).(*ast.FuncType)
		}

		// Decoration: Type
		r.applyDecorations(out, "Type", n.Decs.Type, false)

		// Node: Body
		if n.Body != nil {
			out.Body = r.restoreNode(n.Body, "FuncLit", "Body", "BlockStmt", allowDuplicate).(*ast.BlockStmt)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.FuncType:
		out := &ast.FuncType{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Func
		if n.Func {
			out.Func = r.cursor
			r.cursor += token.Pos(len(token.FUNC.String()))
		}

		// Decoration: Func
		r.applyDecorations(out, "Func", n.Decs.Func, false)

		// Node: TypeParams
		if n.TypeParams != nil {
			out.TypeParams = r.restoreNode(n.TypeParams, "FuncType", "TypeParams", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: TypeParams
		r.applyDecorations(out, "TypeParams", n.Decs.TypeParams, false)

		// Node: Params
		if n.Params != nil {
			out.Params = r.restoreNode(n.Params, "FuncType", "Params", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: Params
		r.applyDecorations(out, "Params", n.Decs.Params, false)

		// Node: Results
		if n.Results != nil {
			out.Results = r.restoreNode(n.Results, "FuncType", "Results", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.GenDecl:
		out := &ast.GenDecl{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Tok
		out.Tok = n.Tok
		out.TokPos = r.cursor
		r.cursor += token.Pos(len(n.Tok.String()))

		// Decoration: Tok
		r.applyDecorations(out, "Tok", n.Decs.Tok, false)

		// Token: Lparen
		if n.Lparen {
			out.Lparen = r.cursor
			r.cursor += token.Pos(len(token.LPAREN.String()))
		}

		// Decoration: Lparen
		r.applyDecorations(out, "Lparen", n.Decs.Lparen, false)

		// List: Specs
		for _, v := range n.Specs {
			out.Specs = append(out.Specs, r.restoreNode(v, "GenDecl", "Specs", "Spec", allowDuplicate).(ast.Spec))
		}

		// Token: Rparen
		if n.Rparen {
			out.Rparen = r.cursor
			r.cursor += token.Pos(len(token.RPAREN.String()))
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.GoStmt:
		out := &ast.GoStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Go
		out.Go = r.cursor
		r.cursor += token.Pos(len(token.GO.String()))

		// Decoration: Go
		r.applyDecorations(out, "Go", n.Decs.Go, false)

		// Node: Call
		if n.Call != nil {
			out.Call = r.restoreNode(n.Call, "GoStmt", "Call", "CallExpr", allowDuplicate).(*ast.CallExpr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.Ident:

		// Special case for *dst.Ident - replace with SelectorExpr if needed
		sel := r.restoreIdent(n, parentName, parentField, parentFieldType, allowDuplicate)
		if sel != nil {
			return sel
		}

		out := &ast.Ident{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// String: Name
		out.NamePos = r.cursor
		out.Name = n.Name
		r.cursor += token.Pos(len(n.Name))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)

		// Object: Obj
		out.Obj = r.restoreObject(n.Obj)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.IfStmt:
		out := &ast.IfStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: If
		out.If = r.cursor
		r.cursor += token.Pos(len(token.IF.String()))

		// Decoration: If
		r.applyDecorations(out, "If", n.Decs.If, false)

		// Node: Init
		if n.Init != nil {
			out.Init = r.restoreNode(n.Init, "IfStmt", "Init", "Stmt", allowDuplicate).(ast.Stmt)
		}

		// Decoration: Init
		r.applyDecorations(out, "Init", n.Decs.Init, false)

		// Node: Cond
		if n.Cond != nil {
			out.Cond = r.restoreNode(n.Cond, "IfStmt", "Cond", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Cond
		r.applyDecorations(out, "Cond", n.Decs.Cond, false)

		// Node: Body
		if n.Body != nil {
			out.Body = r.restoreNode(n.Body, "IfStmt", "Body", "BlockStmt", allowDuplicate).(*ast.BlockStmt)
		}

		// Token: ElseTok
		if n.Else != nil {
			r.cursor += token.Pos(len(token.ELSE.String()))
		}

		// Decoration: Else
		r.applyDecorations(out, "Else", n.Decs.Else, false)

		// Node: Else
		if n.Else != nil {
			out.Else = r.restoreNode(n.Else, "IfStmt", "Else", "Stmt", allowDuplicate).(ast.Stmt)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.ImportSpec:
		out := &ast.ImportSpec{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: Name
		if n.Name != nil {
			out.Name = r.restoreNode(n.Name, "ImportSpec", "Name", "Ident", allowDuplicate).(*ast.Ident)
		}

		// Decoration: Name
		r.applyDecorations(out, "Name", n.Decs.Name, false)

		// Node: Path
		if n.Path != nil {
			out.Path = r.restoreNode(n.Path, "ImportSpec", "Path", "BasicLit", allowDuplicate).(*ast.BasicLit)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.IncDecStmt:
		out := &ast.IncDecStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "IncDecStmt", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// Token: Tok
		out.Tok = n.Tok
		out.TokPos = r.cursor
		r.cursor += token.Pos(len(n.Tok.String()))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.IndexExpr:
		out := &ast.IndexExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "IndexExpr", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// Token: Lbrack
		out.Lbrack = r.cursor
		r.cursor += token.Pos(len(token.LBRACK.String()))

		// Decoration: Lbrack
		r.applyDecorations(out, "Lbrack", n.Decs.Lbrack, false)

		// Node: Index
		if n.Index != nil {
			out.Index = r.restoreNode(n.Index, "IndexExpr", "Index", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Index
		r.applyDecorations(out, "Index", n.Decs.Index, false)

		// Token: Rbrack
		out.Rbrack = r.cursor
		r.cursor += token.Pos(len(token.RBRACK.String()))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.IndexListExpr:
		out := &ast.IndexListExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "IndexListExpr", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// Token: Lbrack
		out.Lbrack = r.cursor
		r.cursor += token.Pos(len(token.LBRACK.String()))

		// Decoration: Lbrack
		r.applyDecorations(out, "Lbrack", n.Decs.Lbrack, false)

		// List: Indices
		for _, v := range n.Indices {
			out.Indices = append(out.Indices, r.restoreNode(v, "IndexListExpr", "Indices", "Expr", allowDuplicate).(ast.Expr))
		}

		// Decoration: Indices
		r.applyDecorations(out, "Indices", n.Decs.Indices, false)

		// Token: Rbrack
		out.Rbrack = r.cursor
		r.cursor += token.Pos(len(token.RBRACK.String()))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.InterfaceType:
		out := &ast.InterfaceType{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Interface
		out.Interface = r.cursor
		r.cursor += token.Pos(len(token.INTERFACE.String()))

		// Decoration: Interface
		r.applyDecorations(out, "Interface", n.Decs.Interface, false)

		// Node: Methods
		if n.Methods != nil {
			out.Methods = r.restoreNode(n.Methods, "InterfaceType", "Methods", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)

		// Value: Incomplete
		out.Incomplete = n.Incomplete
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.KeyValueExpr:
		out := &ast.KeyValueExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: Key
		if n.Key != nil {
			out.Key = r.restoreNode(n.Key, "KeyValueExpr", "Key", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Key
		r.applyDecorations(out, "Key", n.Decs.Key, false)

		// Token: Colon
		out.Colon = r.cursor
		r.cursor += token.Pos(len(token.COLON.String()))

		// Decoration: Colon
		r.applyDecorations(out, "Colon", n.Decs.Colon, false)

		// Node: Value
		if n.Value != nil {
			out.Value = r.restoreNode(n.Value, "KeyValueExpr", "Value", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.LabeledStmt:
		out := &ast.LabeledStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: Label
		if n.Label != nil {
			out.Label = r.restoreNode(n.Label, "LabeledStmt", "Label", "Ident", allowDuplicate).(*ast.Ident)
		}

		// Decoration: Label
		r.applyDecorations(out, "Label", n.Decs.Label, false)

		// Token: Colon
		out.Colon = r.cursor
		r.cursor += token.Pos(len(token.COLON.String()))

		// Decoration: Colon
		r.applyDecorations(out, "Colon", n.Decs.Colon, false)

		// Node: Stmt
		if n.Stmt != nil {
			out.Stmt = r.restoreNode(n.Stmt, "LabeledStmt", "Stmt", "Stmt", allowDuplicate).(ast.Stmt)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.MapType:
		out := &ast.MapType{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Map
		out.Map = r.cursor
		r.cursor += token.Pos(len(token.MAP.String()))

		// Token: Lbrack
		r.cursor += token.Pos(len(token.LBRACK.String()))

		// Decoration: Map
		r.applyDecorations(out, "Map", n.Decs.Map, false)

		// Node: Key
		if n.Key != nil {
			out.Key = r.restoreNode(n.Key, "MapType", "Key", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: Rbrack
		r.cursor += token.Pos(len(token.RBRACK.String()))

		// Decoration: Key
		r.applyDecorations(out, "Key", n.Decs.Key, false)

		// Node: Value
		if n.Value != nil {
			out.Value = r.restoreNode(n.Value, "MapType", "Value", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.Package:
		out := &ast.Package{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n

		// Value: Name
		out.Name = n.Name

		// Scope: Scope
		out.Scope = r.restoreScope(n.Scope)

		// Map: Imports
		out.Imports = map[string]*ast.Object{}
		for k, v := range n.Imports {
			out.Imports[k] = r.restoreObject(v)
		}

		// Map: Files
		out.Files = map[string]*ast.File{}
		for k, v := range n.Files {
			out.Files[k] = r.restoreNode(v, "Package", "Files", "File", allowDuplicate).(*ast.File)
		}

		return out
	case *dst.ParenExpr:
		out := &ast.ParenExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Lparen
		out.Lparen = r.cursor
		r.cursor += token.Pos(len(token.LPAREN.String()))

		// Decoration: Lparen
		r.applyDecorations(out, "Lparen", n.Decs.Lparen, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "ParenExpr", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// Token: Rparen
		out.Rparen = r.cursor
		r.cursor += token.Pos(len(token.RPAREN.String()))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.RangeStmt:
		out := &ast.RangeStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: For
		out.For = r.cursor
		r.cursor += token.Pos(len(token.FOR.String()))

		// Decoration: For
		r.applyDecorations(out, "For", n.Decs.For, false)

		// Node: Key
		if n.Key != nil {
			out.Key = r.restoreNode(n.Key, "RangeStmt", "Key", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: Comma
		if n.Value != nil {
			r.cursor += token.Pos(len(token.COMMA.String()))
		}

		// Decoration: Key
		r.applyDecorations(out, "Key", n.Decs.Key, false)

		// Node: Value
		if n.Value != nil {
			out.Value = r.restoreNode(n.Value, "RangeStmt", "Value", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Value
		r.applyDecorations(out, "Value", n.Decs.Value, false)

		// Token: Tok
		if n.Tok != token.ILLEGAL {
			out.Tok = n.Tok
			out.TokPos = r.cursor
			r.cursor += token.Pos(len(n.Tok.String()))
		}

		// Token: Range
		r.cursor += token.Pos(len(token.RANGE.String()))

		// Decoration: Range
		r.applyDecorations(out, "Range", n.Decs.Range, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "RangeStmt", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// Node: Body
		if n.Body != nil {
			out.Body = r.restoreNode(n.Body, "RangeStmt", "Body", "BlockStmt", allowDuplicate).(*ast.BlockStmt)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.ReturnStmt:
		out := &ast.ReturnStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Return
		out.Return = r.cursor
		r.cursor += token.Pos(len(token.RETURN.String()))

		// Decoration: Return
		r.applyDecorations(out, "Return", n.Decs.Return, false)

		// List: Results
		for _, v := range n.Results {
			out.Results = append(out.Results, r.restoreNode(v, "ReturnStmt", "Results", "Expr", allowDuplicate).(ast.Expr))
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.SelectStmt:
		out := &ast.SelectStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Select
		out.Select = r.cursor
		r.cursor += token.Pos(len(token.SELECT.String()))

		// Decoration: Select
		r.applyDecorations(out, "Select", n.Decs.Select, false)

		// Node: Body
		if n.Body != nil {
			out.Body = r.restoreNode(n.Body, "SelectStmt", "Body", "BlockStmt", allowDuplicate).(*ast.BlockStmt)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.SelectorExpr:
		out := &ast.SelectorExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "SelectorExpr", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: Period
		r.cursor += token.Pos(len(token.PERIOD.String()))

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// Node: Sel
		if n.Sel != nil {
			out.Sel = r.restoreNode(n.Sel, "SelectorExpr", "Sel", "Ident", allowDuplicate).(*ast.Ident)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.SendStmt:
		out := &ast.SendStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: Chan
		if n.Chan != nil {
			out.Chan = r.restoreNode(n.Chan, "SendStmt", "Chan", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Chan
		r.applyDecorations(out, "Chan", n.Decs.Chan, false)

		// Token: Arrow
		out.Arrow = r.cursor
		r.cursor += token.Pos(len(token.ARROW.String()))

		// Decoration: Arrow
		r.applyDecorations(out, "Arrow", n.Decs.Arrow, false)

		// Node: Value
		if n.Value != nil {
			out.Value = r.restoreNode(n.Value, "SendStmt", "Value", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.SliceExpr:
		out := &ast.SliceExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "SliceExpr", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// Token: Lbrack
		out.Lbrack = r.cursor
		r.cursor += token.Pos(len(token.LBRACK.String()))

		// Decoration: Lbrack
		r.applyDecorations(out, "Lbrack", n.Decs.Lbrack, false)

		// Node: Low
		if n.Low != nil {
			out.Low = r.restoreNode(n.Low, "SliceExpr", "Low", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: Colon1
		r.cursor += token.Pos(len(token.COLON.String()))

		// Decoration: Low
		r.applyDecorations(out, "Low", n.Decs.Low, false)

		// Node: High
		if n.High != nil {
			out.High = r.restoreNode(n.High, "SliceExpr", "High", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: Colon2
		if n.Slice3 {
			r.cursor += token.Pos(len(token.COLON.String()))
		}

		// Decoration: High
		r.applyDecorations(out, "High", n.Decs.High, false)

		// Node: Max
		if n.Max != nil {
			out.Max = r.restoreNode(n.Max, "SliceExpr", "Max", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Max
		r.applyDecorations(out, "Max", n.Decs.Max, false)

		// Token: Rbrack
		out.Rbrack = r.cursor
		r.cursor += token.Pos(len(token.RBRACK.String()))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)

		// Value: Slice3
		out.Slice3 = n.Slice3
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.StarExpr:
		out := &ast.StarExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Star
		out.Star = r.cursor
		r.cursor += token.Pos(len(token.MUL.String()))

		// Decoration: Star
		r.applyDecorations(out, "Star", n.Decs.Star, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "StarExpr", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.StructType:
		out := &ast.StructType{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Struct
		out.Struct = r.cursor
		r.cursor += token.Pos(len(token.STRUCT.String()))

		// Decoration: Struct
		r.applyDecorations(out, "Struct", n.Decs.Struct, false)

		// Node: Fields
		if n.Fields != nil {
			out.Fields = r.restoreNode(n.Fields, "StructType", "Fields", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)

		// Value: Incomplete
		out.Incomplete = n.Incomplete
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.SwitchStmt:
		out := &ast.SwitchStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Switch
		out.Switch = r.cursor
		r.cursor += token.Pos(len(token.SWITCH.String()))

		// Decoration: Switch
		r.applyDecorations(out, "Switch", n.Decs.Switch, false)

		// Node: Init
		if n.Init != nil {
			out.Init = r.restoreNode(n.Init, "SwitchStmt", "Init", "Stmt", allowDuplicate).(ast.Stmt)
		}

		// Decoration: Init
		r.applyDecorations(out, "Init", n.Decs.Init, false)

		// Node: Tag
		if n.Tag != nil {
			out.Tag = r.restoreNode(n.Tag, "SwitchStmt", "Tag", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: Tag
		r.applyDecorations(out, "Tag", n.Decs.Tag, false)

		// Node: Body
		if n.Body != nil {
			out.Body = r.restoreNode(n.Body, "SwitchStmt", "Body", "BlockStmt", allowDuplicate).(*ast.BlockStmt)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.TypeAssertExpr:
		out := &ast.TypeAssertExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "TypeAssertExpr", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: Period
		r.cursor += token.Pos(len(token.PERIOD.String()))

		// Decoration: X
		r.applyDecorations(out, "X", n.Decs.X, false)

		// Token: Lparen
		out.Lparen = r.cursor
		r.cursor += token.Pos(len(token.LPAREN.String()))

		// Decoration: Lparen
		r.applyDecorations(out, "Lparen", n.Decs.Lparen, false)

		// Node: Type
		if n.Type != nil {
			out.Type = r.restoreNode(n.Type, "TypeAssertExpr", "Type", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: TypeToken
		if n.Type == nil {
			r.cursor += token.Pos(len(token.TYPE.String()))
		}

		// Decoration: Type
		r.applyDecorations(out, "Type", n.Decs.Type, false)

		// Token: Rparen
		out.Rparen = r.cursor
		r.cursor += token.Pos(len(token.RPAREN.String()))

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.TypeSpec:
		out := &ast.TypeSpec{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Node: Name
		if n.Name != nil {
			out.Name = r.restoreNode(n.Name, "TypeSpec", "Name", "Ident", allowDuplicate).(*ast.Ident)
		}

		// Token: Assign
		if n.Assign {
			out.Assign = r.cursor
			r.cursor += token.Pos(len(token.ASSIGN.String()))
		}

		// Decoration: Name
		r.applyDecorations(out, "Name", n.Decs.Name, false)

		// Node: TypeParams
		if n.TypeParams != nil {
			out.TypeParams = r.restoreNode(n.TypeParams, "TypeSpec", "TypeParams", "FieldList", allowDuplicate).(*ast.FieldList)
		}

		// Decoration: TypeParams
		r.applyDecorations(out, "TypeParams", n.Decs.TypeParams, false)

		// Node: Type
		if n.Type != nil {
			out.Type = r.restoreNode(n.Type, "TypeSpec", "Type", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.TypeSwitchStmt:
		out := &ast.TypeSwitchStmt{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Switch
		out.Switch = r.cursor
		r.cursor += token.Pos(len(token.SWITCH.String()))

		// Decoration: Switch
		r.applyDecorations(out, "Switch", n.Decs.Switch, false)

		// Node: Init
		if n.Init != nil {
			out.Init = r.restoreNode(n.Init, "TypeSwitchStmt", "Init", "Stmt", allowDuplicate).(ast.Stmt)
		}

		// Decoration: Init
		r.applyDecorations(out, "Init", n.Decs.Init, false)

		// Node: Assign
		if n.Assign != nil {
			out.Assign = r.restoreNode(n.Assign, "TypeSwitchStmt", "Assign", "Stmt", allowDuplicate).(ast.Stmt)
		}

		// Decoration: Assign
		r.applyDecorations(out, "Assign", n.Decs.Assign, false)

		// Node: Body
		if n.Body != nil {
			out.Body = r.restoreNode(n.Body, "TypeSwitchStmt", "Body", "BlockStmt", allowDuplicate).(*ast.BlockStmt)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.UnaryExpr:
		out := &ast.UnaryExpr{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// Token: Op
		out.Op = n.Op
		out.OpPos = r.cursor
		r.cursor += token.Pos(len(n.Op.String()))

		// Decoration: Op
		r.applyDecorations(out, "Op", n.Decs.Op, false)

		// Node: X
		if n.X != nil {
			out.X = r.restoreNode(n.X, "UnaryExpr", "X", "Expr", allowDuplicate).(ast.Expr)
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	case *dst.ValueSpec:
		out := &ast.ValueSpec{}
		r.Ast.Nodes[n] = out
		r.Dst.Nodes[out] = n
		r.applySpace(n, "Before", n.Decs.Before)

		// Decoration: Start
		r.applyDecorations(out, "Start", n.Decs.Start, false)

		// List: Names
		for _, v := range n.Names {
			out.Names = append(out.Names, r.restoreNode(v, "ValueSpec", "Names", "Ident", allowDuplicate).(*ast.Ident))
		}

		// Node: Type
		if n.Type != nil {
			out.Type = r.restoreNode(n.Type, "ValueSpec", "Type", "Expr", allowDuplicate).(ast.Expr)
		}

		// Token: Assign
		if n.Values != nil {
			r.cursor += token.Pos(len(token.ASSIGN.String()))
		}

		// Decoration: Assign
		r.applyDecorations(out, "Assign", n.Decs.Assign, false)

		// List: Values
		for _, v := range n.Values {
			out.Values = append(out.Values, r.restoreNode(v, "ValueSpec", "Values", "Expr", allowDuplicate).(ast.Expr))
		}

		// Decoration: End
		r.applyDecorations(out, "End", n.Decs.End, true)
		r.applySpace(n, "After", n.Decs.After)

		return out
	default:
		panic(fmt.Sprintf("%T", n))
	}
}
