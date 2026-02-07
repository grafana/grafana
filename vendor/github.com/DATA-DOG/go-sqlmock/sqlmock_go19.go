// +build go1.9

package sqlmock

import (
	"database/sql"
	"database/sql/driver"
)

// CheckNamedValue meets https://golang.org/pkg/database/sql/driver/#NamedValueChecker
func (c *sqlmock) CheckNamedValue(nv *driver.NamedValue) (err error) {
	switch nv.Value.(type) {
	case sql.Out:
		return nil
	default:
		nv.Value, err = c.converter.ConvertValue(nv.Value)
		return err
	}
}
