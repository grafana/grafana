package typesutil

import (
	"go/types"
	"strings"
)

func IsJsPackage(pkg *types.Package) bool {
	return pkg != nil && (pkg.Path() == "github.com/gopherjs/gopherjs/js" || strings.HasSuffix(pkg.Path(), "/vendor/github.com/gopherjs/gopherjs/js"))
}

func IsJsObject(t types.Type) bool {
	ptr, isPtr := t.(*types.Pointer)
	if !isPtr {
		return false
	}
	named, isNamed := ptr.Elem().(*types.Named)
	return isNamed && IsJsPackage(named.Obj().Pkg()) && named.Obj().Name() == "Object"
}
