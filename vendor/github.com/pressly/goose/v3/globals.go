package goose

import (
	"errors"
	"fmt"
	"path/filepath"
)

var (
	registeredGoMigrations = make(map[int64]*Migration)
)

// ResetGlobalMigrations resets the global Go migrations registry.
//
// Not safe for concurrent use.
func ResetGlobalMigrations() {
	registeredGoMigrations = make(map[int64]*Migration)
}

// SetGlobalMigrations registers Go migrations globally. It returns an error if a migration with the
// same version has already been registered. Go migrations must be constructed using the
// [NewGoMigration] function.
//
// Not safe for concurrent use.
func SetGlobalMigrations(migrations ...*Migration) error {
	for _, m := range migrations {
		if _, ok := registeredGoMigrations[m.Version]; ok {
			return fmt.Errorf("go migration with version %d already registered", m.Version)
		}
		if err := checkGoMigration(m); err != nil {
			return fmt.Errorf("invalid go migration: %w", err)
		}
		registeredGoMigrations[m.Version] = m
	}
	return nil
}

func checkGoMigration(m *Migration) error {
	if !m.construct {
		return errors.New("must use NewGoMigration to construct migrations")
	}
	if !m.Registered {
		return errors.New("must be registered")
	}
	if m.Type != TypeGo {
		return fmt.Errorf("type must be %q", TypeGo)
	}
	if m.Version < 1 {
		return errors.New("version must be greater than zero")
	}
	if m.Source != "" {
		if filepath.Ext(m.Source) != ".go" {
			return fmt.Errorf("source must have .go extension: %q", m.Source)
		}
		// If the source is set, expect it to be a path with a numeric component that matches the
		// version. This field is not intended to be used for descriptive purposes.
		version, err := NumericComponent(m.Source)
		if err != nil {
			return fmt.Errorf("invalid source: %w", err)
		}
		if version != m.Version {
			return fmt.Errorf("version:%d does not match numeric component in source %q", m.Version, m.Source)
		}
	}
	if err := checkGoFunc(m.goUp); err != nil {
		return fmt.Errorf("up function: %w", err)
	}
	if err := checkGoFunc(m.goDown); err != nil {
		return fmt.Errorf("down function: %w", err)
	}
	if m.UpFnContext != nil && m.UpFnNoTxContext != nil {
		return errors.New("must specify exactly one of UpFnContext or UpFnNoTxContext")
	}
	if m.UpFn != nil && m.UpFnNoTx != nil {
		return errors.New("must specify exactly one of UpFn or UpFnNoTx")
	}
	if m.DownFnContext != nil && m.DownFnNoTxContext != nil {
		return errors.New("must specify exactly one of DownFnContext or DownFnNoTxContext")
	}
	if m.DownFn != nil && m.DownFnNoTx != nil {
		return errors.New("must specify exactly one of DownFn or DownFnNoTx")
	}
	return nil
}

func checkGoFunc(f *GoFunc) error {
	if f.RunTx != nil && f.RunDB != nil {
		return errors.New("must specify exactly one of RunTx or RunDB")
	}
	switch f.Mode {
	case TransactionEnabled, TransactionDisabled:
		// No functions, but mode is set. This is not an error. It means the user wants to
		// record a version with the given mode but not run any functions.
	default:
		return fmt.Errorf("invalid mode: %d", f.Mode)
	}
	if f.RunDB != nil && f.Mode != TransactionDisabled {
		return fmt.Errorf("transaction mode must be disabled or unspecified when RunDB is set")
	}
	if f.RunTx != nil && f.Mode != TransactionEnabled {
		return fmt.Errorf("transaction mode must be enabled or unspecified when RunTx is set")
	}
	return nil
}
