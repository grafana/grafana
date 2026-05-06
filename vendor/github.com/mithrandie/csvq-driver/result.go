package csvq

import (
	"errors"
)

type Result struct {
	rowsAffected int64
}

func NewResult(rowsAffected int64) *Result {
	return &Result{
		rowsAffected: rowsAffected,
	}
}

func (r Result) LastInsertId() (int64, error) {
	return 0, errors.New("csvq does not support LastInsertId()")
}

func (r Result) RowsAffected() (int64, error) {
	return r.rowsAffected, nil
}
