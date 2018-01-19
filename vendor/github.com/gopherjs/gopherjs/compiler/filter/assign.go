package filter

import (
	"go/ast"
	"go/token"
	"go/types"

	"github.com/gopherjs/gopherjs/compiler/astutil"
)

func Assign(stmt ast.Stmt, info *types.Info, pkg *types.Package) ast.Stmt {
	if s, ok := stmt.(*ast.AssignStmt); ok && s.Tok != token.ASSIGN && s.Tok != token.DEFINE {
		var op token.Token
		switch s.Tok {
		case token.ADD_ASSIGN:
			op = token.ADD
		case token.SUB_ASSIGN:
			op = token.SUB
		case token.MUL_ASSIGN:
			op = token.MUL
		case token.QUO_ASSIGN:
			op = token.QUO
		case token.REM_ASSIGN:
			op = token.REM
		case token.AND_ASSIGN:
			op = token.AND
		case token.OR_ASSIGN:
			op = token.OR
		case token.XOR_ASSIGN:
			op = token.XOR
		case token.SHL_ASSIGN:
			op = token.SHL
		case token.SHR_ASSIGN:
			op = token.SHR
		case token.AND_NOT_ASSIGN:
			op = token.AND_NOT
		default:
			panic(s.Tok)
		}

		var list []ast.Stmt

		var viaTmpVars func(expr ast.Expr, name string) ast.Expr
		viaTmpVars = func(expr ast.Expr, name string) ast.Expr {
			switch e := astutil.RemoveParens(expr).(type) {
			case *ast.IndexExpr:
				return astutil.SetType(info, info.TypeOf(e), &ast.IndexExpr{
					X:     viaTmpVars(e.X, "_slice"),
					Index: viaTmpVars(e.Index, "_index"),
				})

			case *ast.SelectorExpr:
				sel, ok := info.Selections[e]
				if !ok {
					// qualified identifier
					return e
				}
				newSel := &ast.SelectorExpr{
					X:   viaTmpVars(e.X, "_struct"),
					Sel: e.Sel,
				}
				info.Selections[newSel] = sel
				return astutil.SetType(info, info.TypeOf(e), newSel)

			case *ast.StarExpr:
				return astutil.SetType(info, info.TypeOf(e), &ast.StarExpr{
					X: viaTmpVars(e.X, "_ptr"),
				})

			case *ast.Ident, *ast.BasicLit:
				return e

			default:
				tmpVar := astutil.NewIdent(name, info.TypeOf(e), info, pkg)
				list = append(list, &ast.AssignStmt{
					Lhs: []ast.Expr{tmpVar},
					Tok: token.DEFINE,
					Rhs: []ast.Expr{e},
				})
				return tmpVar

			}
		}

		lhs := viaTmpVars(s.Lhs[0], "_val")

		list = append(list, &ast.AssignStmt{
			Lhs: []ast.Expr{lhs},
			Tok: token.ASSIGN,
			Rhs: []ast.Expr{
				astutil.SetType(info, info.TypeOf(s.Lhs[0]), &ast.BinaryExpr{
					X:  lhs,
					Op: op,
					Y: astutil.SetType(info, info.TypeOf(s.Rhs[0]), &ast.ParenExpr{
						X: s.Rhs[0],
					}),
				}),
			},
		})

		return &ast.BlockStmt{
			List: list,
		}
	}
	return stmt
}
