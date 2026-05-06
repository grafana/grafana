// +build go1.18

package mssql

// newRetryableError returns an error that allows the database/sql package
// to automatically retry the failed query. Versions of Go 1.18 and higher
// use errors.Is to determine whether or not a failed query can be retried.
// Therefore, we wrap the underlying error in a RetryableError that both
// implements errors.Is for automatic retry and maintains the error details.
func newRetryableError(err error) error {
	return RetryableError{
		err: err,
	}
}
