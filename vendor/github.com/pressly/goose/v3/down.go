package goose

import (
	"context"
	"database/sql"
	"fmt"
)

// Down rolls back a single migration from the current version.
func Down(db *sql.DB, dir string, opts ...OptionsFunc) error {
	ctx := context.Background()
	return DownContext(ctx, db, dir, opts...)
}

// DownContext rolls back a single migration from the current version.
func DownContext(ctx context.Context, db *sql.DB, dir string, opts ...OptionsFunc) error {
	option := &options{}
	for _, f := range opts {
		f(option)
	}
	migrations, err := CollectMigrations(dir, minVersion, maxVersion)
	if err != nil {
		return err
	}
	if option.noVersioning {
		if len(migrations) == 0 {
			return nil
		}
		currentVersion := migrations[len(migrations)-1].Version
		// Migrate only the latest migration down.
		return downToNoVersioning(ctx, db, migrations, currentVersion-1)
	}
	currentVersion, err := GetDBVersionContext(ctx, db)
	if err != nil {
		return err
	}
	current, err := migrations.Current(currentVersion)
	if err != nil {
		return fmt.Errorf("migration %v: %w", currentVersion, err)
	}
	return current.DownContext(ctx, db)
}

// DownTo rolls back migrations to a specific version.
func DownTo(db *sql.DB, dir string, version int64, opts ...OptionsFunc) error {
	ctx := context.Background()
	return DownToContext(ctx, db, dir, version, opts...)
}

// DownToContext rolls back migrations to a specific version.
func DownToContext(ctx context.Context, db *sql.DB, dir string, version int64, opts ...OptionsFunc) error {
	option := &options{}
	for _, f := range opts {
		f(option)
	}
	migrations, err := CollectMigrations(dir, minVersion, maxVersion)
	if err != nil {
		return err
	}
	if option.noVersioning {
		return downToNoVersioning(ctx, db, migrations, version)
	}

	for {
		currentVersion, err := GetDBVersionContext(ctx, db)
		if err != nil {
			return err
		}

		if currentVersion == 0 {
			log.Printf("goose: no migrations to run. current version: %d", currentVersion)
			return nil
		}
		current, err := migrations.Current(currentVersion)
		if err != nil {
			log.Printf("goose: migration file not found for current version (%d), error: %s", currentVersion, err)
			return err
		}

		if current.Version <= version {
			log.Printf("goose: no migrations to run. current version: %d", currentVersion)
			return nil
		}

		if err = current.DownContext(ctx, db); err != nil {
			return err
		}
	}
}

// downToNoVersioning applies down migrations down to, but not including, the
// target version.
func downToNoVersioning(ctx context.Context, db *sql.DB, migrations Migrations, version int64) error {
	var finalVersion int64
	for i := len(migrations) - 1; i >= 0; i-- {
		if version >= migrations[i].Version {
			finalVersion = migrations[i].Version
			break
		}
		migrations[i].noVersioning = true
		if err := migrations[i].DownContext(ctx, db); err != nil {
			return err
		}
	}
	log.Printf("goose: down to current file version: %d", finalVersion)
	return nil
}
