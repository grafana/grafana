package goose

import (
	"database/sql"
	"fmt"
)

// OpenDBWithDriver creates a connection to a database, and modifies goose internals to be
// compatible with the supplied driver by calling SetDialect.
func OpenDBWithDriver(driver string, dbstring string) (*sql.DB, error) {
	if err := SetDialect(driver); err != nil {
		return nil, err
	}

	// The Go ecosystem has added more and more drivers over the years. As a result, there's no
	// longer a one-to-one match between the driver name and the dialect name. For instance, there's
	// no "redshift" driver, but that's the internal dialect name within goose. Hence, we need to
	// convert the dialect name to a supported driver name. This conversion is a best-effort
	// attempt, as we can't support both lib/pq and pgx, which some users might have.
	//
	// We recommend users to create a [NewProvider] with the desired dialect, open a connection
	// using their preferred driver, and provide the *sql.DB to goose. This approach removes the
	// need for mapping dialects to drivers, rendering this function unnecessary.

	switch driver {
	case "mssql":
		driver = "sqlserver"
	case "tidb":
		driver = "mysql"
	case "turso":
		driver = "libsql"
	case "sqlite3":
		driver = "sqlite"
	case "postgres", "redshift":
		driver = "pgx"
	case "starrocks":
		driver = "mysql"
	}

	switch driver {
	case "postgres", "pgx", "sqlite3", "sqlite", "mysql", "sqlserver", "clickhouse", "vertica", "azuresql", "ydb", "libsql", "starrocks":
		return sql.Open(driver, dbstring)
	default:
		return nil, fmt.Errorf("unsupported driver %s", driver)
	}
}
