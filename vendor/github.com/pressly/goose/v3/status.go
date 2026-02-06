package goose

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"time"
)

// Status prints the status of all migrations.
func Status(db *sql.DB, dir string, opts ...OptionsFunc) error {
	ctx := context.Background()
	return StatusContext(ctx, db, dir, opts...)
}

// StatusContext prints the status of all migrations.
func StatusContext(ctx context.Context, db *sql.DB, dir string, opts ...OptionsFunc) error {
	option := &options{}
	for _, f := range opts {
		f(option)
	}
	migrations, err := CollectMigrations(dir, minVersion, maxVersion)
	if err != nil {
		return fmt.Errorf("failed to collect migrations: %w", err)
	}
	if option.noVersioning {
		log.Printf("    Applied At                  Migration")
		log.Printf("    =======================================")
		for _, current := range migrations {
			log.Printf("    %-24s -- %v", "no versioning", filepath.Base(current.Source))
		}
		return nil
	}

	// must ensure that the version table exists if we're running on a pristine DB
	if _, err := EnsureDBVersionContext(ctx, db); err != nil {
		return fmt.Errorf("failed to ensure DB version: %w", err)
	}

	log.Printf("    Applied At                  Migration")
	log.Printf("    =======================================")
	for _, migration := range migrations {
		if err := printMigrationStatus(ctx, db, migration.Version, filepath.Base(migration.Source)); err != nil {
			return fmt.Errorf("failed to print status: %w", err)
		}
	}

	return nil
}

func printMigrationStatus(ctx context.Context, db *sql.DB, version int64, script string) error {
	m, err := store.GetMigration(ctx, db, TableName(), version)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("failed to query the latest migration: %w", err)
	}
	appliedAt := "Pending"
	if m != nil && m.IsApplied {
		appliedAt = m.Timestamp.Format(time.ANSIC)
	}
	log.Printf("    %-24s -- %v", appliedAt, script)
	return nil
}
