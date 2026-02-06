package dialects

import (
	"fmt"

	"github.com/pressly/goose/v3/database/dialect"
)

// NewAuroraDSQL returns a new [dialect.Querier] for Aurora DSQL dialect.
func NewAuroraDSQL() dialect.QuerierExtender {
	return &dsql{}
}

type dsql struct{}

var _ dialect.QuerierExtender = (*dsql)(nil)

func (d *dsql) CreateTable(tableName string) string {
	q := `CREATE TABLE %s (
		id integer PRIMARY KEY,
		version_id bigint NOT NULL,
		is_applied boolean NOT NULL,
		tstamp timestamp NOT NULL DEFAULT now()
	)`
	return fmt.Sprintf(q, tableName)
}

func (d *dsql) InsertVersion(tableName string) string {
	q := `INSERT INTO %s (id, version_id, is_applied) 
	      VALUES (
	          COALESCE((SELECT MAX(id) FROM %s), 0) + 1,
	          $1, 
	          $2
	      )`
	return fmt.Sprintf(q, tableName, tableName)
}

func (d *dsql) DeleteVersion(tableName string) string {
	q := `DELETE FROM %s WHERE version_id=$1`
	return fmt.Sprintf(q, tableName)
}

func (d *dsql) GetMigrationByVersion(tableName string) string {
	q := `SELECT tstamp, is_applied FROM %s WHERE version_id=$1 ORDER BY tstamp DESC LIMIT 1`
	return fmt.Sprintf(q, tableName)
}

func (d *dsql) ListMigrations(tableName string) string {
	q := `SELECT version_id, is_applied from %s ORDER BY id DESC`
	return fmt.Sprintf(q, tableName)
}

func (d *dsql) GetLatestVersion(tableName string) string {
	q := `SELECT max(version_id) FROM %s`
	return fmt.Sprintf(q, tableName)
}

func (d *dsql) TableExists(tableName string) string {
	schemaName, tableName := parseTableIdentifier(tableName)
	if schemaName != "" {
		q := `SELECT EXISTS ( SELECT 1 FROM pg_tables WHERE schemaname = '%s' AND tablename = '%s' )`
		return fmt.Sprintf(q, schemaName, tableName)
	}
	q := `SELECT EXISTS ( SELECT 1 FROM pg_tables WHERE (current_schema() IS NULL OR schemaname = current_schema()) AND tablename = '%s' )`
	return fmt.Sprintf(q, tableName)
}
