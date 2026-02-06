// +build go1.10

package mssql

import (
	"context"
	"database/sql/driver"
	"errors"
)

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

	conn.fedAuthRequired = true
	conn.fedAuthLibrary = FedAuthLibrarySecurityToken
	conn.securityTokenProvider = func(ctx context.Context) (string, error) {
		return tokenProvider()
	}

	return conn, nil
}
