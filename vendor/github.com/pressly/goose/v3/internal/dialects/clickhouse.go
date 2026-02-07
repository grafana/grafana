package dialects

import (
	"fmt"

	"github.com/pressly/goose/v3/database/dialect"
)

// NewClickhouse returns a new [dialect.Querier] for Clickhouse dialect.
func NewClickhouse() dialect.Querier {
	return &clickhouse{}
}

type clickhouse struct{}

var _ dialect.Querier = (*clickhouse)(nil)

func (c *clickhouse) CreateTable(tableName string) string {
	q := `CREATE TABLE IF NOT EXISTS %s (
		version_id Int64,
		is_applied UInt8,
		date Date default now(),
		tstamp DateTime default now()
	  )
	  ENGINE = MergeTree()
		ORDER BY (date)`
	return fmt.Sprintf(q, tableName)
}

func (c *clickhouse) InsertVersion(tableName string) string {
	q := `INSERT INTO %s (version_id, is_applied) VALUES ($1, $2)`
	return fmt.Sprintf(q, tableName)
}

func (c *clickhouse) DeleteVersion(tableName string) string {
	q := `ALTER TABLE %s DELETE WHERE version_id = $1 SETTINGS mutations_sync = 2`
	return fmt.Sprintf(q, tableName)
}

func (c *clickhouse) GetMigrationByVersion(tableName string) string {
	q := `SELECT tstamp, is_applied FROM %s WHERE version_id = $1 ORDER BY tstamp DESC LIMIT 1`
	return fmt.Sprintf(q, tableName)
}

func (c *clickhouse) ListMigrations(tableName string) string {
	q := `SELECT version_id, is_applied FROM %s ORDER BY version_id DESC`
	return fmt.Sprintf(q, tableName)
}

func (c *clickhouse) GetLatestVersion(tableName string) string {
	q := `SELECT max(version_id) FROM %s`
	return fmt.Sprintf(q, tableName)
}
