package dialects

import (
	"fmt"

	"github.com/pressly/goose/v3/database/dialect"
)

// NewYDB returns a new [dialect.Querier] for Vertica dialect.
func NewYDB() dialect.Querier {
	return &ydb{}
}

type ydb struct{}

var _ dialect.Querier = (*ydb)(nil)

func (c *ydb) CreateTable(tableName string) string {
	q := `CREATE TABLE %s (
		version_id Uint64,
		is_applied Bool,
		tstamp Timestamp,

		PRIMARY KEY(version_id)
	)`
	return fmt.Sprintf(q, tableName)
}

func (c *ydb) InsertVersion(tableName string) string {
	q := `INSERT INTO %s (
		version_id, 
		is_applied, 
		tstamp
	) VALUES (
		CAST($1 AS Uint64), 
		$2, 
		CurrentUtcTimestamp()
	)`
	return fmt.Sprintf(q, tableName)
}

func (c *ydb) DeleteVersion(tableName string) string {
	q := `DELETE FROM %s WHERE version_id = $1`
	return fmt.Sprintf(q, tableName)
}

func (c *ydb) GetMigrationByVersion(tableName string) string {
	q := `SELECT tstamp, is_applied FROM %s WHERE version_id = $1 ORDER BY tstamp DESC LIMIT 1`
	return fmt.Sprintf(q, tableName)
}

func (c *ydb) ListMigrations(tableName string) string {
	q := `
	SELECT version_id, is_applied, tstamp AS __discard_column_tstamp 
	FROM %s ORDER BY __discard_column_tstamp DESC`
	return fmt.Sprintf(q, tableName)
}

func (c *ydb) GetLatestVersion(tableName string) string {
	q := `SELECT MAX(version_id) FROM %s`
	return fmt.Sprintf(q, tableName)
}
