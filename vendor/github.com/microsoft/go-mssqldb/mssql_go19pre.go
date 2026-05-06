// +build !go1.9

package mssql

import (
	"database/sql/driver"
	"fmt"
)

func (s *Stmt) makeParamExtra(val driver.Value) (param, error) {
	return param{}, fmt.Errorf("mssql: unknown type for %T", val)
}

func scanIntoOut(name string, fromServer, scanInto interface{}) error {
	return fmt.Errorf("mssql: unsupported OUTPUT type, use a newer Go version")
}

func isOutputValue(val driver.Value) bool {
	return false
}
