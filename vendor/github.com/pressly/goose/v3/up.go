package goose

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"
)

type options struct {
	allowMissing bool
	applyUpByOne bool
	noVersioning bool
}

type OptionsFunc func(o *options)

func WithAllowMissing() OptionsFunc {
	return func(o *options) { o.allowMissing = true }
}

func WithNoVersioning() OptionsFunc {
	return func(o *options) { o.noVersioning = true }
}

func WithNoColor(b bool) OptionsFunc {
	return func(o *options) { noColor = b }
}

func withApplyUpByOne() OptionsFunc {
	return func(o *options) { o.applyUpByOne = true }
}

// UpTo migrates up to a specific version.
func UpTo(db *sql.DB, dir string, version int64, opts ...OptionsFunc) error {
	ctx := context.Background()
	return UpToContext(ctx, db, dir, version, opts...)
}

func UpToContext(ctx context.Context, db *sql.DB, dir string, version int64, opts ...OptionsFunc) error {
	option := &options{}
	for _, f := range opts {
		f(option)
	}
	foundMigrations, err := CollectMigrations(dir, minVersion, version)
	if err != nil {
		return err
	}

	if option.noVersioning {
		if len(foundMigrations) == 0 {
			return nil
		}
		if option.applyUpByOne {
			// For up-by-one this means keep re-applying the first
			// migration over and over.
			version = foundMigrations[0].Version
		}
		return upToNoVersioning(ctx, db, foundMigrations, version)
	}

	if _, err := EnsureDBVersionContext(ctx, db); err != nil {
		return err
	}
	dbMigrations, err := listAllDBVersions(ctx, db)
	if err != nil {
		return err
	}
	dbMaxVersion := dbMigrations[len(dbMigrations)-1].Version
	// lookupAppliedInDB is a map of all applied migrations in the database.
	lookupAppliedInDB := make(map[int64]bool)
	for _, m := range dbMigrations {
		lookupAppliedInDB[m.Version] = true
	}

	missingMigrations := findMissingMigrations(dbMigrations, foundMigrations, dbMaxVersion)

	// feature(mf): It is very possible someone may want to apply ONLY new migrations
	// and skip missing migrations altogether. At the moment this is not supported,
	// but leaving this comment because that's where that logic will be handled.
	if len(missingMigrations) > 0 && !option.allowMissing {
		var collected []string
		for _, m := range missingMigrations {
			output := fmt.Sprintf("version %d: %s", m.Version, m.Source)
			collected = append(collected, output)
		}
		return fmt.Errorf("error: found %d missing migrations before current version %d:\n\t%s",
			len(missingMigrations), dbMaxVersion, strings.Join(collected, "\n\t"))
	}
	var migrationsToApply Migrations
	if option.allowMissing {
		migrationsToApply = missingMigrations
	}
	// filter all migrations with a version greater than the supplied version (min) and less than or
	// equal to the requested version (max). Note, we do not need to filter out missing migrations
	// because we are only appending "new" migrations that have a higher version than the current
	// database max version, which inevitably means they are not "missing".
	for _, m := range foundMigrations {
		if lookupAppliedInDB[m.Version] {
			continue
		}
		if m.Version > dbMaxVersion && m.Version <= version {
			migrationsToApply = append(migrationsToApply, m)
		}
	}

	var current int64
	for _, m := range migrationsToApply {
		if err := m.UpContext(ctx, db); err != nil {
			return err
		}
		if option.applyUpByOne {
			return nil
		}
		current = m.Version
	}

	if len(migrationsToApply) == 0 {
		current, err = GetDBVersionContext(ctx, db)
		if err != nil {
			return err
		}

		log.Printf("goose: no migrations to run. current version: %d", current)
	} else {
		log.Printf("goose: successfully migrated database to version: %d", current)
	}

	// At this point there are no more migrations to apply. But we need to maintain
	// the following behaviour:
	// UpByOne returns an error to signifying there are no more migrations.
	// Up and UpTo return nil

	if option.applyUpByOne {
		return ErrNoNextVersion
	}

	return nil
}

// upToNoVersioning applies up migrations up to, and including, the
// target version.
func upToNoVersioning(ctx context.Context, db *sql.DB, migrations Migrations, version int64) error {
	var finalVersion int64
	for _, current := range migrations {
		if current.Version > version {
			break
		}
		current.noVersioning = true
		if err := current.UpContext(ctx, db); err != nil {
			return err
		}
		finalVersion = current.Version
	}
	log.Printf("goose: up to current file version: %d", finalVersion)
	return nil
}

// Up applies all available migrations.
func Up(db *sql.DB, dir string, opts ...OptionsFunc) error {
	ctx := context.Background()
	return UpContext(ctx, db, dir, opts...)
}

// UpContext applies all available migrations.
func UpContext(ctx context.Context, db *sql.DB, dir string, opts ...OptionsFunc) error {
	return UpToContext(ctx, db, dir, maxVersion, opts...)
}

// UpByOne migrates up by a single version.
func UpByOne(db *sql.DB, dir string, opts ...OptionsFunc) error {
	ctx := context.Background()
	return UpByOneContext(ctx, db, dir, opts...)
}

// UpByOneContext migrates up by a single version.
func UpByOneContext(ctx context.Context, db *sql.DB, dir string, opts ...OptionsFunc) error {
	opts = append(opts, withApplyUpByOne())
	return UpToContext(ctx, db, dir, maxVersion, opts...)
}

// listAllDBVersions returns a list of all migrations, ordered ascending.
func listAllDBVersions(ctx context.Context, db *sql.DB) (Migrations, error) {
	dbMigrations, err := store.ListMigrations(ctx, db, TableName())
	if err != nil {
		return nil, err
	}
	all := make(Migrations, 0, len(dbMigrations))
	for _, m := range dbMigrations {
		all = append(all, &Migration{
			Version: m.VersionID,
		})
	}
	// ListMigrations returns migrations in descending order by id.
	// But we want to return them in ascending order by version_id, so we re-sort.
	sort.SliceStable(all, func(i, j int) bool {
		return all[i].Version < all[j].Version
	})
	return all, nil
}

// findMissingMigrations migrations returns all missing migrations.
// A migrations is considered missing if it has a version less than the
// current known max version.
func findMissingMigrations(knownMigrations, newMigrations Migrations, dbMaxVersion int64) Migrations {
	existing := make(map[int64]bool)
	for _, known := range knownMigrations {
		existing[known.Version] = true
	}
	var missing Migrations
	for _, new := range newMigrations {
		if !existing[new.Version] && new.Version < dbMaxVersion {
			missing = append(missing, new)
		}
	}
	sort.SliceStable(missing, func(i, j int) bool {
		return missing[i].Version < missing[j].Version
	})
	return missing
}
