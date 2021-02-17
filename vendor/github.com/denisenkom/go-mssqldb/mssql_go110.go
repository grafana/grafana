// +build go1.10

package mssql

import (
	"context"
	"database/sql/driver"
	"errors"
)

var _ driver.Connector = &Connector{}
var _ driver.SessionResetter = &Conn{}

func (c *Conn) ResetSession(ctx context.Context) error {
	if !c.connectionGood {
		return driver.ErrBadConn
	}
	c.resetSession = true

	if c.connector == nil || len(c.connector.SessionInitSQL) == 0 {
		return nil
	}

	s, err := c.prepareContext(ctx, c.connector.SessionInitSQL)
	if err != nil {
		return driver.ErrBadConn
	}
	_, err = s.exec(ctx, nil)
	if err != nil {
		return driver.ErrBadConn
	}

	return nil
}

// Connect to the server and return a TDS connection.
func (c *Connector) Connect(ctx context.Context) (driver.Conn, error) {
	conn, err := c.driver.connect(ctx, c, c.params)
	if err == nil {
		err = conn.ResetSession(ctx)
	}
	return conn, err
}

// Driver underlying the Connector.
func (c *Connector) Driver() driver.Driver {
	return c.driver
}

func (r *Result) LastInsertId() (int64, error) {
	return -1, errors.New("LastInsertId is not supported. Please use the OUTPUT clause or add `select ID = convert(bigint, SCOPE_IDENTITY())` to the end of your query.")
}
