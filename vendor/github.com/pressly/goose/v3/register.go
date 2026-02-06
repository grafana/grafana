package goose

import (
	"context"
	"database/sql"
	"fmt"
	"runtime"
)

// GoMigrationContext is a Go migration func that is run within a transaction and receives a
// context.
type GoMigrationContext func(ctx context.Context, tx *sql.Tx) error

// AddMigrationContext adds Go migrations.
func AddMigrationContext(up, down GoMigrationContext) {
	_, filename, _, _ := runtime.Caller(1)
	AddNamedMigrationContext(filename, up, down)
}

// AddNamedMigrationContext adds named Go migrations.
func AddNamedMigrationContext(filename string, up, down GoMigrationContext) {
	if err := register(
		filename,
		true,
		&GoFunc{RunTx: up, Mode: TransactionEnabled},
		&GoFunc{RunTx: down, Mode: TransactionEnabled},
	); err != nil {
		panic(err)
	}
}

// GoMigrationNoTxContext is a Go migration func that is run outside a transaction and receives a
// context.
type GoMigrationNoTxContext func(ctx context.Context, db *sql.DB) error

// AddMigrationNoTxContext adds Go migrations that will be run outside transaction.
func AddMigrationNoTxContext(up, down GoMigrationNoTxContext) {
	_, filename, _, _ := runtime.Caller(1)
	AddNamedMigrationNoTxContext(filename, up, down)
}

// AddNamedMigrationNoTxContext adds named Go migrations that will be run outside transaction.
func AddNamedMigrationNoTxContext(filename string, up, down GoMigrationNoTxContext) {
	if err := register(
		filename,
		false,
		&GoFunc{RunDB: up, Mode: TransactionDisabled},
		&GoFunc{RunDB: down, Mode: TransactionDisabled},
	); err != nil {
		panic(err)
	}
}

func register(filename string, useTx bool, up, down *GoFunc) error {
	v, _ := NumericComponent(filename)
	if existing, ok := registeredGoMigrations[v]; ok {
		return fmt.Errorf("failed to add migration %q: version %d conflicts with %q",
			filename,
			v,
			existing.Source,
		)
	}
	// Add to global as a registered migration.
	m := NewGoMigration(v, up, down)
	m.Source = filename
	// We explicitly set transaction to maintain existing behavior. Both up and down may be nil, but
	// we know based on the register function what the user is requesting.
	m.UseTx = useTx
	registeredGoMigrations[v] = m
	return nil
}

// withContext changes the signature of a function that receives one argument to receive a context
// and the argument.
func withContext[T any](fn func(T) error) func(context.Context, T) error {
	if fn == nil {
		return nil
	}
	return func(ctx context.Context, t T) error {
		return fn(t)
	}
}

// withoutContext changes the signature of a function that receives a context and one argument to
// receive only the argument. When called the passed context is always context.Background().
func withoutContext[T any](fn func(context.Context, T) error) func(T) error {
	if fn == nil {
		return nil
	}
	return func(t T) error {
		return fn(context.Background(), t)
	}
}

// GoMigration is a Go migration func that is run within a transaction.
//
// Deprecated: Use GoMigrationContext.
type GoMigration func(tx *sql.Tx) error

// GoMigrationNoTx is a Go migration func that is run outside a transaction.
//
// Deprecated: Use GoMigrationNoTxContext.
type GoMigrationNoTx func(db *sql.DB) error

// AddMigration adds Go migrations.
//
// Deprecated: Use AddMigrationContext.
func AddMigration(up, down GoMigration) {
	_, filename, _, _ := runtime.Caller(1)
	AddNamedMigrationContext(filename, withContext(up), withContext(down))
}

// AddNamedMigration adds named Go migrations.
//
// Deprecated: Use AddNamedMigrationContext.
func AddNamedMigration(filename string, up, down GoMigration) {
	AddNamedMigrationContext(filename, withContext(up), withContext(down))
}

// AddMigrationNoTx adds Go migrations that will be run outside transaction.
//
// Deprecated: Use AddMigrationNoTxContext.
func AddMigrationNoTx(up, down GoMigrationNoTx) {
	_, filename, _, _ := runtime.Caller(1)
	AddNamedMigrationNoTxContext(filename, withContext(up), withContext(down))
}

// AddNamedMigrationNoTx adds named Go migrations that will be run outside transaction.
//
// Deprecated: Use AddNamedMigrationNoTxContext.
func AddNamedMigrationNoTx(filename string, up, down GoMigrationNoTx) {
	AddNamedMigrationNoTxContext(filename, withContext(up), withContext(down))
}
