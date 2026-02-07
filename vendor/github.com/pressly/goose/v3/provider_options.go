package goose

import (
	"errors"
	"fmt"
	"log/slog"

	"github.com/pressly/goose/v3/database"
	"github.com/pressly/goose/v3/lock"
)

const (
	// DefaultTablename is the default name of the database table used to track history of applied
	// migrations.
	DefaultTablename = "goose_db_version"
)

// ProviderOption is a configuration option for a goose goose.
type ProviderOption interface {
	apply(*config) error
}

// WithStore configures the provider with a custom [database.Store], allowing users to bring their
// own implementation of the store interface. When this option is used, the dialect parameter of
// [NewProvider] must be set to [DialectCustom].
//
// This option cannot be used together with [WithTableName], since the table name is set on the
// store.
//
// By default, the provider uses the [database.NewStore] function to create a store backed by one of
// the officially supported dialects.
func WithStore(store database.Store) ProviderOption {
	return configFunc(func(c *config) error {
		if c.store != nil {
			return fmt.Errorf("store already set: %T", c.store)
		}
		if store == nil {
			return errors.New("store must not be nil")
		}
		if store.Tablename() == "" {
			return errors.New("store implementation must set the table name")
		}
		c.store = store
		return nil
	})
}

// WithTableName sets the name of the database table used to track history of applied migrations.
// This option cannot be used together with [WithStore], since the table name is set on the store.
//
// Default is "goose_db_version".
func WithTableName(name string) ProviderOption {
	return configFunc(func(c *config) error {
		if name == "" {
			return errors.New("table name must not be empty")
		}
		c.tableName = name
		return nil
	})
}

// WithVerbose enables verbose logging.
func WithVerbose(b bool) ProviderOption {
	return configFunc(func(c *config) error {
		c.verbose = b
		return nil
	})
}

// WithSessionLocker enables locking using the provided SessionLocker.
//
// If WithSessionLocker is not called, locking is disabled. Must not be used together with
// [WithLocker].
func WithSessionLocker(locker lock.SessionLocker) ProviderOption {
	return configFunc(func(c *config) error {
		if c.lockEnabled {
			return errors.New("lock already enabled")
		}
		if c.sessionLocker != nil {
			return errors.New("session locker already set")
		}
		if c.locker != nil {
			return errors.New("locker already set; cannot use both SessionLocker and Locker")
		}
		if locker == nil {
			return errors.New("session locker must not be nil")
		}
		c.lockEnabled = true
		c.sessionLocker = locker
		return nil
	})
}

// WithLocker enables locking using the provided Locker.
//
// If WithLocker is not called, locking is disabled. Must not be used together with
// [WithSessionLocker].
func WithLocker(locker lock.Locker) ProviderOption {
	return configFunc(func(c *config) error {
		if c.lockEnabled {
			return errors.New("lock already enabled")
		}
		if c.locker != nil {
			return errors.New("locker already set")
		}
		if c.sessionLocker != nil {
			return errors.New("session locker already set; cannot use both SessionLocker and Locker")
		}
		if locker == nil {
			return errors.New("locker must not be nil")
		}
		c.lockEnabled = true
		c.locker = locker
		return nil
	})
}

// WithExcludeNames excludes the given file name from the list of migrations. If called multiple
// times, the list of excludes is merged.
func WithExcludeNames(excludes []string) ProviderOption {
	return configFunc(func(c *config) error {
		for _, name := range excludes {
			if _, ok := c.excludePaths[name]; ok {
				return fmt.Errorf("duplicate exclude file name: %s", name)
			}
			c.excludePaths[name] = true
		}
		return nil
	})
}

// WithExcludeVersions excludes the given versions from the list of migrations. If called multiple
// times, the list of excludes is merged.
func WithExcludeVersions(versions []int64) ProviderOption {
	return configFunc(func(c *config) error {
		for _, version := range versions {
			if version < 1 {
				return errInvalidVersion
			}
			if _, ok := c.excludeVersions[version]; ok {
				return fmt.Errorf("duplicate excludes version: %d", version)
			}
			c.excludeVersions[version] = true
		}
		return nil
	})
}

// WithGoMigrations registers Go migrations with the provider. If a Go migration with the same
// version has already been registered, an error will be returned.
//
// Go migrations must be constructed using the [NewGoMigration] function.
func WithGoMigrations(migrations ...*Migration) ProviderOption {
	return configFunc(func(c *config) error {
		for _, m := range migrations {
			if _, ok := c.registered[m.Version]; ok {
				return fmt.Errorf("go migration with version %d already registered", m.Version)
			}
			if err := checkGoMigration(m); err != nil {
				return fmt.Errorf("invalid go migration: %w", err)
			}
			c.registered[m.Version] = m
		}
		return nil
	})
}

// WithDisableGlobalRegistry prevents the provider from registering Go migrations from the global
// registry. By default, goose will register all Go migrations including those registered globally.
func WithDisableGlobalRegistry(b bool) ProviderOption {
	return configFunc(func(c *config) error {
		c.disableGlobalRegistry = b
		return nil
	})
}

// WithAllowOutofOrder allows the provider to apply missing (out-of-order) migrations. By default,
// goose will raise an error if it encounters a missing migration.
//
// For example: migrations 1,3 are applied and then version 2,6 are introduced. If this option is
// true, then goose will apply 2 (missing) and 6 (new) instead of raising an error. The final order
// of applied migrations will be: 1,3,2,6. Out-of-order migrations are always applied first,
// followed by new migrations.
func WithAllowOutofOrder(b bool) ProviderOption {
	return configFunc(func(c *config) error {
		c.allowMissing = b
		return nil
	})
}

// WithDisableVersioning disables versioning. Disabling versioning allows applying migrations
// without tracking the versions in the database schema table. Useful for tests, seeding a database
// or running ad-hoc queries. By default, goose will track all versions in the database schema
// table.
func WithDisableVersioning(b bool) ProviderOption {
	return configFunc(func(c *config) error {
		c.disableVersioning = b
		return nil
	})
}

// WithLogger will set a custom Logger, which will override the default logger. Cannot be used
// together with [WithSlog].
func WithLogger(l Logger) ProviderOption {
	return configFunc(func(c *config) error {
		if l == nil {
			return errors.New("logger must not be nil")
		}
		if c.slogger != nil {
			return errors.New("cannot use both WithLogger and WithSlog")
		}
		c.logger = l
		return nil
	})
}

// WithSlog will set a custom [*slog.Logger] for structured logging. This enables rich structured
// logging with attributes like source, direction, duration, etc. Cannot be used together with
// [WithLogger].
//
// Example:
//
//	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
//	p, err := goose.NewProvider("postgres", db, fs, goose.WithSlog(logger))
func WithSlog(logger *slog.Logger) ProviderOption {
	return configFunc(func(c *config) error {
		if logger == nil {
			return errors.New("slog logger must not be nil")
		}
		if c.logger != nil {
			return errors.New("cannot use both WithLogger and WithSlog")
		}
		c.slogger = logger
		return nil
	})
}

// WithIsolateDDL executes DDL operations separately from DML operations. This is useful for
// databases like AWS Aurora DSQL that don't support mixing DDL and DML within the same transaction.
func WithIsolateDDL(b bool) ProviderOption {
	return configFunc(func(c *config) error {
		c.isolateDDL = b
		return nil
	})
}

type config struct {
	tableName string
	store     database.Store

	verbose         bool
	excludePaths    map[string]bool
	excludeVersions map[int64]bool

	// Go migrations registered by the user. These will be merged/resolved against the globally
	// registered migrations.
	registered map[int64]*Migration

	// Locking options
	lockEnabled   bool
	sessionLocker lock.SessionLocker
	locker        lock.Locker

	// Feature
	disableVersioning     bool
	allowMissing          bool
	disableGlobalRegistry bool
	isolateDDL            bool

	// Only a single logger can be set, they are mutually exclusive. If neither is set, a default
	// [Logger] will be set to maintain backward compatibility in /v3.
	logger  Logger
	slogger *slog.Logger
}

type configFunc func(*config) error

func (f configFunc) apply(cfg *config) error {
	return f(cfg)
}
