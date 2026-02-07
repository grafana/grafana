package goose

import (
	"cmp"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"sync"

	"github.com/pressly/goose/v3/database"
	"github.com/pressly/goose/v3/internal/controller"
	"github.com/pressly/goose/v3/internal/gooseutil"
	"github.com/pressly/goose/v3/internal/sqlparser"
	"go.uber.org/multierr"
)

// Provider is a goose migration provider.
type Provider struct {
	// mu protects all accesses to the provider and must be held when calling operations on the
	// database.
	mu sync.Mutex

	db               *sql.DB
	store            *controller.StoreController
	versionTableOnce sync.Once

	fsys fs.FS
	cfg  config

	// migrations are ordered by version in ascending order. This list will never be empty and
	// contains all migrations known to the provider.
	migrations []*Migration
}

// NewProvider returns a new goose provider.
//
// The caller is responsible for matching the database dialect with the database/sql driver. For
// example, if the database dialect is "postgres", the database/sql driver could be
// github.com/lib/pq or github.com/jackc/pgx. Each dialect has a corresponding [database.Dialect]
// constant backed by a default [database.Store] implementation. For more advanced use cases, such
// as using a custom table name or supplying a custom store implementation, see [WithStore].
//
// fsys is the filesystem used to read migration files, but may be nil. Most users will want to use
// [os.DirFS], os.DirFS("path/to/migrations"), to read migrations from the local filesystem.
// However, it is possible to use a different "filesystem", such as [embed.FS] or filter out
// migrations using [fs.Sub].
//
// See [ProviderOption] for more information on configuring the provider.
//
// Unless otherwise specified, all methods on Provider are safe for concurrent use.
func NewProvider(dialect Dialect, db *sql.DB, fsys fs.FS, opts ...ProviderOption) (*Provider, error) {
	if db == nil {
		return nil, errors.New("db must not be nil")
	}
	if fsys == nil {
		fsys = noopFS{}
	}
	cfg := config{
		registered:      make(map[int64]*Migration),
		excludePaths:    make(map[string]bool),
		excludeVersions: make(map[int64]bool),
	}
	for _, opt := range opts {
		if err := opt.apply(&cfg); err != nil {
			return nil, err
		}
	}
	// Allow users to specify a custom store implementation, but only if they don't specify a
	// dialect. If they specify a dialect, we'll use the default store implementation.
	if dialect == DialectCustom && cfg.store == nil {
		return nil, errors.New("custom store must be supplied when using a custom dialect, make sure to pass WithStore option")
	}
	if dialect != DialectCustom && cfg.store != nil {
		return nil, errors.New("custom store must not be specified when using one of the default dialects, use DialectCustom instead")
	}
	// Allow table name to be set only if store is not set.
	if cfg.tableName != "" && cfg.store != nil {
		return nil, errors.New("WithTableName cannot be used with WithStore; set the table name directly on your custom store")
	}

	// Set default logger if neither was provided
	if cfg.slogger == nil && cfg.logger == nil {
		cfg.logger = &stdLogger{}
	}
	var store database.Store
	if dialect != "" {
		var err error
		store, err = database.NewStore(dialect, cmp.Or(cfg.tableName, DefaultTablename))
		if err != nil {
			return nil, err
		}
	} else {
		store = cfg.store
	}
	if store.Tablename() == "" {
		return nil, errors.New("invalid store implementation: table name must not be empty")
	}
	return newProvider(db, store, fsys, cfg, registeredGoMigrations /* global */)
}

func newProvider(
	db *sql.DB,
	store database.Store,
	fsys fs.FS,
	cfg config,
	global map[int64]*Migration,
) (*Provider, error) {
	// Collect migrations from the filesystem and merge with registered migrations.
	//
	// Note, we don't parse SQL migrations here. They are parsed lazily when required.

	// feat(mf): we could add a flag to parse SQL migrations eagerly. This would allow us to return
	// an error if there are any SQL parsing errors. This adds a bit overhead to startup though, so
	// we should make it optional.
	filesystemSources, err := collectFilesystemSources(fsys, false, cfg.excludePaths, cfg.excludeVersions)
	if err != nil {
		return nil, err
	}
	versionToGoMigration := make(map[int64]*Migration)
	// Add user-registered Go migrations from the provider.
	for version, m := range cfg.registered {
		versionToGoMigration[version] = m
	}
	// Skip adding global Go migrations if explicitly disabled.
	if cfg.disableGlobalRegistry {
		// TODO(mf): let's add a warn-level log here to inform users if len(global) > 0. Would like
		// to add this once we're on go1.21 and leverage the new slog package.
	} else {
		for version, m := range global {
			if _, ok := versionToGoMigration[version]; ok {
				return nil, fmt.Errorf("global go migration conflicts with provider-registered go migration with version %d", version)
			}
			versionToGoMigration[version] = m
		}
	}
	// At this point we have all registered unique Go migrations (if any). We need to merge them
	// with SQL migrations from the filesystem.
	migrations, err := merge(filesystemSources, versionToGoMigration)
	if err != nil {
		return nil, err
	}
	if len(migrations) == 0 {
		return nil, ErrNoMigrations
	}
	return &Provider{
		db:         db,
		fsys:       fsys,
		cfg:        cfg,
		store:      controller.NewStoreController(store),
		migrations: migrations,
	}, nil
}

// Status returns the status of all migrations, merging the list of migrations from the database and
// filesystem. The returned items are ordered by version, in ascending order.
func (p *Provider) Status(ctx context.Context) ([]*MigrationStatus, error) {
	return p.status(ctx)
}

// HasPending returns true if there are pending migrations to apply, otherwise, it returns false. If
// out-of-order migrations are disabled, yet some are detected, this method returns an error.
//
// Note, this method will not use a SessionLocker or Locker if one is configured. This allows
// callers to check for pending migrations without blocking or being blocked by other operations.
func (p *Provider) HasPending(ctx context.Context) (bool, error) {
	return p.hasPending(ctx)
}

// GetVersions returns the max database version and the target version to migrate to.
//
// Note, this method will not use a SessionLocker or Locker if one is configured. This allows
// callers to check for versions without blocking or being blocked by other operations.
func (p *Provider) GetVersions(ctx context.Context) (current, target int64, err error) {
	return p.getVersions(ctx)
}

// GetDBVersion returns the highest version recorded in the database, regardless of the order in
// which migrations were applied. For example, if migrations were applied out of order (1,4,2,3),
// this method returns 4. If no migrations have been applied, it returns 0.
func (p *Provider) GetDBVersion(ctx context.Context) (int64, error) {
	if p.cfg.disableVersioning {
		return -1, errors.New("getting database version not supported when versioning is disabled")
	}
	return p.getDBMaxVersion(ctx, nil)
}

// ListSources returns a list of all migration sources known to the provider, sorted in ascending
// order by version. The path field may be empty for manually registered migrations, such as Go
// migrations registered using the [WithGoMigrations] option.
func (p *Provider) ListSources() []*Source {
	sources := make([]*Source, 0, len(p.migrations))
	for _, m := range p.migrations {
		sources = append(sources, &Source{
			Type:    m.Type,
			Path:    m.Source,
			Version: m.Version,
		})
	}
	return sources
}

// Ping attempts to ping the database to verify a connection is available.
func (p *Provider) Ping(ctx context.Context) error {
	return p.db.PingContext(ctx)
}

// Close closes the database connection initially supplied to the provider.
func (p *Provider) Close() error {
	return p.db.Close()
}

// ApplyVersion applies exactly one migration for the specified version. If there is no migration
// available for the specified version, this method returns [ErrVersionNotFound]. If the migration
// has already been applied, this method returns [ErrAlreadyApplied].
//
// The direction parameter determines the migration direction: true for up migration and false for
// down migration.
func (p *Provider) ApplyVersion(ctx context.Context, version int64, direction bool) (*MigrationResult, error) {
	res, err := p.apply(ctx, version, direction)
	if err != nil {
		return nil, err
	}
	// This should never happen, we must return exactly one result.
	if len(res) != 1 {
		versions := make([]string, 0, len(res))
		for _, r := range res {
			versions = append(versions, strconv.FormatInt(r.Source.Version, 10))
		}
		return nil, fmt.Errorf(
			"unexpected number of migrations applied running apply, expecting exactly one result: %v",
			strings.Join(versions, ","),
		)
	}
	return res[0], nil
}

// Up applies all pending migrations. If there are no new migrations to apply, this method returns
// empty list and nil error.
func (p *Provider) Up(ctx context.Context) ([]*MigrationResult, error) {
	hasPending, err := p.HasPending(ctx)
	if err != nil {
		return nil, err
	}
	if !hasPending {
		return nil, nil
	}
	return p.up(ctx, false, math.MaxInt64)
}

// UpByOne applies the next pending migration. If there is no next migration to apply, this method
// returns [ErrNoNextVersion].
func (p *Provider) UpByOne(ctx context.Context) (*MigrationResult, error) {
	hasPending, err := p.HasPending(ctx)
	if err != nil {
		return nil, err
	}
	if !hasPending {
		return nil, ErrNoNextVersion
	}
	res, err := p.up(ctx, true, math.MaxInt64)
	if err != nil {
		return nil, err
	}
	if len(res) == 0 {
		return nil, ErrNoNextVersion
	}
	// This should never happen, we must return exactly one result.
	if len(res) != 1 {
		versions := make([]string, 0, len(res))
		for _, r := range res {
			versions = append(versions, strconv.FormatInt(r.Source.Version, 10))
		}
		return nil, fmt.Errorf(
			"unexpected number of migrations applied running up-by-one, expecting exactly one result: %v",
			strings.Join(versions, ","),
		)
	}
	return res[0], nil
}

// UpTo applies all pending migrations up to, and including, the specified version. If there are no
// migrations to apply, this method returns empty list and nil error.
//
// For example, if there are three new migrations (9,10,11) and the current database version is 8
// with a requested version of 10, only versions 9,10 will be applied.
func (p *Provider) UpTo(ctx context.Context, version int64) ([]*MigrationResult, error) {
	hasPending, err := p.HasPending(ctx)
	if err != nil {
		return nil, err
	}
	if !hasPending {
		return nil, nil
	}
	return p.up(ctx, false, version)
}

// Down rolls back the most recently applied migration. If there are no migrations to rollback, this
// method returns [ErrNoNextVersion].
//
// Note, migrations are rolled back in the order they were applied. And not in the reverse order of
// the migration version. This only applies in scenarios where migrations are allowed to be applied
// out of order.
func (p *Provider) Down(ctx context.Context) (*MigrationResult, error) {
	res, err := p.down(ctx, true, 0)
	if err != nil {
		return nil, err
	}
	if len(res) == 0 {
		return nil, ErrNoNextVersion
	}
	// This should never happen, we must return exactly one result.
	if len(res) != 1 {
		versions := make([]string, 0, len(res))
		for _, r := range res {
			versions = append(versions, strconv.FormatInt(r.Source.Version, 10))
		}
		return nil, fmt.Errorf(
			"unexpected number of migrations applied running down, expecting exactly one result: %v",
			strings.Join(versions, ","),
		)
	}
	return res[0], nil
}

// DownTo rolls back all migrations down to, but not including, the specified version.
//
// For example, if the current database version is 11,10,9... and the requested version is 9, only
// migrations 11, 10 will be rolled back.
//
// Note, migrations are rolled back in the order they were applied. And not in the reverse order of
// the migration version. This only applies in scenarios where migrations are allowed to be applied
// out of order.
func (p *Provider) DownTo(ctx context.Context, version int64) ([]*MigrationResult, error) {
	if version < 0 {
		return nil, fmt.Errorf("invalid version: must be a valid number or zero: %d", version)
	}
	return p.down(ctx, false, version)
}

// *** Internal methods ***

func (p *Provider) up(
	ctx context.Context,
	byOne bool,
	version int64,
) (_ []*MigrationResult, retErr error) {
	if version < 1 {
		return nil, errInvalidVersion
	}
	conn, cleanup, err := p.initialize(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize: %w", err)
	}
	defer func() {
		retErr = multierr.Append(retErr, cleanup())
	}()

	if len(p.migrations) == 0 {
		return nil, nil
	}
	var apply []*Migration
	if p.cfg.disableVersioning {
		if byOne {
			return nil, errors.New("up-by-one not supported when versioning is disabled")
		}
		apply = p.migrations
	} else {
		// optimize(mf): Listing all migrations from the database isn't great.
		//
		// The ideal implementation would be to query for the current max version and then apply
		// migrations greater than that version. However, a nice property of the current
		// implementation is that we can make stronger guarantees about unapplied migrations.
		//
		// In cases where users do not use out-of-order migrations, we want to surface an error if
		// there are older unapplied migrations. See https://github.com/pressly/goose/issues/761 for
		// more details.
		//
		// And in cases where users do use out-of-order migrations, we need to build a list of older
		// migrations that need to be applied, so we need to query for all migrations anyways.
		dbMigrations, err := p.store.ListMigrations(ctx, conn)
		if err != nil {
			return nil, err
		}
		if len(dbMigrations) == 0 {
			return nil, errMissingZeroVersion
		}
		versions, err := gooseutil.UpVersions(
			getVersionsFromMigrations(p.migrations),     // fsys versions
			getVersionsFromListMigrations(dbMigrations), // db versions
			version,
			p.cfg.allowMissing,
		)
		if err != nil {
			return nil, err
		}
		for _, v := range versions {
			m, err := p.getMigration(v)
			if err != nil {
				return nil, err
			}
			apply = append(apply, m)
		}
	}
	return p.runMigrations(ctx, conn, apply, sqlparser.DirectionUp, byOne)
}

func (p *Provider) down(
	ctx context.Context,
	byOne bool,
	version int64,
) (_ []*MigrationResult, retErr error) {
	conn, cleanup, err := p.initialize(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize: %w", err)
	}
	defer func() {
		retErr = multierr.Append(retErr, cleanup())
	}()

	if len(p.migrations) == 0 {
		return nil, nil
	}
	if p.cfg.disableVersioning {
		var downMigrations []*Migration
		if byOne {
			last := p.migrations[len(p.migrations)-1]
			downMigrations = []*Migration{last}
		} else {
			downMigrations = p.migrations
		}
		return p.runMigrations(ctx, conn, downMigrations, sqlparser.DirectionDown, byOne)
	}
	dbMigrations, err := p.store.ListMigrations(ctx, conn)
	if err != nil {
		return nil, err
	}
	if len(dbMigrations) == 0 {
		return nil, errMissingZeroVersion
	}
	// We never migrate the zero version down.
	if dbMigrations[0].Version == 0 {
		p.logf(ctx,
			"no migrations to run, current version: 0",
			"no migrations to run",
			slog.Int64("version", 0),
		)
		return nil, nil
	}
	var apply []*Migration
	for _, dbMigration := range dbMigrations {
		if dbMigration.Version <= version {
			break
		}
		m, err := p.getMigration(dbMigration.Version)
		if err != nil {
			return nil, err
		}
		apply = append(apply, m)
	}
	return p.runMigrations(ctx, conn, apply, sqlparser.DirectionDown, byOne)
}

func (p *Provider) apply(
	ctx context.Context,
	version int64,
	direction bool,
) (_ []*MigrationResult, retErr error) {
	if version < 1 {
		return nil, errInvalidVersion
	}
	m, err := p.getMigration(version)
	if err != nil {
		return nil, err
	}
	conn, cleanup, err := p.initialize(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize: %w", err)
	}
	defer func() {
		retErr = multierr.Append(retErr, cleanup())
	}()

	d := sqlparser.DirectionDown
	if direction {
		d = sqlparser.DirectionUp
	}

	if p.cfg.disableVersioning {
		// If versioning is disabled, we simply run the migration.
		return p.runMigrations(ctx, conn, []*Migration{m}, d, true)
	}

	result, err := p.store.GetMigration(ctx, conn, version)
	if err != nil && !errors.Is(err, database.ErrVersionNotFound) {
		return nil, err
	}
	// There are a few states here:
	//  1. direction is up
	//    a. migration is applied, this is an error (ErrAlreadyApplied)
	//    b. migration is not applied, apply it
	if direction && result != nil {
		return nil, fmt.Errorf("version %d: %w", version, ErrAlreadyApplied)
	}
	//  2. direction is down
	//    a. migration is applied, rollback
	//    b. migration is not applied, this is an error (ErrNotApplied)
	if !direction && result == nil {
		return nil, fmt.Errorf("version %d: %w", version, ErrNotApplied)
	}
	return p.runMigrations(ctx, conn, []*Migration{m}, d, true)
}

func (p *Provider) getVersions(ctx context.Context) (current, target int64, retErr error) {
	conn, cleanup, err := p.initialize(ctx, false)
	if err != nil {
		return -1, -1, fmt.Errorf("failed to initialize: %w", err)
	}
	defer func() {
		retErr = multierr.Append(retErr, cleanup())
	}()

	target = p.migrations[len(p.migrations)-1].Version

	// If versioning is disabled, we always have pending migrations and the target version is the
	// last migration.
	if p.cfg.disableVersioning {
		return -1, target, nil
	}

	current, err = p.store.GetLatestVersion(ctx, conn)
	if err != nil {
		if errors.Is(err, database.ErrVersionNotFound) {
			return -1, target, errMissingZeroVersion
		}
		return -1, target, err
	}
	return current, target, nil
}

func (p *Provider) hasPending(ctx context.Context) (_ bool, retErr error) {
	conn, cleanup, err := p.initialize(ctx, false)
	if err != nil {
		return false, fmt.Errorf("failed to initialize: %w", err)
	}
	defer func() {
		retErr = multierr.Append(retErr, cleanup())
	}()

	// If versioning is disabled, we always have pending migrations.
	if p.cfg.disableVersioning {
		return true, nil
	}

	// List all migrations from the database. Careful, optimizations here can lead to subtle bugs.
	// We have 2 important cases to consider:
	//
	//  1.  Users have enabled out-of-order migrations, in which case we need to check if any
	//      migrations are missing and report that there are pending migrations. Do not surface an
	//      error because this is a valid state.
	//
	//  2.  Users have disabled out-of-order migrations (default), in which case we need to check if all
	//      migrations have been applied. We cannot check for the highest applied version because we lose the
	//      ability to surface an error if an out-of-order migration was introduced. It would be silently
	//      ignored and the user would not know that they have unapplied migrations.
	//
	//      Maybe we could consider adding a flag to the provider such as IgnoreMissing, which would
	//      allow silently ignoring missing migrations. This would be useful for users that have built
	//      checks that prevent missing migrations from being introduced.

	dbMigrations, err := p.store.ListMigrations(ctx, conn)
	if err != nil {
		return false, err
	}
	apply, err := gooseutil.UpVersions(
		getVersionsFromMigrations(p.migrations),     // fsys versions
		getVersionsFromListMigrations(dbMigrations), // db versions
		math.MaxInt64,
		p.cfg.allowMissing,
	)
	if err != nil {
		return false, err
	}
	return len(apply) > 0, nil
}

func getVersionsFromMigrations(in []*Migration) []int64 {
	out := make([]int64, 0, len(in))
	for _, m := range in {
		out = append(out, m.Version)
	}
	return out

}

func getVersionsFromListMigrations(in []*database.ListMigrationsResult) []int64 {
	out := make([]int64, 0, len(in))
	for _, m := range in {
		out = append(out, m.Version)
	}
	return out

}

func (p *Provider) status(ctx context.Context) (_ []*MigrationStatus, retErr error) {
	conn, cleanup, err := p.initialize(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize: %w", err)
	}
	defer func() {
		retErr = multierr.Append(retErr, cleanup())
	}()

	status := make([]*MigrationStatus, 0, len(p.migrations))
	for _, m := range p.migrations {
		migrationStatus := &MigrationStatus{
			Source: &Source{
				Type:    m.Type,
				Path:    m.Source,
				Version: m.Version,
			},
			State: StatePending,
		}
		// If versioning is disabled, we can't check the database for applied migrations, so we
		// assume all migrations are pending.
		if !p.cfg.disableVersioning {
			dbResult, err := p.store.GetMigration(ctx, conn, m.Version)
			if err != nil && !errors.Is(err, database.ErrVersionNotFound) {
				return nil, err
			}
			if dbResult != nil {
				migrationStatus.State = StateApplied
				migrationStatus.AppliedAt = dbResult.Timestamp
			}
		}
		status = append(status, migrationStatus)
	}

	return status, nil
}

// getDBMaxVersion returns the highest version recorded in the database, regardless of the order in
// which migrations were applied. conn may be nil, in which case a connection is initialized.
func (p *Provider) getDBMaxVersion(ctx context.Context, conn *sql.Conn) (_ int64, retErr error) {
	if conn == nil {
		var cleanup func() error
		var err error
		conn, cleanup, err = p.initialize(ctx, true)
		if err != nil {
			return 0, err
		}
		defer func() {
			retErr = multierr.Append(retErr, cleanup())
		}()
	}

	latest, err := p.store.GetLatestVersion(ctx, conn)
	if err != nil {
		if errors.Is(err, database.ErrVersionNotFound) {
			return 0, errMissingZeroVersion
		}
		return -1, err
	}
	return latest, nil
}
