// +build !go1.8

package sqlmock

import (
	"database/sql/driver"
)

// Deprecated: Drivers should implement ExecerContext instead.
func (stmt *statement) Exec(args []driver.Value) (driver.Result, error) {
	return stmt.conn.Exec(stmt.query, args)
}

// Deprecated: Drivers should implement StmtQueryContext instead (or additionally).
func (stmt *statement) Query(args []driver.Value) (driver.Rows, error) {
	return stmt.conn.Query(stmt.query, args)
}
