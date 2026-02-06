// +build !go1.8

package squirrel

import (
	"database/sql"
)

// NewStmtCacher returns a DBProxy wrapping prep that caches Prepared Stmts.
//
// Stmts are cached based on the string value of their queries.
func NewStmtCache(prep Preparer) *StmtCache {
	return &StmtCacher{prep: prep, cache: make(map[string]*sql.Stmt)}
}

// NewStmtCacher is deprecated
//
// Use NewStmtCache instead
func NewStmtCacher(prep Preparer) DBProxy {
	return NewStmtCache(prep)
}
