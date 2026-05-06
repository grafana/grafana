package goose

import (
	"fmt"

	"github.com/pressly/goose/v3/database"
	"github.com/pressly/goose/v3/internal/legacystore"
)

// Dialect is the type of database dialect. It is an alias for [database.Dialect].
type Dialect = database.Dialect

const (
	DialectCustom     Dialect = database.DialectCustom
	DialectClickHouse Dialect = database.DialectClickHouse
	DialectMSSQL      Dialect = database.DialectMSSQL
	DialectMySQL      Dialect = database.DialectMySQL
	DialectPostgres   Dialect = database.DialectPostgres
	DialectRedshift   Dialect = database.DialectRedshift
	DialectSQLite3    Dialect = database.DialectSQLite3
	DialectStarrocks  Dialect = database.DialectStarrocks
	DialectTiDB       Dialect = database.DialectTiDB
	DialectTurso      Dialect = database.DialectTurso
	DialectYdB        Dialect = database.DialectYdB

	// Dialects only available to the [Provider].
	DialectAuroraDSQL Dialect = database.DialectAuroraDSQL

	// DEPRECATED: Vertica support is deprecated and will be removed in a future release.
	DialectVertica Dialect = database.DialectVertica
)

func init() {
	store, _ = legacystore.NewStore(DialectPostgres)
}

var store legacystore.Store

// SetDialect sets the dialect to use for the goose package.
func SetDialect(s string) error {
	var d Dialect
	switch s {
	case "postgres", "pgx":
		d = DialectPostgres
	case "mysql":
		d = DialectMySQL
	case "sqlite3", "sqlite":
		d = DialectSQLite3
	case "mssql", "azuresql", "sqlserver":
		d = DialectMSSQL
	case "redshift":
		d = DialectRedshift
	case "tidb":
		d = DialectTiDB
	case "clickhouse":
		d = DialectClickHouse
	case "vertica":
		d = DialectVertica
	case "ydb":
		d = DialectYdB
	case "turso":
		d = DialectTurso
	case "starrocks":
		d = DialectStarrocks
	default:
		return fmt.Errorf("%q: unknown dialect", s)
	}
	var err error
	store, err = legacystore.NewStore(d)
	return err
}
