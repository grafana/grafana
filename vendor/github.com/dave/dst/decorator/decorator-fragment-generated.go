package decorator

import (
	"go/ast"
	"go/token"
)

func (f *fileDecorator) addNodeFragments(n ast.Node) {
	if n.Pos().IsValid() {
		f.cursor = int(n.Pos())
	}
	switch n := n.(type) {
	case *ast.ArrayType:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Lbrack
		f.addTokenFragment(n, token.LBRACK, n.Lbrack)

		// Decoration: Lbrack
		f.addDecorationFragment(n, "Lbrack", token.NoPos)

		// Node: Len
		if n.Len != nil {
			f.addNodeFragments(n.Len)
		}

		// Token: Rbrack
		f.addTokenFragment(n, token.RBRACK, token.NoPos)

		// Decoration: Len
		f.addDecorationFragment(n, "Len", token.NoPos)

		// Node: Elt
		if n.Elt != nil {
			f.addNodeFragments(n.Elt)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.AssignStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// List: Lhs
		for _, v := range n.Lhs {
			f.addNodeFragments(v)
		}

		// Token: Tok
		f.addTokenFragment(n, n.Tok, n.TokPos)

		// Decoration: Tok
		f.addDecorationFragment(n, "Tok", token.NoPos)

		// List: Rhs
		for _, v := range n.Rhs {
			f.addNodeFragments(v)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.BadDecl:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Bad
		f.addBadFragment(n, n.From, int(n.To-n.From))

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.BadExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Bad
		f.addBadFragment(n, n.From, int(n.To-n.From))

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.BadStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Bad
		f.addBadFragment(n, n.From, int(n.To-n.From))

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.BasicLit:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// String: Value
		f.addStringFragment(n, n.Value, n.ValuePos)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.BinaryExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// Token: Op
		f.addTokenFragment(n, n.Op, n.OpPos)

		// Decoration: Op
		f.addDecorationFragment(n, "Op", token.NoPos)

		// Node: Y
		if n.Y != nil {
			f.addNodeFragments(n.Y)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.BlockStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Lbrace
		f.addTokenFragment(n, token.LBRACE, n.Lbrace)

		// Decoration: Lbrace
		f.addDecorationFragment(n, "Lbrace", token.NoPos)

		// List: List
		for _, v := range n.List {
			f.addNodeFragments(v)
		}

		// Token: Rbrace
		f.addTokenFragment(n, token.RBRACE, n.Rbrace)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.BranchStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Tok
		f.addTokenFragment(n, n.Tok, n.TokPos)

		// Decoration: Tok
		if n.Label != nil {
			f.addDecorationFragment(n, "Tok", token.NoPos)
		}

		// Node: Label
		if n.Label != nil {
			f.addNodeFragments(n.Label)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.CallExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: Fun
		if n.Fun != nil {
			f.addNodeFragments(n.Fun)
		}

		// Decoration: Fun
		f.addDecorationFragment(n, "Fun", token.NoPos)

		// Token: Lparen
		f.addTokenFragment(n, token.LPAREN, n.Lparen)

		// Decoration: Lparen
		f.addDecorationFragment(n, "Lparen", token.NoPos)

		// List: Args
		for _, v := range n.Args {
			f.addNodeFragments(v)
		}

		// Token: Ellipsis
		if n.Ellipsis.IsValid() {
			f.addTokenFragment(n, token.ELLIPSIS, n.Ellipsis)
		}

		// Decoration: Ellipsis
		if n.Ellipsis.IsValid() {
			f.addDecorationFragment(n, "Ellipsis", token.NoPos)
		}

		// Token: Rparen
		f.addTokenFragment(n, token.RPAREN, n.Rparen)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.CaseClause:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Case
		f.addTokenFragment(n, func() token.Token {
			if n.List == nil {
				return token.DEFAULT
			}
			return token.CASE
		}(), n.Case)

		// Decoration: Case
		f.addDecorationFragment(n, "Case", token.NoPos)

		// List: List
		for _, v := range n.List {
			f.addNodeFragments(v)
		}

		// Token: Colon
		f.addTokenFragment(n, token.COLON, n.Colon)

		// Decoration: Colon
		f.addDecorationFragment(n, "Colon", token.NoPos)

		// List: Body
		for _, v := range n.Body {
			f.addNodeFragments(v)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.ChanType:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Begin
		f.addTokenFragment(n, func() token.Token {
			if n.Dir == ast.RECV {
				return token.ARROW
			}
			return token.CHAN
		}(), n.Begin)

		// Token: Chan
		if n.Dir == ast.RECV {
			f.addTokenFragment(n, token.CHAN, token.NoPos)
		}

		// Decoration: Begin
		f.addDecorationFragment(n, "Begin", token.NoPos)

		// Token: Arrow
		if n.Dir == ast.SEND {
			f.addTokenFragment(n, token.ARROW, n.Arrow)
		}

		// Decoration: Arrow
		if n.Dir == ast.SEND {
			f.addDecorationFragment(n, "Arrow", token.NoPos)
		}

		// Node: Value
		if n.Value != nil {
			f.addNodeFragments(n.Value)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.CommClause:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Case
		f.addTokenFragment(n, func() token.Token {
			if n.Comm == nil {
				return token.DEFAULT
			}
			return token.CASE
		}(), n.Case)

		// Decoration: Case
		f.addDecorationFragment(n, "Case", token.NoPos)

		// Node: Comm
		if n.Comm != nil {
			f.addNodeFragments(n.Comm)
		}

		// Decoration: Comm
		if n.Comm != nil {
			f.addDecorationFragment(n, "Comm", token.NoPos)
		}

		// Token: Colon
		f.addTokenFragment(n, token.COLON, n.Colon)

		// Decoration: Colon
		f.addDecorationFragment(n, "Colon", token.NoPos)

		// List: Body
		for _, v := range n.Body {
			f.addNodeFragments(v)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.CompositeLit:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: Type
		if n.Type != nil {
			f.addNodeFragments(n.Type)
		}

		// Decoration: Type
		if n.Type != nil {
			f.addDecorationFragment(n, "Type", token.NoPos)
		}

		// Token: Lbrace
		f.addTokenFragment(n, token.LBRACE, n.Lbrace)

		// Decoration: Lbrace
		f.addDecorationFragment(n, "Lbrace", token.NoPos)

		// List: Elts
		for _, v := range n.Elts {
			f.addNodeFragments(v)
		}

		// Token: Rbrace
		f.addTokenFragment(n, token.RBRACE, n.Rbrace)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.DeclStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: Decl
		if n.Decl != nil {
			f.addNodeFragments(n.Decl)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.DeferStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Defer
		f.addTokenFragment(n, token.DEFER, n.Defer)

		// Decoration: Defer
		f.addDecorationFragment(n, "Defer", token.NoPos)

		// Node: Call
		if n.Call != nil {
			f.addNodeFragments(n.Call)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.Ellipsis:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Ellipsis
		f.addTokenFragment(n, token.ELLIPSIS, n.Ellipsis)

		// Decoration: Ellipsis
		if n.Elt != nil {
			f.addDecorationFragment(n, "Ellipsis", token.NoPos)
		}

		// Node: Elt
		if n.Elt != nil {
			f.addNodeFragments(n.Elt)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.EmptyStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Semicolon
		if !n.Implicit {
			f.addTokenFragment(n, token.ARROW, n.Semicolon)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.ExprStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.Field:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// List: Names
		for _, v := range n.Names {
			f.addNodeFragments(v)
		}

		// Node: Type
		if n.Type != nil {
			f.addNodeFragments(n.Type)
		}

		// Decoration: Type
		if n.Tag != nil {
			f.addDecorationFragment(n, "Type", token.NoPos)
		}

		// Node: Tag
		if n.Tag != nil {
			f.addNodeFragments(n.Tag)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.FieldList:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Opening
		if n.Opening.IsValid() {
			f.addTokenFragment(n, token.LPAREN, n.Opening)
		}

		// Decoration: Opening
		f.addDecorationFragment(n, "Opening", token.NoPos)

		// List: List
		for _, v := range n.List {
			f.addNodeFragments(v)
		}

		// Token: Closing
		if n.Closing.IsValid() {
			f.addTokenFragment(n, token.RPAREN, n.Closing)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.File:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Package
		f.addTokenFragment(n, token.PACKAGE, n.Package)

		// Decoration: Package
		f.addDecorationFragment(n, "Package", token.NoPos)

		// Node: Name
		if n.Name != nil {
			f.addNodeFragments(n.Name)
		}

		// Decoration: Name
		f.addDecorationFragment(n, "Name", token.NoPos)

		// List: Decls
		for _, v := range n.Decls {
			f.addNodeFragments(v)
		}

		// List: Imports
		for _, v := range n.Imports {
			f.addNodeFragments(v)
		}

	case *ast.ForStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: For
		f.addTokenFragment(n, token.FOR, n.For)

		// Decoration: For
		f.addDecorationFragment(n, "For", token.NoPos)

		// Node: Init
		if n.Init != nil {
			f.addNodeFragments(n.Init)
		}

		// Token: InitSemicolon
		if n.Init != nil {
			f.addTokenFragment(n, token.SEMICOLON, token.NoPos)
		}

		// Decoration: Init
		if n.Init != nil {
			f.addDecorationFragment(n, "Init", token.NoPos)
		}

		// Node: Cond
		if n.Cond != nil {
			f.addNodeFragments(n.Cond)
		}

		// Token: CondSemicolon
		if n.Post != nil {
			f.addTokenFragment(n, token.SEMICOLON, token.NoPos)
		}

		// Decoration: Cond
		if n.Cond != nil {
			f.addDecorationFragment(n, "Cond", token.NoPos)
		}

		// Node: Post
		if n.Post != nil {
			f.addNodeFragments(n.Post)
		}

		// Decoration: Post
		if n.Post != nil {
			f.addDecorationFragment(n, "Post", token.NoPos)
		}

		// Node: Body
		if n.Body != nil {
			f.addNodeFragments(n.Body)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.FuncDecl:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Func
		if true {
			f.addTokenFragment(n, token.FUNC, n.Type.Func)
		}

		// Decoration: Func
		f.addDecorationFragment(n, "Func", token.NoPos)

		// Node: Recv
		if n.Recv != nil {
			f.addNodeFragments(n.Recv)
		}

		// Decoration: Recv
		if n.Recv != nil {
			f.addDecorationFragment(n, "Recv", token.NoPos)
		}

		// Node: Name
		if n.Name != nil {
			f.addNodeFragments(n.Name)
		}

		// Decoration: Name
		f.addDecorationFragment(n, "Name", token.NoPos)

		// Node: TypeParams
		if n.Type.TypeParams != nil {
			f.addNodeFragments(n.Type.TypeParams)
		}

		// Decoration: TypeParams
		if n.Type.TypeParams != nil {
			f.addDecorationFragment(n, "TypeParams", token.NoPos)
		}

		// Node: Params
		if n.Type.Params != nil {
			f.addNodeFragments(n.Type.Params)
		}

		// Decoration: Params
		f.addDecorationFragment(n, "Params", token.NoPos)

		// Node: Results
		if n.Type.Results != nil {
			f.addNodeFragments(n.Type.Results)
		}

		// Decoration: Results
		if n.Type.Results != nil {
			f.addDecorationFragment(n, "Results", token.NoPos)
		}

		// Node: Body
		if n.Body != nil {
			f.addNodeFragments(n.Body)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.FuncLit:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: Type
		if n.Type != nil {
			f.addNodeFragments(n.Type)
		}

		// Decoration: Type
		f.addDecorationFragment(n, "Type", token.NoPos)

		// Node: Body
		if n.Body != nil {
			f.addNodeFragments(n.Body)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.FuncType:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Func
		if n.Func.IsValid() {
			f.addTokenFragment(n, token.FUNC, n.Func)
		}

		// Decoration: Func
		if n.Func.IsValid() {
			f.addDecorationFragment(n, "Func", token.NoPos)
		}

		// Node: TypeParams
		if n.TypeParams != nil {
			f.addNodeFragments(n.TypeParams)
		}

		// Decoration: TypeParams
		if n.TypeParams != nil {
			f.addDecorationFragment(n, "TypeParams", token.NoPos)
		}

		// Node: Params
		if n.Params != nil {
			f.addNodeFragments(n.Params)
		}

		// Decoration: Params
		if n.Results != nil {
			f.addDecorationFragment(n, "Params", token.NoPos)
		}

		// Node: Results
		if n.Results != nil {
			f.addNodeFragments(n.Results)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.GenDecl:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Tok
		f.addTokenFragment(n, n.Tok, n.TokPos)

		// Decoration: Tok
		f.addDecorationFragment(n, "Tok", token.NoPos)

		// Token: Lparen
		if n.Lparen.IsValid() {
			f.addTokenFragment(n, token.LPAREN, n.Lparen)
		}

		// Decoration: Lparen
		if n.Lparen.IsValid() {
			f.addDecorationFragment(n, "Lparen", token.NoPos)
		}

		// List: Specs
		for _, v := range n.Specs {
			f.addNodeFragments(v)
		}

		// Token: Rparen
		if n.Rparen.IsValid() {
			f.addTokenFragment(n, token.RPAREN, n.Rparen)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.GoStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Go
		f.addTokenFragment(n, token.GO, n.Go)

		// Decoration: Go
		f.addDecorationFragment(n, "Go", token.NoPos)

		// Node: Call
		if n.Call != nil {
			f.addNodeFragments(n.Call)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.Ident:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// String: Name
		f.addStringFragment(n, n.Name, n.NamePos)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.IfStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: If
		f.addTokenFragment(n, token.IF, n.If)

		// Decoration: If
		f.addDecorationFragment(n, "If", token.NoPos)

		// Node: Init
		if n.Init != nil {
			f.addNodeFragments(n.Init)
		}

		// Decoration: Init
		if n.Init != nil {
			f.addDecorationFragment(n, "Init", token.NoPos)
		}

		// Node: Cond
		if n.Cond != nil {
			f.addNodeFragments(n.Cond)
		}

		// Decoration: Cond
		f.addDecorationFragment(n, "Cond", token.NoPos)

		// Node: Body
		if n.Body != nil {
			f.addNodeFragments(n.Body)
		}

		// Token: ElseTok
		if n.Else != nil {
			f.addTokenFragment(n, token.ELSE, token.NoPos)
		}

		// Decoration: Else
		if n.Else != nil {
			f.addDecorationFragment(n, "Else", token.NoPos)
		}

		// Node: Else
		if n.Else != nil {
			f.addNodeFragments(n.Else)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.ImportSpec:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: Name
		if n.Name != nil {
			f.addNodeFragments(n.Name)
		}

		// Decoration: Name
		if n.Name != nil {
			f.addDecorationFragment(n, "Name", token.NoPos)
		}

		// Node: Path
		if n.Path != nil {
			f.addNodeFragments(n.Path)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.IncDecStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// Token: Tok
		f.addTokenFragment(n, n.Tok, n.TokPos)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.IndexExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// Token: Lbrack
		f.addTokenFragment(n, token.LBRACK, n.Lbrack)

		// Decoration: Lbrack
		f.addDecorationFragment(n, "Lbrack", token.NoPos)

		// Node: Index
		if n.Index != nil {
			f.addNodeFragments(n.Index)
		}

		// Decoration: Index
		f.addDecorationFragment(n, "Index", token.NoPos)

		// Token: Rbrack
		f.addTokenFragment(n, token.RBRACK, n.Rbrack)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.IndexListExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// Token: Lbrack
		f.addTokenFragment(n, token.LBRACK, n.Lbrack)

		// Decoration: Lbrack
		f.addDecorationFragment(n, "Lbrack", token.NoPos)

		// List: Indices
		for _, v := range n.Indices {
			f.addNodeFragments(v)
		}

		// Decoration: Indices
		f.addDecorationFragment(n, "Indices", token.NoPos)

		// Token: Rbrack
		f.addTokenFragment(n, token.RBRACK, n.Rbrack)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.InterfaceType:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Interface
		f.addTokenFragment(n, token.INTERFACE, n.Interface)

		// Decoration: Interface
		f.addDecorationFragment(n, "Interface", token.NoPos)

		// Node: Methods
		if n.Methods != nil {
			f.addNodeFragments(n.Methods)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.KeyValueExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: Key
		if n.Key != nil {
			f.addNodeFragments(n.Key)
		}

		// Decoration: Key
		f.addDecorationFragment(n, "Key", token.NoPos)

		// Token: Colon
		f.addTokenFragment(n, token.COLON, n.Colon)

		// Decoration: Colon
		f.addDecorationFragment(n, "Colon", token.NoPos)

		// Node: Value
		if n.Value != nil {
			f.addNodeFragments(n.Value)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.LabeledStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: Label
		if n.Label != nil {
			f.addNodeFragments(n.Label)
		}

		// Decoration: Label
		f.addDecorationFragment(n, "Label", token.NoPos)

		// Token: Colon
		f.addTokenFragment(n, token.COLON, n.Colon)

		// Decoration: Colon
		f.addDecorationFragment(n, "Colon", token.NoPos)

		// Node: Stmt
		if n.Stmt != nil {
			f.addNodeFragments(n.Stmt)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.MapType:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Map
		f.addTokenFragment(n, token.MAP, n.Map)

		// Token: Lbrack
		f.addTokenFragment(n, token.LBRACK, token.NoPos)

		// Decoration: Map
		f.addDecorationFragment(n, "Map", token.NoPos)

		// Node: Key
		if n.Key != nil {
			f.addNodeFragments(n.Key)
		}

		// Token: Rbrack
		f.addTokenFragment(n, token.RBRACK, token.NoPos)

		// Decoration: Key
		f.addDecorationFragment(n, "Key", token.NoPos)

		// Node: Value
		if n.Value != nil {
			f.addNodeFragments(n.Value)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.Package:

		// Map: Imports

		// Map: Files
		for _, v := range n.Files {
			f.addNodeFragments(v)
		}

	case *ast.ParenExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Lparen
		f.addTokenFragment(n, token.LPAREN, n.Lparen)

		// Decoration: Lparen
		f.addDecorationFragment(n, "Lparen", token.NoPos)

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// Token: Rparen
		f.addTokenFragment(n, token.RPAREN, n.Rparen)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.RangeStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: For
		f.addTokenFragment(n, token.FOR, n.For)

		// Decoration: For
		if n.Key != nil {
			f.addDecorationFragment(n, "For", token.NoPos)
		}

		// Node: Key
		if n.Key != nil {
			f.addNodeFragments(n.Key)
		}

		// Token: Comma
		if n.Value != nil {
			f.addTokenFragment(n, token.COMMA, token.NoPos)
		}

		// Decoration: Key
		if n.Key != nil {
			f.addDecorationFragment(n, "Key", token.NoPos)
		}

		// Node: Value
		if n.Value != nil {
			f.addNodeFragments(n.Value)
		}

		// Decoration: Value
		if n.Value != nil {
			f.addDecorationFragment(n, "Value", token.NoPos)
		}

		// Token: Tok
		if n.Tok != token.ILLEGAL {
			f.addTokenFragment(n, n.Tok, n.TokPos)
		}

		// Token: Range
		f.addTokenFragment(n, token.RANGE, token.NoPos)

		// Decoration: Range
		f.addDecorationFragment(n, "Range", token.NoPos)

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// Node: Body
		if n.Body != nil {
			f.addNodeFragments(n.Body)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.ReturnStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Return
		f.addTokenFragment(n, token.RETURN, n.Return)

		// Decoration: Return
		f.addDecorationFragment(n, "Return", token.NoPos)

		// List: Results
		for _, v := range n.Results {
			f.addNodeFragments(v)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.SelectStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Select
		f.addTokenFragment(n, token.SELECT, n.Select)

		// Decoration: Select
		f.addDecorationFragment(n, "Select", token.NoPos)

		// Node: Body
		if n.Body != nil {
			f.addNodeFragments(n.Body)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.SelectorExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Token: Period
		f.addTokenFragment(n, token.PERIOD, token.NoPos)

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// Node: Sel
		if n.Sel != nil {
			f.addNodeFragments(n.Sel)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.SendStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: Chan
		if n.Chan != nil {
			f.addNodeFragments(n.Chan)
		}

		// Decoration: Chan
		f.addDecorationFragment(n, "Chan", token.NoPos)

		// Token: Arrow
		f.addTokenFragment(n, token.ARROW, n.Arrow)

		// Decoration: Arrow
		f.addDecorationFragment(n, "Arrow", token.NoPos)

		// Node: Value
		if n.Value != nil {
			f.addNodeFragments(n.Value)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.SliceExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// Token: Lbrack
		f.addTokenFragment(n, token.LBRACK, n.Lbrack)

		// Decoration: Lbrack
		if n.Low != nil {
			f.addDecorationFragment(n, "Lbrack", token.NoPos)
		}

		// Node: Low
		if n.Low != nil {
			f.addNodeFragments(n.Low)
		}

		// Token: Colon1
		f.addTokenFragment(n, token.COLON, token.NoPos)

		// Decoration: Low
		f.addDecorationFragment(n, "Low", token.NoPos)

		// Node: High
		if n.High != nil {
			f.addNodeFragments(n.High)
		}

		// Token: Colon2
		if n.Slice3 {
			f.addTokenFragment(n, token.COLON, token.NoPos)
		}

		// Decoration: High
		if n.High != nil {
			f.addDecorationFragment(n, "High", token.NoPos)
		}

		// Node: Max
		if n.Max != nil {
			f.addNodeFragments(n.Max)
		}

		// Decoration: Max
		if n.Max != nil {
			f.addDecorationFragment(n, "Max", token.NoPos)
		}

		// Token: Rbrack
		f.addTokenFragment(n, token.RBRACK, n.Rbrack)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.StarExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Star
		f.addTokenFragment(n, token.MUL, n.Star)

		// Decoration: Star
		f.addDecorationFragment(n, "Star", token.NoPos)

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.StructType:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Struct
		f.addTokenFragment(n, token.STRUCT, n.Struct)

		// Decoration: Struct
		f.addDecorationFragment(n, "Struct", token.NoPos)

		// Node: Fields
		if n.Fields != nil {
			f.addNodeFragments(n.Fields)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.SwitchStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Switch
		f.addTokenFragment(n, token.SWITCH, n.Switch)

		// Decoration: Switch
		f.addDecorationFragment(n, "Switch", token.NoPos)

		// Node: Init
		if n.Init != nil {
			f.addNodeFragments(n.Init)
		}

		// Decoration: Init
		if n.Init != nil {
			f.addDecorationFragment(n, "Init", token.NoPos)
		}

		// Node: Tag
		if n.Tag != nil {
			f.addNodeFragments(n.Tag)
		}

		// Decoration: Tag
		if n.Tag != nil {
			f.addDecorationFragment(n, "Tag", token.NoPos)
		}

		// Node: Body
		if n.Body != nil {
			f.addNodeFragments(n.Body)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.TypeAssertExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Token: Period
		f.addTokenFragment(n, token.PERIOD, token.NoPos)

		// Decoration: X
		f.addDecorationFragment(n, "X", token.NoPos)

		// Token: Lparen
		f.addTokenFragment(n, token.LPAREN, n.Lparen)

		// Decoration: Lparen
		f.addDecorationFragment(n, "Lparen", token.NoPos)

		// Node: Type
		if n.Type != nil {
			f.addNodeFragments(n.Type)
		}

		// Token: TypeToken
		if n.Type == nil {
			f.addTokenFragment(n, token.TYPE, token.NoPos)
		}

		// Decoration: Type
		f.addDecorationFragment(n, "Type", token.NoPos)

		// Token: Rparen
		f.addTokenFragment(n, token.RPAREN, n.Rparen)

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.TypeSpec:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Node: Name
		if n.Name != nil {
			f.addNodeFragments(n.Name)
		}

		// Token: Assign
		if n.Assign.IsValid() {
			f.addTokenFragment(n, token.ASSIGN, n.Assign)
		}

		// Decoration: Name
		f.addDecorationFragment(n, "Name", token.NoPos)

		// Node: TypeParams
		if n.TypeParams != nil {
			f.addNodeFragments(n.TypeParams)
		}

		// Decoration: TypeParams
		if n.TypeParams != nil {
			f.addDecorationFragment(n, "TypeParams", token.NoPos)
		}

		// Node: Type
		if n.Type != nil {
			f.addNodeFragments(n.Type)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.TypeSwitchStmt:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Switch
		f.addTokenFragment(n, token.SWITCH, n.Switch)

		// Decoration: Switch
		f.addDecorationFragment(n, "Switch", token.NoPos)

		// Node: Init
		if n.Init != nil {
			f.addNodeFragments(n.Init)
		}

		// Decoration: Init
		if n.Init != nil {
			f.addDecorationFragment(n, "Init", token.NoPos)
		}

		// Node: Assign
		if n.Assign != nil {
			f.addNodeFragments(n.Assign)
		}

		// Decoration: Assign
		f.addDecorationFragment(n, "Assign", token.NoPos)

		// Node: Body
		if n.Body != nil {
			f.addNodeFragments(n.Body)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.UnaryExpr:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// Token: Op
		f.addTokenFragment(n, n.Op, n.OpPos)

		// Decoration: Op
		f.addDecorationFragment(n, "Op", token.NoPos)

		// Node: X
		if n.X != nil {
			f.addNodeFragments(n.X)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	case *ast.ValueSpec:

		// Decoration: Start
		f.addDecorationFragment(n, "Start", n.Pos())

		// List: Names
		for _, v := range n.Names {
			f.addNodeFragments(v)
		}

		// Node: Type
		if n.Type != nil {
			f.addNodeFragments(n.Type)
		}

		// Token: Assign
		if n.Values != nil {
			f.addTokenFragment(n, token.ASSIGN, token.NoPos)
		}

		// Decoration: Assign
		if n.Values != nil {
			f.addDecorationFragment(n, "Assign", token.NoPos)
		}

		// List: Values
		for _, v := range n.Values {
			f.addNodeFragments(v)
		}

		// Decoration: End
		f.addDecorationFragment(n, "End", n.End())

	}
}
