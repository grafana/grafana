// +build go1.8

package sqlmock

import (
	"context"
	"database/sql/driver"
)

// Deprecated: Drivers should implement ExecerContext instead.
func (stmt *statement) Exec(args []driver.Value) (driver.Result, error) {
	return stmt.conn.ExecContext(context.Background(), stmt.query, convertValueToNamedValue(args))
}

// Deprecated: Drivers should implement StmtQueryContext instead (or additionally).
func (stmt *statement) Query(args []driver.Value) (driver.Rows, error) {
	return stmt.conn.QueryContext(context.Background(), stmt.query, convertValueToNamedValue(args))
}

func convertValueToNamedValue(args []driver.Value) []driver.NamedValue {
	namedArgs := make([]driver.NamedValue, len(args))
	for i, v := range args {
		namedArgs[i] = driver.NamedValue{Ordinal: i + 1, Value: v}
	}
	return namedArgs
}
