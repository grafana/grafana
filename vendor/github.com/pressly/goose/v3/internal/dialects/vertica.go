package dialects

import (
	"fmt"

	"github.com/pressly/goose/v3/database/dialect"
)

// NewVertica returns a new [dialect.Querier] for Vertica dialect.
//
// DEPRECATED: Vertica support is deprecated and will be removed in a future release.
func NewVertica() dialect.Querier {
	return &vertica{}
}

type vertica struct{}

var _ dialect.Querier = (*vertica)(nil)

func (v *vertica) CreateTable(tableName string) string {
	q := `CREATE TABLE %s (
		id identity(1,1) NOT NULL,
		version_id bigint NOT NULL,
		is_applied boolean NOT NULL,
		tstamp timestamp NULL default now(),
		PRIMARY KEY(id)
	)`
	return fmt.Sprintf(q, tableName)
}

func (v *vertica) InsertVersion(tableName string) string {
	q := `INSERT INTO %s (version_id, is_applied) VALUES (?, ?)`
	return fmt.Sprintf(q, tableName)
}

func (v *vertica) DeleteVersion(tableName string) string {
	q := `DELETE FROM %s WHERE version_id=?`
	return fmt.Sprintf(q, tableName)
}

func (v *vertica) GetMigrationByVersion(tableName string) string {
	q := `SELECT tstamp, is_applied FROM %s WHERE version_id=? ORDER BY tstamp DESC LIMIT 1`
	return fmt.Sprintf(q, tableName)
}

func (v *vertica) ListMigrations(tableName string) string {
	q := `SELECT version_id, is_applied from %s ORDER BY id DESC`
	return fmt.Sprintf(q, tableName)
}

func (v *vertica) GetLatestVersion(tableName string) string {
	q := `SELECT MAX(version_id) FROM %s`
	return fmt.Sprintf(q, tableName)
}
