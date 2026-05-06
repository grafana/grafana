package goose

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/pressly/goose/v3/internal/sqlparser"
)

// NewGoMigration creates a new Go migration.
//
// Both up and down functions may be nil, in which case the migration will be recorded in the
// versions table but no functions will be run. This is useful for recording (up) or deleting (down)
// a version without running any functions. See [GoFunc] for more details.
func NewGoMigration(version int64, up, down *GoFunc) *Migration {
	m := &Migration{
		Type:       TypeGo,
		Registered: true,
		Version:    version,
		Next:       -1, Previous: -1,
		goUp:      &GoFunc{Mode: TransactionEnabled},
		goDown:    &GoFunc{Mode: TransactionEnabled},
		construct: true,
	}
	updateMode := func(f *GoFunc) *GoFunc {
		// infer mode from function
		if f.Mode == 0 {
			if f.RunTx != nil && f.RunDB == nil {
				f.Mode = TransactionEnabled
			}
			if f.RunTx == nil && f.RunDB != nil {
				f.Mode = TransactionDisabled
			}
			// Always default to TransactionEnabled if both functions are nil. This is the most
			// common use case.
			if f.RunDB == nil && f.RunTx == nil {
				f.Mode = TransactionEnabled
			}
		}
		return f
	}
	// To maintain backwards compatibility, we set ALL legacy functions. In a future major version,
	// we will remove these fields in favor of [GoFunc].
	//
	// Note, this function does not do any validation. Validation is lazily done when the migration
	// is registered.
	if up != nil {
		m.goUp = updateMode(up)

		if up.RunDB != nil {
			m.UpFnNoTxContext = up.RunDB          // func(context.Context, *sql.DB) error
			m.UpFnNoTx = withoutContext(up.RunDB) // func(*sql.DB) error
		}
		if up.RunTx != nil {
			m.UseTx = true
			m.UpFnContext = up.RunTx          // func(context.Context, *sql.Tx) error
			m.UpFn = withoutContext(up.RunTx) // func(*sql.Tx) error
		}
	}
	if down != nil {
		m.goDown = updateMode(down)

		if down.RunDB != nil {
			m.DownFnNoTxContext = down.RunDB          // func(context.Context, *sql.DB) error
			m.DownFnNoTx = withoutContext(down.RunDB) // func(*sql.DB) error
		}
		if down.RunTx != nil {
			m.UseTx = true
			m.DownFnContext = down.RunTx          // func(context.Context, *sql.Tx) error
			m.DownFn = withoutContext(down.RunTx) // func(*sql.Tx) error
		}
	}
	return m
}

// Migration struct represents either a SQL or Go migration.
//
// Avoid constructing migrations manually, use [NewGoMigration] function.
type Migration struct {
	Type    MigrationType
	Version int64
	// Source is the path to the .sql script or .go file. It may be empty for Go migrations that
	// have been registered globally and don't have a source file.
	Source string

	UpFnContext, DownFnContext         GoMigrationContext
	UpFnNoTxContext, DownFnNoTxContext GoMigrationNoTxContext

	// These fields will be removed in a future major version. They are here for backwards
	// compatibility and are an implementation detail.
	Registered bool
	UseTx      bool
	Next       int64 // next version, or -1 if none
	Previous   int64 // previous version, -1 if none

	// We still save the non-context versions in the struct in case someone is using them. Goose
	// does not use these internally anymore in favor of the context-aware versions. These fields
	// will be removed in a future major version.

	UpFn       GoMigration     // Deprecated: use UpFnContext instead.
	DownFn     GoMigration     // Deprecated: use DownFnContext instead.
	UpFnNoTx   GoMigrationNoTx // Deprecated: use UpFnNoTxContext instead.
	DownFnNoTx GoMigrationNoTx // Deprecated: use DownFnNoTxContext instead.

	noVersioning bool

	// These fields are used internally by goose and users are not expected to set them. Instead,
	// use [NewGoMigration] to create a new go migration.
	construct    bool
	goUp, goDown *GoFunc

	sql sqlMigration
}

type sqlMigration struct {
	// The Parsed field is used to track whether the SQL migration has been parsed. It serves as an
	// optimization to avoid parsing migrations that may never be needed. Typically, migrations are
	// incremental, and users often run only the most recent ones, making parsing of prior
	// migrations unnecessary in most cases.
	Parsed bool

	// Parsed must be set to true before the following fields are used.
	UseTx bool
	Up    []string
	Down  []string
}

// GoFunc represents a Go migration function.
type GoFunc struct {
	// Exactly one of these must be set, or both must be nil.
	RunTx func(ctx context.Context, tx *sql.Tx) error
	// -- OR --
	RunDB func(ctx context.Context, db *sql.DB) error

	// Mode is the transaction mode for the migration. When one of the run functions is set, the
	// mode will be inferred from the function and the field is ignored. Users do not need to set
	// this field when supplying a run function.
	//
	// If both run functions are nil, the mode defaults to TransactionEnabled. The use case for nil
	// functions is to record a version in the version table without invoking a Go migration
	// function.
	//
	// The only time this field is required is if BOTH run functions are nil AND you want to
	// override the default transaction mode.
	Mode TransactionMode
}

// TransactionMode represents the possible transaction modes for a migration.
type TransactionMode int

const (
	TransactionEnabled TransactionMode = iota + 1
	TransactionDisabled
)

func (m TransactionMode) String() string {
	switch m {
	case TransactionEnabled:
		return "transaction_enabled"
	case TransactionDisabled:
		return "transaction_disabled"
	default:
		return fmt.Sprintf("unknown transaction mode (%d)", m)
	}
}

// MigrationRecord struct.
//
// Deprecated: unused and will be removed in a future major version.
type MigrationRecord struct {
	VersionID int64
	TStamp    time.Time
	IsApplied bool // was this a result of up() or down()
}

func (m *Migration) String() string {
	return fmt.Sprint(m.Source)
}

// Up runs an up migration.
func (m *Migration) Up(db *sql.DB) error {
	ctx := context.Background()
	return m.UpContext(ctx, db)
}

// UpContext runs an up migration.
func (m *Migration) UpContext(ctx context.Context, db *sql.DB) error {
	if err := m.run(ctx, db, true); err != nil {
		return err
	}
	return nil
}

// Down runs a down migration.
func (m *Migration) Down(db *sql.DB) error {
	ctx := context.Background()
	return m.DownContext(ctx, db)
}

// DownContext runs a down migration.
func (m *Migration) DownContext(ctx context.Context, db *sql.DB) error {
	if err := m.run(ctx, db, false); err != nil {
		return err
	}
	return nil
}

func (m *Migration) run(ctx context.Context, db *sql.DB, direction bool) error {
	switch filepath.Ext(m.Source) {
	case ".sql":
		f, err := baseFS.Open(m.Source)
		if err != nil {
			return fmt.Errorf("ERROR %v: failed to open SQL migration file: %w", filepath.Base(m.Source), err)
		}
		defer f.Close()

		statements, useTx, err := sqlparser.ParseSQLMigration(f, sqlparser.FromBool(direction), verbose)
		if err != nil {
			return fmt.Errorf("ERROR %v: failed to parse SQL migration file: %w", filepath.Base(m.Source), err)
		}

		start := time.Now()
		if err := runSQLMigration(ctx, db, statements, useTx, m.Version, direction, m.noVersioning); err != nil {
			return fmt.Errorf("ERROR %v: failed to run SQL migration: %w", filepath.Base(m.Source), err)
		}
		finish := truncateDuration(time.Since(start))

		if len(statements) > 0 {
			log.Printf("OK   %s (%s)", filepath.Base(m.Source), finish)
		} else {
			log.Printf("EMPTY %s (%s)", filepath.Base(m.Source), finish)
		}

	case ".go":
		if !m.Registered {
			return fmt.Errorf("ERROR %v: failed to run Go migration: Go functions must be registered and built into a custom binary (see https://github.com/pressly/goose/tree/master/examples/go-migrations)", m.Source)
		}
		start := time.Now()
		var empty bool
		if m.UseTx {
			// Run go-based migration inside a tx.
			fn := m.DownFnContext
			if direction {
				fn = m.UpFnContext
			}
			empty = (fn == nil)
			if err := runGoMigration(
				ctx,
				db,
				fn,
				m.Version,
				direction,
				!m.noVersioning,
			); err != nil {
				return fmt.Errorf("ERROR go migration: %q: %w", filepath.Base(m.Source), err)
			}
		} else {
			// Run go-based migration outside a tx.
			fn := m.DownFnNoTxContext
			if direction {
				fn = m.UpFnNoTxContext
			}
			empty = (fn == nil)
			if err := runGoMigrationNoTx(
				ctx,
				db,
				fn,
				m.Version,
				direction,
				!m.noVersioning,
			); err != nil {
				return fmt.Errorf("ERROR go migration no tx: %q: %w", filepath.Base(m.Source), err)
			}
		}
		finish := truncateDuration(time.Since(start))
		if !empty {
			log.Printf("OK   %s (%s)", filepath.Base(m.Source), finish)
		} else {
			log.Printf("EMPTY %s (%s)", filepath.Base(m.Source), finish)
		}
	}
	return nil
}

func runGoMigrationNoTx(
	ctx context.Context,
	db *sql.DB,
	fn GoMigrationNoTxContext,
	version int64,
	direction bool,
	recordVersion bool,
) error {
	if fn != nil {
		// Run go migration function.
		if err := fn(ctx, db); err != nil {
			return fmt.Errorf("failed to run go migration: %w", err)
		}
	}
	if recordVersion {
		return insertOrDeleteVersionNoTx(ctx, db, version, direction)
	}
	return nil
}

func runGoMigration(
	ctx context.Context,
	db *sql.DB,
	fn GoMigrationContext,
	version int64,
	direction bool,
	recordVersion bool,
) error {
	if fn == nil && !recordVersion {
		return nil
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	if fn != nil {
		// Run go migration function.
		if err := fn(ctx, tx); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to run go migration: %w", err)
		}
	}
	if recordVersion {
		if err := insertOrDeleteVersion(ctx, tx, version, direction); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to update version: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

func insertOrDeleteVersion(ctx context.Context, tx *sql.Tx, version int64, direction bool) error {
	if direction {
		return store.InsertVersion(ctx, tx, TableName(), version)
	}
	return store.DeleteVersion(ctx, tx, TableName(), version)
}

func insertOrDeleteVersionNoTx(ctx context.Context, db *sql.DB, version int64, direction bool) error {
	if direction {
		return store.InsertVersionNoTx(ctx, db, TableName(), version)
	}
	return store.DeleteVersionNoTx(ctx, db, TableName(), version)
}

// NumericComponent parses the version from the migration file name.
//
// XXX_descriptivename.ext where XXX specifies the version number and ext specifies the type of
// migration, either .sql or .go.
func NumericComponent(filename string) (int64, error) {
	base := filepath.Base(filename)
	if ext := filepath.Ext(base); ext != ".go" && ext != ".sql" {
		return 0, errors.New("migration file does not have .sql or .go file extension")
	}
	idx := strings.Index(base, "_")
	if idx < 0 {
		return 0, errors.New("no filename separator '_' found")
	}
	n, err := strconv.ParseInt(base[:idx], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse version from migration file: %s: %w", base, err)
	}
	if n < 1 {
		return 0, errors.New("migration version must be greater than zero")
	}
	return n, nil
}

func truncateDuration(d time.Duration) time.Duration {
	for _, v := range []time.Duration{
		time.Second,
		time.Millisecond,
		time.Microsecond,
	} {
		if d > v {
			return d.Round(v / time.Duration(100))
		}
	}
	return d
}

// ref returns a string that identifies the migration. This is used for logging and error messages.
func (m *Migration) ref() string {
	return fmt.Sprintf("(type:%s,version:%d)", m.Type, m.Version)
}
