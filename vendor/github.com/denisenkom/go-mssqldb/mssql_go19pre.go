// +build !go1.9

package mssql

import (
	"database/sql/driver"
	"fmt"
)

func (s *Stmt) makeParamExtra(val driver.Value) (Param, error) {
	return Param{}, fmt.Errorf("mssql: unknown type for %T", val)
}
