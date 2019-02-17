// +build !cgo

package sqlite3

import (
	"database/sql"
	"database/sql/driver"
	"errors"
)

func init() {
	sql.Register("sqlite3", &SQLiteDriverMock{})
}

type SQLiteDriverMock struct{}

var errorMsg = errors.New("Binary was compiled with 'CGO_ENABLED=0', go-sqlite3 requires cgo to work. This is a stub")

func (SQLiteDriverMock) Open(s string) (driver.Conn, error) {
	return nil, errorMsg
}
