package csvq

import (
	"context"
	"database/sql/driver"
	"strconv"
	"sync/atomic"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/query"
	"github.com/mithrandie/csvq/lib/value"
)

const statementPrefix = "autogen_prepared_"

var counter uint64

func GenerateStatementName() string {
	atomic.AddUint64(&counter, 1)
	return statementPrefix + strconv.FormatUint(counter, 32)
}

type Stmt struct {
	proc     *query.Processor
	name     parser.Identifier
	numInput int
}

func NewStmt(ctx context.Context, proc *query.Processor, queryString string) (driver.Stmt, error) {
	name := parser.Identifier{Literal: GenerateStatementName()}

	statements := []parser.Statement{
		parser.StatementPreparation{
			Name:      name,
			Statement: value.NewString(queryString),
		},
	}

	if _, err := proc.Execute(ctx, statements); err != nil {
		return nil, err
	}

	stmt, err := proc.Tx.PreparedStatements.Get(name)
	if err != nil {
		return nil, err
	}

	return &Stmt{
		proc:     proc,
		name:     name,
		numInput: stmt.HolderNumber,
	}, nil
}

func (stmt *Stmt) Close() error {
	statements := []parser.Statement{
		parser.DisposeStatement{
			Name: stmt.name,
		},
	}
	_, err := stmt.proc.Execute(context.Background(), statements)
	return err
}

func (stmt *Stmt) NumInput() int {
	return stmt.numInput
}

func (stmt *Stmt) Exec(args []driver.Value) (driver.Result, error) {
	return stmt.ExecContext(context.Background(), stmt.valuesToNamedValues(args))
}

func (stmt *Stmt) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	if err := stmt.exec(ctx, args); err != nil {
		return nil, err
	}
	return NewResult(int64(stmt.proc.Tx.AffectedRows)), nil
}

func (stmt *Stmt) Query(args []driver.Value) (driver.Rows, error) {
	return stmt.QueryContext(context.Background(), stmt.valuesToNamedValues(args))
}

func (stmt *Stmt) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	if err := stmt.exec(ctx, args); err != nil {
		return nil, err
	}
	return NewRows(stmt.proc.Tx.SelectedViews), nil
}

func (stmt *Stmt) valuesToNamedValues(values []driver.Value) []driver.NamedValue {
	nvs := make([]driver.NamedValue, 0, len(values))
	for i := range values {
		nvs = append(nvs, driver.NamedValue{Ordinal: i + 1, Value: values[i]})
	}
	return nvs
}

func (stmt *Stmt) exec(ctx context.Context, args []driver.NamedValue) error {
	values := make([]parser.ReplaceValue, 0, len(args))
	for i := range args {
		v, _ := stmt.ColumnConverter(i).ConvertValue(args[i].Value)
		values = append(values, parser.ReplaceValue{
			Value: v.(Value).PrimitiveType(),
			Name:  parser.Identifier{Literal: args[i].Name},
		})
	}

	statements := []parser.Statement{
		parser.ExecuteStatement{
			Name:   stmt.name,
			Values: values,
		},
	}

	_, err := stmt.proc.Execute(query.ContextForStoringResults(ctx), statements)
	return err
}

func (stmt *Stmt) ColumnConverter(_ int) driver.ValueConverter {
	return ValueConverter{}
}

func (stmt *Stmt) CheckNamedValue(nv *driver.NamedValue) error {
	index := nv.Ordinal - 1
	if _, err := stmt.ColumnConverter(index).ConvertValue(nv.Value); err != nil {
		return err
	}
	return nil
}
