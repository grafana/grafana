// +build go1.8

package squirrel

import (
	"context"
	"database/sql"
)

// PrepareerContext is the interface that wraps the Prepare and PrepareContext methods.
//
// Prepare executes the given query as implemented by database/sql.Prepare.
// PrepareContext executes the given query as implemented by database/sql.PrepareContext.
type PreparerContext interface {
	Preparer
	PrepareContext(ctx context.Context, query string) (*sql.Stmt, error)
}

// DBProxyContext groups the Execer, Queryer, QueryRower and PreparerContext interfaces.
type DBProxyContext interface {
	Execer
	Queryer
	QueryRower
	PreparerContext
}

// NewStmtCache returns a *StmtCache wrapping a PreparerContext that caches Prepared Stmts.
//
// Stmts are cached based on the string value of their queries.
func NewStmtCache(prep PreparerContext) *StmtCache {
	return &StmtCache{prep: prep, cache: make(map[string]*sql.Stmt)}
}

// NewStmtCacher is deprecated
//
// Use NewStmtCache instead
func NewStmtCacher(prep PreparerContext) DBProxyContext {
	return NewStmtCache(prep)
}

// PrepareContext delegates down to the underlying PreparerContext and caches the result
// using the provided query as a key
func (sc *StmtCache) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	ctxPrep, ok := sc.prep.(PreparerContext)
	if !ok {
		return nil, NoContextSupport
	}
	sc.mu.Lock()
	defer sc.mu.Unlock()
	stmt, ok := sc.cache[query]
	if ok {
		return stmt, nil
	}
	stmt, err := ctxPrep.PrepareContext(ctx, query)
	if err == nil {
		sc.cache[query] = stmt
	}
	return stmt, err
}

// ExecContext delegates down to the underlying PreparerContext using a prepared statement
func (sc *StmtCache) ExecContext(ctx context.Context, query string, args ...interface{}) (res sql.Result, err error) {
	stmt, err := sc.PrepareContext(ctx, query)
	if err != nil {
		return
	}
	return stmt.ExecContext(ctx, args...)
}

// QueryContext delegates down to the underlying PreparerContext using a prepared statement
func (sc *StmtCache) QueryContext(ctx context.Context, query string, args ...interface{}) (rows *sql.Rows, err error) {
	stmt, err := sc.PrepareContext(ctx, query)
	if err != nil {
		return
	}
	return stmt.QueryContext(ctx, args...)
}

// QueryRowContext delegates down to the underlying PreparerContext using a prepared statement
func (sc *StmtCache) QueryRowContext(ctx context.Context, query string, args ...interface{}) RowScanner {
	stmt, err := sc.PrepareContext(ctx, query)
	if err != nil {
		return &Row{err: err}
	}
	return stmt.QueryRowContext(ctx, args...)
}
