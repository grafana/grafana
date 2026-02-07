package decorator

import (
	"github.com/dave/dst"
	"go/ast"
	"go/token"
)

func (f *fileDecorator) decorateNode(parent ast.Node, parentName, parentField, parentFieldType string, n ast.Node) (dst.Node, error) {
	if dn, ok := f.Dst.Nodes[n]; ok {
		return dn, nil
	}
	switch n := n.(type) {
	case *ast.ArrayType:
		out := &dst.ArrayType{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Lbrack

		// Node: Len
		if n.Len != nil {
			child, err := f.decorateNode(n, "ArrayType", "Len", "Expr", n.Len)
			if err != nil {
				return nil, err
			}
			out.Len = child.(dst.Expr)
		}

		// Token: Rbrack

		// Node: Elt
		if n.Elt != nil {
			child, err := f.decorateNode(n, "ArrayType", "Elt", "Expr", n.Elt)
			if err != nil {
				return nil, err
			}
			out.Elt = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Lbrack"]; ok {
				out.Decs.Lbrack = decs
			}
			if decs, ok := nd["Len"]; ok {
				out.Decs.Len = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.AssignStmt:
		out := &dst.AssignStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// List: Lhs
		for _, v := range n.Lhs {
			child, err := f.decorateNode(n, "AssignStmt", "Lhs", "Expr", v)
			if err != nil {
				return nil, err
			}
			out.Lhs = append(out.Lhs, child.(dst.Expr))
		}

		// Token: Tok
		out.Tok = n.Tok

		// List: Rhs
		for _, v := range n.Rhs {
			child, err := f.decorateNode(n, "AssignStmt", "Rhs", "Expr", v)
			if err != nil {
				return nil, err
			}
			out.Rhs = append(out.Rhs, child.(dst.Expr))
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Tok"]; ok {
				out.Decs.Tok = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.BadDecl:
		out := &dst.BadDecl{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Bad
		out.Length = int(n.To - n.From)

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.BadExpr:
		out := &dst.BadExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Bad
		out.Length = int(n.To - n.From)

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.BadStmt:
		out := &dst.BadStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Bad
		out.Length = int(n.To - n.From)

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.BasicLit:
		out := &dst.BasicLit{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// String: Value
		out.Value = n.Value

		// Value: Kind
		out.Kind = n.Kind

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.BinaryExpr:
		out := &dst.BinaryExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "BinaryExpr", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		// Token: Op
		out.Op = n.Op

		// Node: Y
		if n.Y != nil {
			child, err := f.decorateNode(n, "BinaryExpr", "Y", "Expr", n.Y)
			if err != nil {
				return nil, err
			}
			out.Y = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["Op"]; ok {
				out.Decs.Op = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.BlockStmt:
		out := &dst.BlockStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Lbrace

		// List: List
		for _, v := range n.List {
			child, err := f.decorateNode(n, "BlockStmt", "List", "Stmt", v)
			if err != nil {
				return nil, err
			}
			out.List = append(out.List, child.(dst.Stmt))
		}

		// Token: Rbrace
		if n.Rbrace == token.NoPos {
			out.RbraceHasNoPos = true
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Lbrace"]; ok {
				out.Decs.Lbrace = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.BranchStmt:
		out := &dst.BranchStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Tok
		out.Tok = n.Tok

		// Node: Label
		if n.Label != nil {
			child, err := f.decorateNode(n, "BranchStmt", "Label", "Ident", n.Label)
			if err != nil {
				return nil, err
			}
			out.Label = child.(*dst.Ident)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Tok"]; ok {
				out.Decs.Tok = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.CallExpr:
		out := &dst.CallExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: Fun
		if n.Fun != nil {
			child, err := f.decorateNode(n, "CallExpr", "Fun", "Expr", n.Fun)
			if err != nil {
				return nil, err
			}
			out.Fun = child.(dst.Expr)
		}

		// Token: Lparen

		// List: Args
		for _, v := range n.Args {
			child, err := f.decorateNode(n, "CallExpr", "Args", "Expr", v)
			if err != nil {
				return nil, err
			}
			out.Args = append(out.Args, child.(dst.Expr))
		}

		// Token: Ellipsis
		out.Ellipsis = n.Ellipsis.IsValid()

		// Token: Rparen

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Fun"]; ok {
				out.Decs.Fun = decs
			}
			if decs, ok := nd["Lparen"]; ok {
				out.Decs.Lparen = decs
			}
			if decs, ok := nd["Ellipsis"]; ok {
				out.Decs.Ellipsis = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.CaseClause:
		out := &dst.CaseClause{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Case

		// List: List
		for _, v := range n.List {
			child, err := f.decorateNode(n, "CaseClause", "List", "Expr", v)
			if err != nil {
				return nil, err
			}
			out.List = append(out.List, child.(dst.Expr))
		}

		// Token: Colon

		// List: Body
		for _, v := range n.Body {
			child, err := f.decorateNode(n, "CaseClause", "Body", "Stmt", v)
			if err != nil {
				return nil, err
			}
			out.Body = append(out.Body, child.(dst.Stmt))
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Case"]; ok {
				out.Decs.Case = decs
			}
			if decs, ok := nd["Colon"]; ok {
				out.Decs.Colon = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.ChanType:
		out := &dst.ChanType{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Begin

		// Token: Chan

		// Token: Arrow

		// Node: Value
		if n.Value != nil {
			child, err := f.decorateNode(n, "ChanType", "Value", "Expr", n.Value)
			if err != nil {
				return nil, err
			}
			out.Value = child.(dst.Expr)
		}

		// Value: Dir
		out.Dir = dst.ChanDir(n.Dir)

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Begin"]; ok {
				out.Decs.Begin = decs
			}
			if decs, ok := nd["Arrow"]; ok {
				out.Decs.Arrow = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.CommClause:
		out := &dst.CommClause{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Case

		// Node: Comm
		if n.Comm != nil {
			child, err := f.decorateNode(n, "CommClause", "Comm", "Stmt", n.Comm)
			if err != nil {
				return nil, err
			}
			out.Comm = child.(dst.Stmt)
		}

		// Token: Colon

		// List: Body
		for _, v := range n.Body {
			child, err := f.decorateNode(n, "CommClause", "Body", "Stmt", v)
			if err != nil {
				return nil, err
			}
			out.Body = append(out.Body, child.(dst.Stmt))
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Case"]; ok {
				out.Decs.Case = decs
			}
			if decs, ok := nd["Comm"]; ok {
				out.Decs.Comm = decs
			}
			if decs, ok := nd["Colon"]; ok {
				out.Decs.Colon = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.CompositeLit:
		out := &dst.CompositeLit{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: Type
		if n.Type != nil {
			child, err := f.decorateNode(n, "CompositeLit", "Type", "Expr", n.Type)
			if err != nil {
				return nil, err
			}
			out.Type = child.(dst.Expr)
		}

		// Token: Lbrace

		// List: Elts
		for _, v := range n.Elts {
			child, err := f.decorateNode(n, "CompositeLit", "Elts", "Expr", v)
			if err != nil {
				return nil, err
			}
			out.Elts = append(out.Elts, child.(dst.Expr))
		}

		// Token: Rbrace

		// Value: Incomplete
		out.Incomplete = n.Incomplete

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Type"]; ok {
				out.Decs.Type = decs
			}
			if decs, ok := nd["Lbrace"]; ok {
				out.Decs.Lbrace = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.DeclStmt:
		out := &dst.DeclStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: Decl
		if n.Decl != nil {
			child, err := f.decorateNode(n, "DeclStmt", "Decl", "Decl", n.Decl)
			if err != nil {
				return nil, err
			}
			out.Decl = child.(dst.Decl)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.DeferStmt:
		out := &dst.DeferStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Defer

		// Node: Call
		if n.Call != nil {
			child, err := f.decorateNode(n, "DeferStmt", "Call", "CallExpr", n.Call)
			if err != nil {
				return nil, err
			}
			out.Call = child.(*dst.CallExpr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Defer"]; ok {
				out.Decs.Defer = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.Ellipsis:
		out := &dst.Ellipsis{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Ellipsis

		// Node: Elt
		if n.Elt != nil {
			child, err := f.decorateNode(n, "Ellipsis", "Elt", "Expr", n.Elt)
			if err != nil {
				return nil, err
			}
			out.Elt = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Ellipsis"]; ok {
				out.Decs.Ellipsis = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.EmptyStmt:
		out := &dst.EmptyStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Semicolon

		// Value: Implicit
		out.Implicit = n.Implicit

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.ExprStmt:
		out := &dst.ExprStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "ExprStmt", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.Field:
		out := &dst.Field{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// List: Names
		for _, v := range n.Names {
			child, err := f.decorateNode(n, "Field", "Names", "Ident", v)
			if err != nil {
				return nil, err
			}
			out.Names = append(out.Names, child.(*dst.Ident))
		}

		// Node: Type
		if n.Type != nil {
			child, err := f.decorateNode(n, "Field", "Type", "Expr", n.Type)
			if err != nil {
				return nil, err
			}
			out.Type = child.(dst.Expr)
		}

		// Node: Tag
		if n.Tag != nil {
			child, err := f.decorateNode(n, "Field", "Tag", "BasicLit", n.Tag)
			if err != nil {
				return nil, err
			}
			out.Tag = child.(*dst.BasicLit)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Type"]; ok {
				out.Decs.Type = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.FieldList:
		out := &dst.FieldList{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Opening
		out.Opening = n.Opening.IsValid()

		// List: List
		for _, v := range n.List {
			child, err := f.decorateNode(n, "FieldList", "List", "Field", v)
			if err != nil {
				return nil, err
			}
			out.List = append(out.List, child.(*dst.Field))
		}

		// Token: Closing
		out.Closing = n.Closing.IsValid()

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Opening"]; ok {
				out.Decs.Opening = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.File:
		out := &dst.File{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Package

		// Node: Name
		if n.Name != nil {
			child, err := f.decorateNode(n, "File", "Name", "Ident", n.Name)
			if err != nil {
				return nil, err
			}
			out.Name = child.(*dst.Ident)
		}

		// List: Decls
		for _, v := range n.Decls {
			child, err := f.decorateNode(n, "File", "Decls", "Decl", v)
			if err != nil {
				return nil, err
			}
			out.Decls = append(out.Decls, child.(dst.Decl))
		}

		// Scope: Scope
		scope, err := f.decorateScope(n.Scope)
		if err != nil {
			return nil, err
		}
		out.Scope = scope

		// List: Imports
		for _, v := range n.Imports {
			child, err := f.decorateNode(n, "File", "Imports", "ImportSpec", v)
			if err != nil {
				return nil, err
			}
			out.Imports = append(out.Imports, child.(*dst.ImportSpec))
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Package"]; ok {
				out.Decs.Package = decs
			}
			if decs, ok := nd["Name"]; ok {
				out.Decs.Name = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.ForStmt:
		out := &dst.ForStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: For

		// Node: Init
		if n.Init != nil {
			child, err := f.decorateNode(n, "ForStmt", "Init", "Stmt", n.Init)
			if err != nil {
				return nil, err
			}
			out.Init = child.(dst.Stmt)
		}

		// Token: InitSemicolon

		// Node: Cond
		if n.Cond != nil {
			child, err := f.decorateNode(n, "ForStmt", "Cond", "Expr", n.Cond)
			if err != nil {
				return nil, err
			}
			out.Cond = child.(dst.Expr)
		}

		// Token: CondSemicolon

		// Node: Post
		if n.Post != nil {
			child, err := f.decorateNode(n, "ForStmt", "Post", "Stmt", n.Post)
			if err != nil {
				return nil, err
			}
			out.Post = child.(dst.Stmt)
		}

		// Node: Body
		if n.Body != nil {
			child, err := f.decorateNode(n, "ForStmt", "Body", "BlockStmt", n.Body)
			if err != nil {
				return nil, err
			}
			out.Body = child.(*dst.BlockStmt)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["For"]; ok {
				out.Decs.For = decs
			}
			if decs, ok := nd["Init"]; ok {
				out.Decs.Init = decs
			}
			if decs, ok := nd["Cond"]; ok {
				out.Decs.Cond = decs
			}
			if decs, ok := nd["Post"]; ok {
				out.Decs.Post = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.FuncDecl:
		out := &dst.FuncDecl{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Init: Type
		out.Type = &dst.FuncType{}
		f.Dst.Nodes[n.Type] = out.Type
		f.Ast.Nodes[out.Type] = n.Type

		// Token: Func
		out.Type.Func = true

		// Node: Recv
		if n.Recv != nil {
			child, err := f.decorateNode(n, "FuncDecl", "Recv", "FieldList", n.Recv)
			if err != nil {
				return nil, err
			}
			out.Recv = child.(*dst.FieldList)
		}

		// Node: Name
		if n.Name != nil {
			child, err := f.decorateNode(n, "FuncDecl", "Name", "Ident", n.Name)
			if err != nil {
				return nil, err
			}
			out.Name = child.(*dst.Ident)
		}

		// Node: TypeParams
		if n.Type.TypeParams != nil {
			child, err := f.decorateNode(n, "FuncDecl", "TypeParams", "FieldList", n.Type.TypeParams)
			if err != nil {
				return nil, err
			}
			out.Type.TypeParams = child.(*dst.FieldList)
		}

		// Node: Params
		if n.Type.Params != nil {
			child, err := f.decorateNode(n, "FuncDecl", "Params", "FieldList", n.Type.Params)
			if err != nil {
				return nil, err
			}
			out.Type.Params = child.(*dst.FieldList)
		}

		// Node: Results
		if n.Type.Results != nil {
			child, err := f.decorateNode(n, "FuncDecl", "Results", "FieldList", n.Type.Results)
			if err != nil {
				return nil, err
			}
			out.Type.Results = child.(*dst.FieldList)
		}

		// Node: Body
		if n.Body != nil {
			child, err := f.decorateNode(n, "FuncDecl", "Body", "BlockStmt", n.Body)
			if err != nil {
				return nil, err
			}
			out.Body = child.(*dst.BlockStmt)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Func"]; ok {
				out.Decs.Func = decs
			}
			if decs, ok := nd["Recv"]; ok {
				out.Decs.Recv = decs
			}
			if decs, ok := nd["Name"]; ok {
				out.Decs.Name = decs
			}
			if decs, ok := nd["TypeParams"]; ok {
				out.Decs.TypeParams = decs
			}
			if decs, ok := nd["Params"]; ok {
				out.Decs.Params = decs
			}
			if decs, ok := nd["Results"]; ok {
				out.Decs.Results = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.FuncLit:
		out := &dst.FuncLit{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: Type
		if n.Type != nil {
			child, err := f.decorateNode(n, "FuncLit", "Type", "FuncType", n.Type)
			if err != nil {
				return nil, err
			}
			out.Type = child.(*dst.FuncType)
		}

		// Node: Body
		if n.Body != nil {
			child, err := f.decorateNode(n, "FuncLit", "Body", "BlockStmt", n.Body)
			if err != nil {
				return nil, err
			}
			out.Body = child.(*dst.BlockStmt)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Type"]; ok {
				out.Decs.Type = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.FuncType:
		out := &dst.FuncType{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Func
		out.Func = n.Func.IsValid()

		// Node: TypeParams
		if n.TypeParams != nil {
			child, err := f.decorateNode(n, "FuncType", "TypeParams", "FieldList", n.TypeParams)
			if err != nil {
				return nil, err
			}
			out.TypeParams = child.(*dst.FieldList)
		}

		// Node: Params
		if n.Params != nil {
			child, err := f.decorateNode(n, "FuncType", "Params", "FieldList", n.Params)
			if err != nil {
				return nil, err
			}
			out.Params = child.(*dst.FieldList)
		}

		// Node: Results
		if n.Results != nil {
			child, err := f.decorateNode(n, "FuncType", "Results", "FieldList", n.Results)
			if err != nil {
				return nil, err
			}
			out.Results = child.(*dst.FieldList)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Func"]; ok {
				out.Decs.Func = decs
			}
			if decs, ok := nd["TypeParams"]; ok {
				out.Decs.TypeParams = decs
			}
			if decs, ok := nd["Params"]; ok {
				out.Decs.Params = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.GenDecl:
		out := &dst.GenDecl{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Tok
		out.Tok = n.Tok

		// Token: Lparen
		out.Lparen = n.Lparen.IsValid()

		// List: Specs
		for _, v := range n.Specs {
			child, err := f.decorateNode(n, "GenDecl", "Specs", "Spec", v)
			if err != nil {
				return nil, err
			}
			out.Specs = append(out.Specs, child.(dst.Spec))
		}

		// Token: Rparen
		out.Rparen = n.Rparen.IsValid()

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Tok"]; ok {
				out.Decs.Tok = decs
			}
			if decs, ok := nd["Lparen"]; ok {
				out.Decs.Lparen = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.GoStmt:
		out := &dst.GoStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Go

		// Node: Call
		if n.Call != nil {
			child, err := f.decorateNode(n, "GoStmt", "Call", "CallExpr", n.Call)
			if err != nil {
				return nil, err
			}
			out.Call = child.(*dst.CallExpr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Go"]; ok {
				out.Decs.Go = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.Ident:
		out := &dst.Ident{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// String: Name
		out.Name = n.Name

		// Object: Obj
		ob, err := f.decorateObject(n.Obj)
		if err != nil {
			return nil, err
		}
		out.Obj = ob

		// Path: Path
		if f.Resolver != nil {
			path, err := f.resolvePath(false, parent, parentName, parentField, parentFieldType, n)
			if err != nil {
				return nil, err
			}
			out.Path = path
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.IfStmt:
		out := &dst.IfStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: If

		// Node: Init
		if n.Init != nil {
			child, err := f.decorateNode(n, "IfStmt", "Init", "Stmt", n.Init)
			if err != nil {
				return nil, err
			}
			out.Init = child.(dst.Stmt)
		}

		// Node: Cond
		if n.Cond != nil {
			child, err := f.decorateNode(n, "IfStmt", "Cond", "Expr", n.Cond)
			if err != nil {
				return nil, err
			}
			out.Cond = child.(dst.Expr)
		}

		// Node: Body
		if n.Body != nil {
			child, err := f.decorateNode(n, "IfStmt", "Body", "BlockStmt", n.Body)
			if err != nil {
				return nil, err
			}
			out.Body = child.(*dst.BlockStmt)
		}

		// Token: ElseTok

		// Node: Else
		if n.Else != nil {
			child, err := f.decorateNode(n, "IfStmt", "Else", "Stmt", n.Else)
			if err != nil {
				return nil, err
			}
			out.Else = child.(dst.Stmt)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["If"]; ok {
				out.Decs.If = decs
			}
			if decs, ok := nd["Init"]; ok {
				out.Decs.Init = decs
			}
			if decs, ok := nd["Cond"]; ok {
				out.Decs.Cond = decs
			}
			if decs, ok := nd["Else"]; ok {
				out.Decs.Else = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.ImportSpec:
		out := &dst.ImportSpec{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: Name
		if n.Name != nil {
			child, err := f.decorateNode(n, "ImportSpec", "Name", "Ident", n.Name)
			if err != nil {
				return nil, err
			}
			out.Name = child.(*dst.Ident)
		}

		// Node: Path
		if n.Path != nil {
			child, err := f.decorateNode(n, "ImportSpec", "Path", "BasicLit", n.Path)
			if err != nil {
				return nil, err
			}
			out.Path = child.(*dst.BasicLit)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Name"]; ok {
				out.Decs.Name = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.IncDecStmt:
		out := &dst.IncDecStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "IncDecStmt", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		// Token: Tok
		out.Tok = n.Tok

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.IndexExpr:
		out := &dst.IndexExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "IndexExpr", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		// Token: Lbrack

		// Node: Index
		if n.Index != nil {
			child, err := f.decorateNode(n, "IndexExpr", "Index", "Expr", n.Index)
			if err != nil {
				return nil, err
			}
			out.Index = child.(dst.Expr)
		}

		// Token: Rbrack

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["Lbrack"]; ok {
				out.Decs.Lbrack = decs
			}
			if decs, ok := nd["Index"]; ok {
				out.Decs.Index = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.IndexListExpr:
		out := &dst.IndexListExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "IndexListExpr", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		// Token: Lbrack

		// List: Indices
		for _, v := range n.Indices {
			child, err := f.decorateNode(n, "IndexListExpr", "Indices", "Expr", v)
			if err != nil {
				return nil, err
			}
			out.Indices = append(out.Indices, child.(dst.Expr))
		}

		// Token: Rbrack

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["Lbrack"]; ok {
				out.Decs.Lbrack = decs
			}
			if decs, ok := nd["Indices"]; ok {
				out.Decs.Indices = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.InterfaceType:
		out := &dst.InterfaceType{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Interface

		// Node: Methods
		if n.Methods != nil {
			child, err := f.decorateNode(n, "InterfaceType", "Methods", "FieldList", n.Methods)
			if err != nil {
				return nil, err
			}
			out.Methods = child.(*dst.FieldList)
		}

		// Value: Incomplete
		out.Incomplete = n.Incomplete

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Interface"]; ok {
				out.Decs.Interface = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.KeyValueExpr:
		out := &dst.KeyValueExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: Key
		if n.Key != nil {
			child, err := f.decorateNode(n, "KeyValueExpr", "Key", "Expr", n.Key)
			if err != nil {
				return nil, err
			}
			out.Key = child.(dst.Expr)
		}

		// Token: Colon

		// Node: Value
		if n.Value != nil {
			child, err := f.decorateNode(n, "KeyValueExpr", "Value", "Expr", n.Value)
			if err != nil {
				return nil, err
			}
			out.Value = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Key"]; ok {
				out.Decs.Key = decs
			}
			if decs, ok := nd["Colon"]; ok {
				out.Decs.Colon = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.LabeledStmt:
		out := &dst.LabeledStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: Label
		if n.Label != nil {
			child, err := f.decorateNode(n, "LabeledStmt", "Label", "Ident", n.Label)
			if err != nil {
				return nil, err
			}
			out.Label = child.(*dst.Ident)
		}

		// Token: Colon

		// Node: Stmt
		if n.Stmt != nil {
			child, err := f.decorateNode(n, "LabeledStmt", "Stmt", "Stmt", n.Stmt)
			if err != nil {
				return nil, err
			}
			out.Stmt = child.(dst.Stmt)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Label"]; ok {
				out.Decs.Label = decs
			}
			if decs, ok := nd["Colon"]; ok {
				out.Decs.Colon = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.MapType:
		out := &dst.MapType{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Map

		// Token: Lbrack

		// Node: Key
		if n.Key != nil {
			child, err := f.decorateNode(n, "MapType", "Key", "Expr", n.Key)
			if err != nil {
				return nil, err
			}
			out.Key = child.(dst.Expr)
		}

		// Token: Rbrack

		// Node: Value
		if n.Value != nil {
			child, err := f.decorateNode(n, "MapType", "Value", "Expr", n.Value)
			if err != nil {
				return nil, err
			}
			out.Value = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Map"]; ok {
				out.Decs.Map = decs
			}
			if decs, ok := nd["Key"]; ok {
				out.Decs.Key = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.Package:
		out := &dst.Package{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		// Value: Name
		out.Name = n.Name

		// Scope: Scope
		scope, err := f.decorateScope(n.Scope)
		if err != nil {
			return nil, err
		}
		out.Scope = scope

		// Map: Imports
		out.Imports = map[string]*dst.Object{}
		for k, v := range n.Imports {
			ob, err := f.decorateObject(v)
			if err != nil {
				return nil, err
			}
			out.Imports[k] = ob
		}

		// Map: Files
		out.Files = map[string]*dst.File{}
		for k, v := range n.Files {
			child, err := f.decorateNode(n, "Package", "Files", "File", v)
			if err != nil {
				return nil, err
			}
			out.Files[k] = child.(*dst.File)
		}

		return out, nil
	case *ast.ParenExpr:
		out := &dst.ParenExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Lparen

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "ParenExpr", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		// Token: Rparen

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Lparen"]; ok {
				out.Decs.Lparen = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.RangeStmt:
		out := &dst.RangeStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: For

		// Node: Key
		if n.Key != nil {
			child, err := f.decorateNode(n, "RangeStmt", "Key", "Expr", n.Key)
			if err != nil {
				return nil, err
			}
			out.Key = child.(dst.Expr)
		}

		// Token: Comma

		// Node: Value
		if n.Value != nil {
			child, err := f.decorateNode(n, "RangeStmt", "Value", "Expr", n.Value)
			if err != nil {
				return nil, err
			}
			out.Value = child.(dst.Expr)
		}

		// Token: Tok
		out.Tok = n.Tok

		// Token: Range

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "RangeStmt", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		// Node: Body
		if n.Body != nil {
			child, err := f.decorateNode(n, "RangeStmt", "Body", "BlockStmt", n.Body)
			if err != nil {
				return nil, err
			}
			out.Body = child.(*dst.BlockStmt)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["For"]; ok {
				out.Decs.For = decs
			}
			if decs, ok := nd["Key"]; ok {
				out.Decs.Key = decs
			}
			if decs, ok := nd["Value"]; ok {
				out.Decs.Value = decs
			}
			if decs, ok := nd["Range"]; ok {
				out.Decs.Range = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.ReturnStmt:
		out := &dst.ReturnStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Return

		// List: Results
		for _, v := range n.Results {
			child, err := f.decorateNode(n, "ReturnStmt", "Results", "Expr", v)
			if err != nil {
				return nil, err
			}
			out.Results = append(out.Results, child.(dst.Expr))
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Return"]; ok {
				out.Decs.Return = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.SelectStmt:
		out := &dst.SelectStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Select

		// Node: Body
		if n.Body != nil {
			child, err := f.decorateNode(n, "SelectStmt", "Body", "BlockStmt", n.Body)
			if err != nil {
				return nil, err
			}
			out.Body = child.(*dst.BlockStmt)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Select"]; ok {
				out.Decs.Select = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.SelectorExpr:

		// Special case for *ast.SelectorExpr - replace with Ident if needed
		id, err := f.decorateSelectorExpr(parent, parentName, parentField, parentFieldType, n)
		if err != nil {
			return nil, err
		}
		if id != nil {
			return id, nil
		}

		out := &dst.SelectorExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "SelectorExpr", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		// Token: Period

		// Node: Sel
		if n.Sel != nil {
			child, err := f.decorateNode(n, "SelectorExpr", "Sel", "Ident", n.Sel)
			if err != nil {
				return nil, err
			}
			out.Sel = child.(*dst.Ident)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.SendStmt:
		out := &dst.SendStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: Chan
		if n.Chan != nil {
			child, err := f.decorateNode(n, "SendStmt", "Chan", "Expr", n.Chan)
			if err != nil {
				return nil, err
			}
			out.Chan = child.(dst.Expr)
		}

		// Token: Arrow

		// Node: Value
		if n.Value != nil {
			child, err := f.decorateNode(n, "SendStmt", "Value", "Expr", n.Value)
			if err != nil {
				return nil, err
			}
			out.Value = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Chan"]; ok {
				out.Decs.Chan = decs
			}
			if decs, ok := nd["Arrow"]; ok {
				out.Decs.Arrow = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.SliceExpr:
		out := &dst.SliceExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "SliceExpr", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		// Token: Lbrack

		// Node: Low
		if n.Low != nil {
			child, err := f.decorateNode(n, "SliceExpr", "Low", "Expr", n.Low)
			if err != nil {
				return nil, err
			}
			out.Low = child.(dst.Expr)
		}

		// Token: Colon1

		// Node: High
		if n.High != nil {
			child, err := f.decorateNode(n, "SliceExpr", "High", "Expr", n.High)
			if err != nil {
				return nil, err
			}
			out.High = child.(dst.Expr)
		}

		// Token: Colon2

		// Node: Max
		if n.Max != nil {
			child, err := f.decorateNode(n, "SliceExpr", "Max", "Expr", n.Max)
			if err != nil {
				return nil, err
			}
			out.Max = child.(dst.Expr)
		}

		// Token: Rbrack

		// Value: Slice3
		out.Slice3 = n.Slice3

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["Lbrack"]; ok {
				out.Decs.Lbrack = decs
			}
			if decs, ok := nd["Low"]; ok {
				out.Decs.Low = decs
			}
			if decs, ok := nd["High"]; ok {
				out.Decs.High = decs
			}
			if decs, ok := nd["Max"]; ok {
				out.Decs.Max = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.StarExpr:
		out := &dst.StarExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Star

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "StarExpr", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Star"]; ok {
				out.Decs.Star = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.StructType:
		out := &dst.StructType{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Struct

		// Node: Fields
		if n.Fields != nil {
			child, err := f.decorateNode(n, "StructType", "Fields", "FieldList", n.Fields)
			if err != nil {
				return nil, err
			}
			out.Fields = child.(*dst.FieldList)
		}

		// Value: Incomplete
		out.Incomplete = n.Incomplete

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Struct"]; ok {
				out.Decs.Struct = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.SwitchStmt:
		out := &dst.SwitchStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Switch

		// Node: Init
		if n.Init != nil {
			child, err := f.decorateNode(n, "SwitchStmt", "Init", "Stmt", n.Init)
			if err != nil {
				return nil, err
			}
			out.Init = child.(dst.Stmt)
		}

		// Node: Tag
		if n.Tag != nil {
			child, err := f.decorateNode(n, "SwitchStmt", "Tag", "Expr", n.Tag)
			if err != nil {
				return nil, err
			}
			out.Tag = child.(dst.Expr)
		}

		// Node: Body
		if n.Body != nil {
			child, err := f.decorateNode(n, "SwitchStmt", "Body", "BlockStmt", n.Body)
			if err != nil {
				return nil, err
			}
			out.Body = child.(*dst.BlockStmt)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Switch"]; ok {
				out.Decs.Switch = decs
			}
			if decs, ok := nd["Init"]; ok {
				out.Decs.Init = decs
			}
			if decs, ok := nd["Tag"]; ok {
				out.Decs.Tag = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.TypeAssertExpr:
		out := &dst.TypeAssertExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "TypeAssertExpr", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		// Token: Period

		// Token: Lparen

		// Node: Type
		if n.Type != nil {
			child, err := f.decorateNode(n, "TypeAssertExpr", "Type", "Expr", n.Type)
			if err != nil {
				return nil, err
			}
			out.Type = child.(dst.Expr)
		}

		// Token: TypeToken

		// Token: Rparen

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["X"]; ok {
				out.Decs.X = decs
			}
			if decs, ok := nd["Lparen"]; ok {
				out.Decs.Lparen = decs
			}
			if decs, ok := nd["Type"]; ok {
				out.Decs.Type = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.TypeSpec:
		out := &dst.TypeSpec{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Node: Name
		if n.Name != nil {
			child, err := f.decorateNode(n, "TypeSpec", "Name", "Ident", n.Name)
			if err != nil {
				return nil, err
			}
			out.Name = child.(*dst.Ident)
		}

		// Token: Assign
		out.Assign = n.Assign.IsValid()

		// Node: TypeParams
		if n.TypeParams != nil {
			child, err := f.decorateNode(n, "TypeSpec", "TypeParams", "FieldList", n.TypeParams)
			if err != nil {
				return nil, err
			}
			out.TypeParams = child.(*dst.FieldList)
		}

		// Node: Type
		if n.Type != nil {
			child, err := f.decorateNode(n, "TypeSpec", "Type", "Expr", n.Type)
			if err != nil {
				return nil, err
			}
			out.Type = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Name"]; ok {
				out.Decs.Name = decs
			}
			if decs, ok := nd["TypeParams"]; ok {
				out.Decs.TypeParams = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.TypeSwitchStmt:
		out := &dst.TypeSwitchStmt{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Switch

		// Node: Init
		if n.Init != nil {
			child, err := f.decorateNode(n, "TypeSwitchStmt", "Init", "Stmt", n.Init)
			if err != nil {
				return nil, err
			}
			out.Init = child.(dst.Stmt)
		}

		// Node: Assign
		if n.Assign != nil {
			child, err := f.decorateNode(n, "TypeSwitchStmt", "Assign", "Stmt", n.Assign)
			if err != nil {
				return nil, err
			}
			out.Assign = child.(dst.Stmt)
		}

		// Node: Body
		if n.Body != nil {
			child, err := f.decorateNode(n, "TypeSwitchStmt", "Body", "BlockStmt", n.Body)
			if err != nil {
				return nil, err
			}
			out.Body = child.(*dst.BlockStmt)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Switch"]; ok {
				out.Decs.Switch = decs
			}
			if decs, ok := nd["Init"]; ok {
				out.Decs.Init = decs
			}
			if decs, ok := nd["Assign"]; ok {
				out.Decs.Assign = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.UnaryExpr:
		out := &dst.UnaryExpr{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// Token: Op
		out.Op = n.Op

		// Node: X
		if n.X != nil {
			child, err := f.decorateNode(n, "UnaryExpr", "X", "Expr", n.X)
			if err != nil {
				return nil, err
			}
			out.X = child.(dst.Expr)
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Op"]; ok {
				out.Decs.Op = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	case *ast.ValueSpec:
		out := &dst.ValueSpec{}
		f.Dst.Nodes[n] = out
		f.Ast.Nodes[out] = n

		out.Decs.Before = f.before[n]
		out.Decs.After = f.after[n]

		// List: Names
		for _, v := range n.Names {
			child, err := f.decorateNode(n, "ValueSpec", "Names", "Ident", v)
			if err != nil {
				return nil, err
			}
			out.Names = append(out.Names, child.(*dst.Ident))
		}

		// Node: Type
		if n.Type != nil {
			child, err := f.decorateNode(n, "ValueSpec", "Type", "Expr", n.Type)
			if err != nil {
				return nil, err
			}
			out.Type = child.(dst.Expr)
		}

		// Token: Assign

		// List: Values
		for _, v := range n.Values {
			child, err := f.decorateNode(n, "ValueSpec", "Values", "Expr", v)
			if err != nil {
				return nil, err
			}
			out.Values = append(out.Values, child.(dst.Expr))
		}

		if nd, ok := f.decorations[n]; ok {
			if decs, ok := nd["Start"]; ok {
				out.Decs.Start = decs
			}
			if decs, ok := nd["Assign"]; ok {
				out.Decs.Assign = decs
			}
			if decs, ok := nd["End"]; ok {
				out.Decs.End = decs
			}
		}

		return out, nil
	}
	return nil, nil
}
