// +build go1.8,!go1.9

package sqlmock

import "database/sql/driver"

// CheckNamedValue meets https://golang.org/pkg/database/sql/driver/#NamedValueChecker
func (c *sqlmock) CheckNamedValue(nv *driver.NamedValue) (err error) {
	nv.Value, err = c.converter.ConvertValue(nv.Value)
	return err
}
