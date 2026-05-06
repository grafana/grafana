// +build !go1.18

package mssql

import (
	"database/sql/driver"
)

// newRetryableError returns an error that allows the database/sql package
// to automatically retry the failed query. Versions of Go lower than 1.18
// compare directly to the sentinel error driver.ErrBadConn to determine
// whether or not a failed query can be retried. Therefore, we replace the
// actual error with driver.ErrBadConn, enabling retry but losing the error
// details.
func newRetryableError(err error) error {
	return driver.ErrBadConn
}
