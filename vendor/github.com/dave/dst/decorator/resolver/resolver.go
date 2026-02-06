package resolver

import (
	"errors"
	"go/ast"
)

// RestorerResolver resolves a package path to a package name.
type RestorerResolver interface {
	ResolvePackage(path string) (string, error)
}

// DecoratorResolver resolves an identifier to a local or remote reference.
//
// Returns path == "" if the node is not a local or remote reference (e.g. a field in a composite
// literal, the selector in a selector expression etc.).
//
// Returns path == "" is the node is a local reference.
//
// Returns path != "" is the node is a remote reference.
type DecoratorResolver interface {
	ResolveIdent(file *ast.File, parent ast.Node, parentField string, id *ast.Ident) (path string, err error)
}

// ErrPackageNotFound means the package is not found
var ErrPackageNotFound = errors.New("package not found")
