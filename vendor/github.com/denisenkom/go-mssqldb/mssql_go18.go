// +build go1.8

package mssql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"strings"
)

var _ driver.Pinger = &Conn{}

// Ping is used to check if the remote server is available and satisfies the Pinger interface.
func (c *Conn) Ping(ctx context.Context) error {
	if !c.connectionGood {
		return driver.ErrBadConn
	}
	stmt := &Stmt{c, `select 1;`, 0, nil}
	_, err := stmt.ExecContext(ctx, nil)
	return err
}

var _ driver.ConnBeginTx = &Conn{}

// BeginTx satisfies ConnBeginTx.
func (c *Conn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	if !c.connectionGood {
		return nil, driver.ErrBadConn
	}
	if opts.ReadOnly {
		return nil, errors.New("Read-only transactions are not supported")
	}

	var tdsIsolation isoLevel
	switch sql.IsolationLevel(opts.Isolation) {
	case sql.LevelDefault:
		tdsIsolation = isolationUseCurrent
	case sql.LevelReadUncommitted:
		tdsIsolation = isolationReadUncommited
	case sql.LevelReadCommitted:
		tdsIsolation = isolationReadCommited
	case sql.LevelWriteCommitted:
		return nil, errors.New("LevelWriteCommitted isolation level is not supported")
	case sql.LevelRepeatableRead:
		tdsIsolation = isolationRepeatableRead
	case sql.LevelSnapshot:
		tdsIsolation = isolationSnapshot
	case sql.LevelSerializable:
		tdsIsolation = isolationSerializable
	case sql.LevelLinearizable:
		return nil, errors.New("LevelLinearizable isolation level is not supported")
	default:
		return nil, errors.New("Isolation level is not supported or unknown")
	}
	return c.begin(ctx, tdsIsolation)
}

func (c *Conn) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
	if !c.connectionGood {
		return nil, driver.ErrBadConn
	}
	if len(query) > 10 && strings.EqualFold(query[:10], "INSERTBULK") {
		return c.prepareCopyIn(ctx, query)
	}

	return c.prepareContext(ctx, query)
}

func (s *Stmt) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	if !s.c.connectionGood {
		return nil, driver.ErrBadConn
	}
	list := make([]namedValue, len(args))
	for i, nv := range args {
		list[i] = namedValue(nv)
	}
	return s.queryContext(ctx, list)
}

func (s *Stmt) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	if !s.c.connectionGood {
		return nil, driver.ErrBadConn
	}
	list := make([]namedValue, len(args))
	for i, nv := range args {
		list[i] = namedValue(nv)
	}
	return s.exec(ctx, list)
}
