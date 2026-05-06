package goose

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
)

// Reset rolls back all migrations
func Reset(db *sql.DB, dir string, opts ...OptionsFunc) error {
	ctx := context.Background()
	return ResetContext(ctx, db, dir, opts...)
}

// ResetContext rolls back all migrations
func ResetContext(ctx context.Context, db *sql.DB, dir string, opts ...OptionsFunc) error {
	option := &options{}
	for _, f := range opts {
		f(option)
	}
	migrations, err := CollectMigrations(dir, minVersion, maxVersion)
	if err != nil {
		return fmt.Errorf("failed to collect migrations: %w", err)
	}
	if option.noVersioning {
		return DownToContext(ctx, db, dir, minVersion, opts...)
	}

	statuses, err := dbMigrationsStatus(ctx, db)
	if err != nil {
		return fmt.Errorf("failed to get status of migrations: %w", err)
	}
	sort.Sort(sort.Reverse(migrations))

	for _, migration := range migrations {
		if !statuses[migration.Version] {
			continue
		}
		if err = migration.DownContext(ctx, db); err != nil {
			return fmt.Errorf("failed to db-down: %w", err)
		}
	}

	return nil
}

func dbMigrationsStatus(ctx context.Context, db *sql.DB) (map[int64]bool, error) {
	dbMigrations, err := store.ListMigrations(ctx, db, TableName())
	if err != nil {
		return nil, err
	}
	// The most recent record for each migration specifies
	// whether it has been applied or rolled back.
	results := make(map[int64]bool)

	for _, m := range dbMigrations {
		if _, ok := results[m.VersionID]; ok {
			continue
		}
		results[m.VersionID] = m.IsApplied
	}
	return results, nil
}
