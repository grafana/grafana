package dialects

import (
	"fmt"

	"github.com/pressly/goose/v3/database/dialect"
)

// NewTidb returns a [dialect.Querier] for TiDB dialect.
func NewTidb() dialect.Querier {
	return &Tidb{}
}

type Tidb struct{}

var _ dialect.Querier = (*Tidb)(nil)

func (t *Tidb) CreateTable(tableName string) string {
	q := `CREATE TABLE %s (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
		version_id bigint NOT NULL,
		is_applied boolean NOT NULL,
		tstamp timestamp NULL default now(),
		PRIMARY KEY(id)
	)`
	return fmt.Sprintf(q, tableName)
}

func (t *Tidb) InsertVersion(tableName string) string {
	q := `INSERT INTO %s (version_id, is_applied) VALUES (?, ?)`
	return fmt.Sprintf(q, tableName)
}

func (t *Tidb) DeleteVersion(tableName string) string {
	q := `DELETE FROM %s WHERE version_id=?`
	return fmt.Sprintf(q, tableName)
}

func (t *Tidb) GetMigrationByVersion(tableName string) string {
	q := `SELECT tstamp, is_applied FROM %s WHERE version_id=? ORDER BY tstamp DESC LIMIT 1`
	return fmt.Sprintf(q, tableName)
}

func (t *Tidb) ListMigrations(tableName string) string {
	q := `SELECT version_id, is_applied from %s ORDER BY id DESC`
	return fmt.Sprintf(q, tableName)
}

func (t *Tidb) GetLatestVersion(tableName string) string {
	q := `SELECT MAX(version_id) FROM %s`
	return fmt.Sprintf(q, tableName)
}
