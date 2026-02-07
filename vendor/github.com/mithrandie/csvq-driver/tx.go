package csvq

import (
	"context"
	"database/sql/driver"

	"github.com/mithrandie/csvq/lib/parser"

	"github.com/mithrandie/csvq/lib/query"
)

type Tx struct {
	proc *query.Processor
}

func NewTx(proc *query.Processor) (driver.Tx, error) {
	proc.Tx.AutoCommit = false

	return &Tx{
		proc: proc,
	}, nil
}

func (tx Tx) Commit() error {
	expr := parser.TransactionControl{Token: parser.COMMIT}
	err := tx.proc.Commit(context.Background(), expr)
	if err == nil {
		tx.proc.Tx.AutoCommit = true
	}
	return err
}

func (tx Tx) Rollback() error {
	expr := parser.TransactionControl{Token: parser.ROLLBACK}
	err := tx.proc.Rollback(expr)
	if err == nil {
		tx.proc.Tx.AutoCommit = true
	}
	return err
}
