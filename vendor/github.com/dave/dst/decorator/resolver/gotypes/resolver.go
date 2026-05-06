package gotypes

import (
	"errors"
	"go/ast"
	"go/types"
)

func New(uses map[*ast.Ident]types.Object) *DecoratorResolver {
	return &DecoratorResolver{Uses: uses}
}

type DecoratorResolver struct {
	Uses map[*ast.Ident]types.Object // Types info - must include Uses
}

func (r *DecoratorResolver) ResolveIdent(file *ast.File, parent ast.Node, parentField string, id *ast.Ident) (string, error) {

	if r.Uses == nil {
		return "", errors.New("gotypes.DecoratorResolver needs Uses in types info")
	}

	if se, ok := parent.(*ast.SelectorExpr); ok && parentField == "Sel" {

		// if the parent is a SelectorExpr and this Ident is in the Sel field, only resolve the path
		// if X is a package identifier

		xid, ok := se.X.(*ast.Ident)
		if !ok {
			// x is not an ident -> not a qualified identifier
			return "", nil
		}
		obj, ok := r.Uses[xid]
		if !ok {
			// not found in uses -> not a qualified identifier
			return "", nil
		}
		pn, ok := obj.(*types.PkgName)
		if !ok {
			// not a pkgname -> not a remote identifier
			return "", nil
		}
		return pn.Imported().Path(), nil
	}

	obj, ok := r.Uses[id]
	if !ok {
		// not found in uses -> not a remote identifier
		return "", nil
	}

	if v, ok := obj.(*types.Var); ok && v.IsField() {
		// field ident (e.g. name of a field in a composite literal) -> doesn't need qualified ident
		return "", nil
	}

	pkg := obj.Pkg()
	if pkg == nil {
		// pre-defined idents in the universe scope - e.g. "byte"
		return "", nil
	}

	return pkg.Path(), nil
}
