package dst

import "fmt"

// Clone returns a deep copy of the node, ready to be re-used elsewhere in the tree.
func Clone(n Node) Node {
	switch n := n.(type) {
	case *ArrayType:
		out := &ArrayType{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Lbrack
		out.Decs.Lbrack = append(out.Decs.Lbrack, n.Decs.Lbrack...)

		// Node: Len
		if n.Len != nil {
			out.Len = Clone(n.Len).(Expr)
		}

		// Decoration: Len
		out.Decs.Len = append(out.Decs.Len, n.Decs.Len...)

		// Node: Elt
		if n.Elt != nil {
			out.Elt = Clone(n.Elt).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *AssignStmt:
		out := &AssignStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// List: Lhs
		for _, v := range n.Lhs {
			out.Lhs = append(out.Lhs, Clone(v).(Expr))
		}

		// Token: Tok
		out.Tok = n.Tok

		// Decoration: Tok
		out.Decs.Tok = append(out.Decs.Tok, n.Decs.Tok...)

		// List: Rhs
		for _, v := range n.Rhs {
			out.Rhs = append(out.Rhs, Clone(v).(Expr))
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *BadDecl:
		out := &BadDecl{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Bad
		out.Length = n.Length

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *BadExpr:
		out := &BadExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Bad
		out.Length = n.Length

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *BadStmt:
		out := &BadStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Bad
		out.Length = n.Length

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *BasicLit:
		out := &BasicLit{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// String: Value
		out.Value = n.Value

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		// Value: Kind
		out.Kind = n.Kind

		out.Decs.After = n.Decs.After

		return out
	case *BinaryExpr:
		out := &BinaryExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// Token: Op
		out.Op = n.Op

		// Decoration: Op
		out.Decs.Op = append(out.Decs.Op, n.Decs.Op...)

		// Node: Y
		if n.Y != nil {
			out.Y = Clone(n.Y).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *BlockStmt:
		out := &BlockStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Lbrace
		out.Decs.Lbrace = append(out.Decs.Lbrace, n.Decs.Lbrace...)

		// List: List
		for _, v := range n.List {
			out.List = append(out.List, Clone(v).(Stmt))
		}

		// Token: Rbrace
		out.RbraceHasNoPos = n.RbraceHasNoPos

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *BranchStmt:
		out := &BranchStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Token: Tok
		out.Tok = n.Tok

		// Decoration: Tok
		out.Decs.Tok = append(out.Decs.Tok, n.Decs.Tok...)

		// Node: Label
		if n.Label != nil {
			out.Label = Clone(n.Label).(*Ident)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *CallExpr:
		out := &CallExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: Fun
		if n.Fun != nil {
			out.Fun = Clone(n.Fun).(Expr)
		}

		// Decoration: Fun
		out.Decs.Fun = append(out.Decs.Fun, n.Decs.Fun...)

		// Decoration: Lparen
		out.Decs.Lparen = append(out.Decs.Lparen, n.Decs.Lparen...)

		// List: Args
		for _, v := range n.Args {
			out.Args = append(out.Args, Clone(v).(Expr))
		}

		// Token: Ellipsis
		out.Ellipsis = n.Ellipsis

		// Decoration: Ellipsis
		out.Decs.Ellipsis = append(out.Decs.Ellipsis, n.Decs.Ellipsis...)

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *CaseClause:
		out := &CaseClause{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Case
		out.Decs.Case = append(out.Decs.Case, n.Decs.Case...)

		// List: List
		for _, v := range n.List {
			out.List = append(out.List, Clone(v).(Expr))
		}

		// Decoration: Colon
		out.Decs.Colon = append(out.Decs.Colon, n.Decs.Colon...)

		// List: Body
		for _, v := range n.Body {
			out.Body = append(out.Body, Clone(v).(Stmt))
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *ChanType:
		out := &ChanType{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Begin
		out.Decs.Begin = append(out.Decs.Begin, n.Decs.Begin...)

		// Decoration: Arrow
		out.Decs.Arrow = append(out.Decs.Arrow, n.Decs.Arrow...)

		// Node: Value
		if n.Value != nil {
			out.Value = Clone(n.Value).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		// Value: Dir
		out.Dir = n.Dir

		out.Decs.After = n.Decs.After

		return out
	case *CommClause:
		out := &CommClause{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Case
		out.Decs.Case = append(out.Decs.Case, n.Decs.Case...)

		// Node: Comm
		if n.Comm != nil {
			out.Comm = Clone(n.Comm).(Stmt)
		}

		// Decoration: Comm
		out.Decs.Comm = append(out.Decs.Comm, n.Decs.Comm...)

		// Decoration: Colon
		out.Decs.Colon = append(out.Decs.Colon, n.Decs.Colon...)

		// List: Body
		for _, v := range n.Body {
			out.Body = append(out.Body, Clone(v).(Stmt))
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *CompositeLit:
		out := &CompositeLit{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: Type
		if n.Type != nil {
			out.Type = Clone(n.Type).(Expr)
		}

		// Decoration: Type
		out.Decs.Type = append(out.Decs.Type, n.Decs.Type...)

		// Decoration: Lbrace
		out.Decs.Lbrace = append(out.Decs.Lbrace, n.Decs.Lbrace...)

		// List: Elts
		for _, v := range n.Elts {
			out.Elts = append(out.Elts, Clone(v).(Expr))
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		// Value: Incomplete
		out.Incomplete = n.Incomplete

		out.Decs.After = n.Decs.After

		return out
	case *DeclStmt:
		out := &DeclStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: Decl
		if n.Decl != nil {
			out.Decl = Clone(n.Decl).(Decl)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *DeferStmt:
		out := &DeferStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Defer
		out.Decs.Defer = append(out.Decs.Defer, n.Decs.Defer...)

		// Node: Call
		if n.Call != nil {
			out.Call = Clone(n.Call).(*CallExpr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *Ellipsis:
		out := &Ellipsis{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Ellipsis
		out.Decs.Ellipsis = append(out.Decs.Ellipsis, n.Decs.Ellipsis...)

		// Node: Elt
		if n.Elt != nil {
			out.Elt = Clone(n.Elt).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *EmptyStmt:
		out := &EmptyStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		// Value: Implicit
		out.Implicit = n.Implicit

		out.Decs.After = n.Decs.After

		return out
	case *ExprStmt:
		out := &ExprStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *Field:
		out := &Field{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// List: Names
		for _, v := range n.Names {
			out.Names = append(out.Names, Clone(v).(*Ident))
		}

		// Node: Type
		if n.Type != nil {
			out.Type = Clone(n.Type).(Expr)
		}

		// Decoration: Type
		out.Decs.Type = append(out.Decs.Type, n.Decs.Type...)

		// Node: Tag
		if n.Tag != nil {
			out.Tag = Clone(n.Tag).(*BasicLit)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *FieldList:
		out := &FieldList{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Token: Opening
		out.Opening = n.Opening

		// Decoration: Opening
		out.Decs.Opening = append(out.Decs.Opening, n.Decs.Opening...)

		// List: List
		for _, v := range n.List {
			out.List = append(out.List, Clone(v).(*Field))
		}

		// Token: Closing
		out.Closing = n.Closing

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *File:
		out := &File{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Package
		out.Decs.Package = append(out.Decs.Package, n.Decs.Package...)

		// Node: Name
		if n.Name != nil {
			out.Name = Clone(n.Name).(*Ident)
		}

		// Decoration: Name
		out.Decs.Name = append(out.Decs.Name, n.Decs.Name...)

		// List: Decls
		for _, v := range n.Decls {
			out.Decls = append(out.Decls, Clone(v).(Decl))
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		// Scope: Scope
		out.Scope = CloneScope(n.Scope)

		// List: Imports
		for _, v := range n.Imports {
			out.Imports = append(out.Imports, Clone(v).(*ImportSpec))
		}

		out.Decs.After = n.Decs.After

		return out
	case *ForStmt:
		out := &ForStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: For
		out.Decs.For = append(out.Decs.For, n.Decs.For...)

		// Node: Init
		if n.Init != nil {
			out.Init = Clone(n.Init).(Stmt)
		}

		// Decoration: Init
		out.Decs.Init = append(out.Decs.Init, n.Decs.Init...)

		// Node: Cond
		if n.Cond != nil {
			out.Cond = Clone(n.Cond).(Expr)
		}

		// Decoration: Cond
		out.Decs.Cond = append(out.Decs.Cond, n.Decs.Cond...)

		// Node: Post
		if n.Post != nil {
			out.Post = Clone(n.Post).(Stmt)
		}

		// Decoration: Post
		out.Decs.Post = append(out.Decs.Post, n.Decs.Post...)

		// Node: Body
		if n.Body != nil {
			out.Body = Clone(n.Body).(*BlockStmt)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *FuncDecl:
		out := &FuncDecl{}

		out.Decs.Before = n.Decs.Before

		// Init: Type
		out.Type = &FuncType{}

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Token: Func
		out.Type.Func = n.Type.Func

		// Decoration: Func
		out.Decs.Func = append(out.Decs.Func, n.Decs.Func...)

		// Node: Recv
		if n.Recv != nil {
			out.Recv = Clone(n.Recv).(*FieldList)
		}

		// Decoration: Recv
		out.Decs.Recv = append(out.Decs.Recv, n.Decs.Recv...)

		// Node: Name
		if n.Name != nil {
			out.Name = Clone(n.Name).(*Ident)
		}

		// Decoration: Name
		out.Decs.Name = append(out.Decs.Name, n.Decs.Name...)

		// Node: TypeParams
		if n.Type.TypeParams != nil {
			out.Type.TypeParams = Clone(n.Type.TypeParams).(*FieldList)
		}

		// Decoration: TypeParams
		out.Decs.TypeParams = append(out.Decs.TypeParams, n.Decs.TypeParams...)

		// Node: Params
		if n.Type.Params != nil {
			out.Type.Params = Clone(n.Type.Params).(*FieldList)
		}

		// Decoration: Params
		out.Decs.Params = append(out.Decs.Params, n.Decs.Params...)

		// Node: Results
		if n.Type.Results != nil {
			out.Type.Results = Clone(n.Type.Results).(*FieldList)
		}

		// Decoration: Results
		out.Decs.Results = append(out.Decs.Results, n.Decs.Results...)

		// Node: Body
		if n.Body != nil {
			out.Body = Clone(n.Body).(*BlockStmt)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *FuncLit:
		out := &FuncLit{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: Type
		if n.Type != nil {
			out.Type = Clone(n.Type).(*FuncType)
		}

		// Decoration: Type
		out.Decs.Type = append(out.Decs.Type, n.Decs.Type...)

		// Node: Body
		if n.Body != nil {
			out.Body = Clone(n.Body).(*BlockStmt)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *FuncType:
		out := &FuncType{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Token: Func
		out.Func = n.Func

		// Decoration: Func
		out.Decs.Func = append(out.Decs.Func, n.Decs.Func...)

		// Node: TypeParams
		if n.TypeParams != nil {
			out.TypeParams = Clone(n.TypeParams).(*FieldList)
		}

		// Decoration: TypeParams
		out.Decs.TypeParams = append(out.Decs.TypeParams, n.Decs.TypeParams...)

		// Node: Params
		if n.Params != nil {
			out.Params = Clone(n.Params).(*FieldList)
		}

		// Decoration: Params
		out.Decs.Params = append(out.Decs.Params, n.Decs.Params...)

		// Node: Results
		if n.Results != nil {
			out.Results = Clone(n.Results).(*FieldList)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *GenDecl:
		out := &GenDecl{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Token: Tok
		out.Tok = n.Tok

		// Decoration: Tok
		out.Decs.Tok = append(out.Decs.Tok, n.Decs.Tok...)

		// Token: Lparen
		out.Lparen = n.Lparen

		// Decoration: Lparen
		out.Decs.Lparen = append(out.Decs.Lparen, n.Decs.Lparen...)

		// List: Specs
		for _, v := range n.Specs {
			out.Specs = append(out.Specs, Clone(v).(Spec))
		}

		// Token: Rparen
		out.Rparen = n.Rparen

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *GoStmt:
		out := &GoStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Go
		out.Decs.Go = append(out.Decs.Go, n.Decs.Go...)

		// Node: Call
		if n.Call != nil {
			out.Call = Clone(n.Call).(*CallExpr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *Ident:
		out := &Ident{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// String: Name
		out.Name = n.Name

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		// Object: Obj
		out.Obj = CloneObject(n.Obj)

		// Path: Path
		out.Path = n.Path

		out.Decs.After = n.Decs.After

		return out
	case *IfStmt:
		out := &IfStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: If
		out.Decs.If = append(out.Decs.If, n.Decs.If...)

		// Node: Init
		if n.Init != nil {
			out.Init = Clone(n.Init).(Stmt)
		}

		// Decoration: Init
		out.Decs.Init = append(out.Decs.Init, n.Decs.Init...)

		// Node: Cond
		if n.Cond != nil {
			out.Cond = Clone(n.Cond).(Expr)
		}

		// Decoration: Cond
		out.Decs.Cond = append(out.Decs.Cond, n.Decs.Cond...)

		// Node: Body
		if n.Body != nil {
			out.Body = Clone(n.Body).(*BlockStmt)
		}

		// Decoration: Else
		out.Decs.Else = append(out.Decs.Else, n.Decs.Else...)

		// Node: Else
		if n.Else != nil {
			out.Else = Clone(n.Else).(Stmt)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *ImportSpec:
		out := &ImportSpec{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: Name
		if n.Name != nil {
			out.Name = Clone(n.Name).(*Ident)
		}

		// Decoration: Name
		out.Decs.Name = append(out.Decs.Name, n.Decs.Name...)

		// Node: Path
		if n.Path != nil {
			out.Path = Clone(n.Path).(*BasicLit)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *IncDecStmt:
		out := &IncDecStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// Token: Tok
		out.Tok = n.Tok

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *IndexExpr:
		out := &IndexExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// Decoration: Lbrack
		out.Decs.Lbrack = append(out.Decs.Lbrack, n.Decs.Lbrack...)

		// Node: Index
		if n.Index != nil {
			out.Index = Clone(n.Index).(Expr)
		}

		// Decoration: Index
		out.Decs.Index = append(out.Decs.Index, n.Decs.Index...)

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *IndexListExpr:
		out := &IndexListExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// Decoration: Lbrack
		out.Decs.Lbrack = append(out.Decs.Lbrack, n.Decs.Lbrack...)

		// List: Indices
		for _, v := range n.Indices {
			out.Indices = append(out.Indices, Clone(v).(Expr))
		}

		// Decoration: Indices
		out.Decs.Indices = append(out.Decs.Indices, n.Decs.Indices...)

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *InterfaceType:
		out := &InterfaceType{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Interface
		out.Decs.Interface = append(out.Decs.Interface, n.Decs.Interface...)

		// Node: Methods
		if n.Methods != nil {
			out.Methods = Clone(n.Methods).(*FieldList)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		// Value: Incomplete
		out.Incomplete = n.Incomplete

		out.Decs.After = n.Decs.After

		return out
	case *KeyValueExpr:
		out := &KeyValueExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: Key
		if n.Key != nil {
			out.Key = Clone(n.Key).(Expr)
		}

		// Decoration: Key
		out.Decs.Key = append(out.Decs.Key, n.Decs.Key...)

		// Decoration: Colon
		out.Decs.Colon = append(out.Decs.Colon, n.Decs.Colon...)

		// Node: Value
		if n.Value != nil {
			out.Value = Clone(n.Value).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *LabeledStmt:
		out := &LabeledStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: Label
		if n.Label != nil {
			out.Label = Clone(n.Label).(*Ident)
		}

		// Decoration: Label
		out.Decs.Label = append(out.Decs.Label, n.Decs.Label...)

		// Decoration: Colon
		out.Decs.Colon = append(out.Decs.Colon, n.Decs.Colon...)

		// Node: Stmt
		if n.Stmt != nil {
			out.Stmt = Clone(n.Stmt).(Stmt)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *MapType:
		out := &MapType{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Map
		out.Decs.Map = append(out.Decs.Map, n.Decs.Map...)

		// Node: Key
		if n.Key != nil {
			out.Key = Clone(n.Key).(Expr)
		}

		// Decoration: Key
		out.Decs.Key = append(out.Decs.Key, n.Decs.Key...)

		// Node: Value
		if n.Value != nil {
			out.Value = Clone(n.Value).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *Package:
		out := &Package{}

		// Value: Name
		out.Name = n.Name

		// Scope: Scope
		out.Scope = CloneScope(n.Scope)

		// Map: Imports
		out.Imports = map[string]*Object{}
		for k, v := range n.Imports {
			out.Imports[k] = CloneObject(v)
		}

		// Map: Files
		out.Files = map[string]*File{}
		for k, v := range n.Files {
			out.Files[k] = Clone(v).(*File)
		}

		return out
	case *ParenExpr:
		out := &ParenExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Lparen
		out.Decs.Lparen = append(out.Decs.Lparen, n.Decs.Lparen...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *RangeStmt:
		out := &RangeStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: For
		out.Decs.For = append(out.Decs.For, n.Decs.For...)

		// Node: Key
		if n.Key != nil {
			out.Key = Clone(n.Key).(Expr)
		}

		// Decoration: Key
		out.Decs.Key = append(out.Decs.Key, n.Decs.Key...)

		// Node: Value
		if n.Value != nil {
			out.Value = Clone(n.Value).(Expr)
		}

		// Decoration: Value
		out.Decs.Value = append(out.Decs.Value, n.Decs.Value...)

		// Token: Tok
		out.Tok = n.Tok

		// Decoration: Range
		out.Decs.Range = append(out.Decs.Range, n.Decs.Range...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// Node: Body
		if n.Body != nil {
			out.Body = Clone(n.Body).(*BlockStmt)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *ReturnStmt:
		out := &ReturnStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Return
		out.Decs.Return = append(out.Decs.Return, n.Decs.Return...)

		// List: Results
		for _, v := range n.Results {
			out.Results = append(out.Results, Clone(v).(Expr))
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *SelectStmt:
		out := &SelectStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Select
		out.Decs.Select = append(out.Decs.Select, n.Decs.Select...)

		// Node: Body
		if n.Body != nil {
			out.Body = Clone(n.Body).(*BlockStmt)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *SelectorExpr:
		out := &SelectorExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// Node: Sel
		if n.Sel != nil {
			out.Sel = Clone(n.Sel).(*Ident)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *SendStmt:
		out := &SendStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: Chan
		if n.Chan != nil {
			out.Chan = Clone(n.Chan).(Expr)
		}

		// Decoration: Chan
		out.Decs.Chan = append(out.Decs.Chan, n.Decs.Chan...)

		// Decoration: Arrow
		out.Decs.Arrow = append(out.Decs.Arrow, n.Decs.Arrow...)

		// Node: Value
		if n.Value != nil {
			out.Value = Clone(n.Value).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *SliceExpr:
		out := &SliceExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// Decoration: Lbrack
		out.Decs.Lbrack = append(out.Decs.Lbrack, n.Decs.Lbrack...)

		// Node: Low
		if n.Low != nil {
			out.Low = Clone(n.Low).(Expr)
		}

		// Decoration: Low
		out.Decs.Low = append(out.Decs.Low, n.Decs.Low...)

		// Node: High
		if n.High != nil {
			out.High = Clone(n.High).(Expr)
		}

		// Decoration: High
		out.Decs.High = append(out.Decs.High, n.Decs.High...)

		// Node: Max
		if n.Max != nil {
			out.Max = Clone(n.Max).(Expr)
		}

		// Decoration: Max
		out.Decs.Max = append(out.Decs.Max, n.Decs.Max...)

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		// Value: Slice3
		out.Slice3 = n.Slice3

		out.Decs.After = n.Decs.After

		return out
	case *StarExpr:
		out := &StarExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Star
		out.Decs.Star = append(out.Decs.Star, n.Decs.Star...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *StructType:
		out := &StructType{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Struct
		out.Decs.Struct = append(out.Decs.Struct, n.Decs.Struct...)

		// Node: Fields
		if n.Fields != nil {
			out.Fields = Clone(n.Fields).(*FieldList)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		// Value: Incomplete
		out.Incomplete = n.Incomplete

		out.Decs.After = n.Decs.After

		return out
	case *SwitchStmt:
		out := &SwitchStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Switch
		out.Decs.Switch = append(out.Decs.Switch, n.Decs.Switch...)

		// Node: Init
		if n.Init != nil {
			out.Init = Clone(n.Init).(Stmt)
		}

		// Decoration: Init
		out.Decs.Init = append(out.Decs.Init, n.Decs.Init...)

		// Node: Tag
		if n.Tag != nil {
			out.Tag = Clone(n.Tag).(Expr)
		}

		// Decoration: Tag
		out.Decs.Tag = append(out.Decs.Tag, n.Decs.Tag...)

		// Node: Body
		if n.Body != nil {
			out.Body = Clone(n.Body).(*BlockStmt)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *TypeAssertExpr:
		out := &TypeAssertExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: X
		out.Decs.X = append(out.Decs.X, n.Decs.X...)

		// Decoration: Lparen
		out.Decs.Lparen = append(out.Decs.Lparen, n.Decs.Lparen...)

		// Node: Type
		if n.Type != nil {
			out.Type = Clone(n.Type).(Expr)
		}

		// Decoration: Type
		out.Decs.Type = append(out.Decs.Type, n.Decs.Type...)

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *TypeSpec:
		out := &TypeSpec{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Node: Name
		if n.Name != nil {
			out.Name = Clone(n.Name).(*Ident)
		}

		// Token: Assign
		out.Assign = n.Assign

		// Decoration: Name
		out.Decs.Name = append(out.Decs.Name, n.Decs.Name...)

		// Node: TypeParams
		if n.TypeParams != nil {
			out.TypeParams = Clone(n.TypeParams).(*FieldList)
		}

		// Decoration: TypeParams
		out.Decs.TypeParams = append(out.Decs.TypeParams, n.Decs.TypeParams...)

		// Node: Type
		if n.Type != nil {
			out.Type = Clone(n.Type).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *TypeSwitchStmt:
		out := &TypeSwitchStmt{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Decoration: Switch
		out.Decs.Switch = append(out.Decs.Switch, n.Decs.Switch...)

		// Node: Init
		if n.Init != nil {
			out.Init = Clone(n.Init).(Stmt)
		}

		// Decoration: Init
		out.Decs.Init = append(out.Decs.Init, n.Decs.Init...)

		// Node: Assign
		if n.Assign != nil {
			out.Assign = Clone(n.Assign).(Stmt)
		}

		// Decoration: Assign
		out.Decs.Assign = append(out.Decs.Assign, n.Decs.Assign...)

		// Node: Body
		if n.Body != nil {
			out.Body = Clone(n.Body).(*BlockStmt)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *UnaryExpr:
		out := &UnaryExpr{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// Token: Op
		out.Op = n.Op

		// Decoration: Op
		out.Decs.Op = append(out.Decs.Op, n.Decs.Op...)

		// Node: X
		if n.X != nil {
			out.X = Clone(n.X).(Expr)
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	case *ValueSpec:
		out := &ValueSpec{}

		out.Decs.Before = n.Decs.Before

		// Decoration: Start
		out.Decs.Start = append(out.Decs.Start, n.Decs.Start...)

		// List: Names
		for _, v := range n.Names {
			out.Names = append(out.Names, Clone(v).(*Ident))
		}

		// Node: Type
		if n.Type != nil {
			out.Type = Clone(n.Type).(Expr)
		}

		// Decoration: Assign
		out.Decs.Assign = append(out.Decs.Assign, n.Decs.Assign...)

		// List: Values
		for _, v := range n.Values {
			out.Values = append(out.Values, Clone(v).(Expr))
		}

		// Decoration: End
		out.Decs.End = append(out.Decs.End, n.Decs.End...)

		out.Decs.After = n.Decs.After

		return out
	default:
		panic(fmt.Sprintf("%T", n))
	}
}
