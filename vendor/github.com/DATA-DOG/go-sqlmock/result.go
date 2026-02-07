package sqlmock

import (
	"database/sql/driver"
)

// Result satisfies sql driver Result, which
// holds last insert id and rows affected
// by Exec queries
type result struct {
	insertID     int64
	rowsAffected int64
	err          error
}

// NewResult creates a new sql driver Result
// for Exec based query mocks.
func NewResult(lastInsertID int64, rowsAffected int64) driver.Result {
	return &result{
		insertID:     lastInsertID,
		rowsAffected: rowsAffected,
	}
}

// NewErrorResult creates a new sql driver Result
// which returns an error given for both interface methods
func NewErrorResult(err error) driver.Result {
	return &result{
		err: err,
	}
}

func (r *result) LastInsertId() (int64, error) {
	return r.insertID, r.err
}

func (r *result) RowsAffected() (int64, error) {
	return r.rowsAffected, r.err
}
