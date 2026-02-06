package ts

import (
	"github.com/grafana/cuetsy/ts/ast"
)

type (
	File = ast.File
	Node = ast.Node
	Decl = ast.Decl
	Expr = ast.Expr
)

func Ident(name string) ast.Ident {
	return ast.Ident{Name: name}
}

func Names(names ...string) ast.Names {
	idents := make(ast.Idents, len(names))
	for i, n := range names {
		idents[i] = Ident(n)
	}

	return ast.Names{
		Idents: idents,
	}
}

func Union(elems ...Expr) Expr {
	switch len(elems) {
	case 0:
		return nil
	case 1:
		return elems[0]
	}

	var U Expr = elems[0]
	for _, e := range elems[1:] {
		U = ast.BinaryExpr{
			Op: "|",
			X:  U,
			Y:  e,
		}
	}

	return ast.ParenExpr{Expr: U}
}

func Object(fields map[string]Expr) Expr {
	elems := make([]ast.KeyValueExpr, 0, len(fields))
	for k, v := range fields {
		elems = append(elems, ast.KeyValueExpr{
			Key:   Ident(k),
			Value: v,
		})
	}
	return ast.ObjectLit{Elems: elems}
}

func List(elems ...Expr) Expr {
	return ast.ListLit{Elems: elems}
}

func Null() Expr {
	return Ident("null")
}

func Str(s string) Expr {
	return ast.Str{Value: s}
}

// TODO: replace with generic num?
func Int(i int64) Expr {
	return ast.Num{N: i}
}
func Float(f float64) Expr {
	return ast.Num{N: f}
}

func Bool(b bool) Expr {
	if b {
		return Ident("true")
	}
	return Ident("false")
}
