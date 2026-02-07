package goose

import (
	"context"
	"database/sql"
	"fmt"
)

// Version prints the current version of the database.
func Version(db *sql.DB, dir string, opts ...OptionsFunc) error {
	ctx := context.Background()
	return VersionContext(ctx, db, dir, opts...)
}

// VersionContext prints the current version of the database.
func VersionContext(ctx context.Context, db *sql.DB, dir string, opts ...OptionsFunc) error {
	option := &options{}
	for _, f := range opts {
		f(option)
	}
	if option.noVersioning {
		var current int64
		migrations, err := CollectMigrations(dir, minVersion, maxVersion)
		if err != nil {
			return fmt.Errorf("failed to collect migrations: %w", err)
		}
		if len(migrations) > 0 {
			current = migrations[len(migrations)-1].Version
		}
		log.Printf("goose: file version %v", current)
		return nil
	}

	current, err := GetDBVersionContext(ctx, db)
	if err != nil {
		return err
	}
	log.Printf("goose: version %v", current)
	return nil
}

var tableName = "goose_db_version"

// TableName returns goose db version table name
func TableName() string {
	return tableName
}

// SetTableName set goose db version table name
func SetTableName(n string) {
	tableName = n
}
