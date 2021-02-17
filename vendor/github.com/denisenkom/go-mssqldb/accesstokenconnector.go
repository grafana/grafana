// +build go1.10

package mssql

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
)

var _ driver.Connector = &accessTokenConnector{}

// accessTokenConnector wraps Connector and injects a
// fresh access token when connecting to the database
type accessTokenConnector struct {
	Connector

	accessTokenProvider func() (string, error)
}

// NewAccessTokenConnector creates a new connector from a DSN and a token provider.
// The token provider func will be called when a new connection is requested and should return a valid access token.
// The returned connector may be used with sql.OpenDB.
func NewAccessTokenConnector(dsn string, tokenProvider func() (string, error)) (driver.Connector, error) {
	if tokenProvider == nil {
		return nil, errors.New("mssql: tokenProvider cannot be nil")
	}

	conn, err := NewConnector(dsn)
	if err != nil {
		return nil, err
	}

	c := &accessTokenConnector{
		Connector:           *conn,
		accessTokenProvider: tokenProvider,
	}
	return c, nil
}

// Connect returns a new database connection
func (c *accessTokenConnector) Connect(ctx context.Context) (driver.Conn, error) {
	var err error
	c.Connector.params.fedAuthAccessToken, err = c.accessTokenProvider()
	if err != nil {
		return nil, fmt.Errorf("mssql: error retrieving access token: %+v", err)
	}

	return c.Connector.Connect(ctx)
}
