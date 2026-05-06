package goose

import (
	"errors"
	"fmt"
)

var (
	// ErrVersionNotFound is returned when a specific migration version is not located. This can
	// occur if a .sql file or a Go migration function for the specified version is missing.
	ErrVersionNotFound = errors.New("version not found")

	// ErrNoMigrations is returned by [NewProvider] when no migrations are found.
	ErrNoMigrations = errors.New("no migrations found")

	// ErrAlreadyApplied indicates that the migration cannot be applied because it has already been
	// executed. This error is returned by [Provider.Apply].
	ErrAlreadyApplied = errors.New("migration already applied")

	// ErrNotApplied indicates that the rollback cannot be performed because the migration has not
	// yet been applied. This error is returned by [Provider.Apply].
	ErrNotApplied = errors.New("migration not applied")

	// errInvalidVersion is returned when a migration version is invalid.
	errInvalidVersion = errors.New("version must be greater than 0")
)

// PartialError is returned when a migration fails, but some migrations already got applied.
type PartialError struct {
	// Applied are migrations that were applied successfully before the error occurred. May be
	// empty.
	Applied []*MigrationResult
	// Failed contains the result of the migration that failed. Cannot be nil.
	Failed *MigrationResult
	// Err is the error that occurred while running the migration and caused the failure.
	Err error
}

func (e *PartialError) Error() string {
	return fmt.Sprintf(
		"partial migration error (type:%s,version:%d): %v",
		e.Failed.Source.Type, e.Failed.Source.Version, e.Err,
	)
}

func (e *PartialError) Unwrap() error {
	return e.Err
}
