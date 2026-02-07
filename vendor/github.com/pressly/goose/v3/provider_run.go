package goose

import (
	"cmp"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"path/filepath"
	"runtime/debug"
	"slices"
	"time"

	"github.com/pressly/goose/v3/database"
	"github.com/pressly/goose/v3/internal/sqlparser"
	"github.com/sethvargo/go-retry"
	"go.uber.org/multierr"
)

var (
	errMissingZeroVersion = errors.New("missing zero version migration")
)

func (p *Provider) prepareMigration(fsys fs.FS, m *Migration, direction bool) error {
	switch m.Type {
	case TypeGo:
		if m.goUp.Mode == 0 {
			return errors.New("go up migration mode is not set")
		}
		if m.goDown.Mode == 0 {
			return errors.New("go down migration mode is not set")
		}
		var useTx bool
		if direction {
			useTx = m.goUp.Mode == TransactionEnabled
		} else {
			useTx = m.goDown.Mode == TransactionEnabled
		}
		// bug(mf): this is a potential deadlock scenario. We're running Go migrations with *sql.DB,
		// but are locking the database with *sql.Conn. If the caller sets max open connections to
		// 1, then this will deadlock because the Go migration will try to acquire a connection from
		// the pool, but the pool is exhausted because the lock is held.
		//
		// A potential solution is to expose a third Go register function *sql.Conn. Or continue to
		// use *sql.DB and document that the user SHOULD NOT SET max open connections to 1. This is
		// a bit of an edge case. For now, we guard against this scenario by checking the max open
		// connections and returning an error.
		if p.cfg.lockEnabled && p.cfg.sessionLocker != nil && p.db.Stats().MaxOpenConnections == 1 {
			if !useTx {
				return errors.New("potential deadlock detected: cannot run Go migration without a transaction when max open connections set to 1")
			}
		}
		return nil
	case TypeSQL:
		if m.sql.Parsed {
			return nil
		}
		parsed, err := sqlparser.ParseAllFromFS(fsys, m.Source, false)
		if err != nil {
			return err
		}
		m.sql.Parsed = true
		m.sql.UseTx = parsed.UseTx
		m.sql.Up, m.sql.Down = parsed.Up, parsed.Down
		return nil
	}
	return fmt.Errorf("invalid migration type: %+v", m)
}

func (p *Provider) logf(ctx context.Context, legacyMsg string, slogMsg string, attrs ...slog.Attr) {
	if !p.cfg.verbose {
		return
	}
	if p.cfg.slogger != nil {
		// Sort attributes by key for consistent ordering
		slices.SortFunc(attrs, func(a, b slog.Attr) int {
			return cmp.Compare(a.Key, b.Key)
		})
		// Use slog with structured attributes
		args := make([]any, 0, len(attrs)+1)
		// Add the logger=goose identifier
		args = append(args, slog.String("logger", "goose"))
		for _, attr := range attrs {
			args = append(args, attr)
		}
		p.cfg.slogger.InfoContext(ctx, slogMsg, args...)
	} else if p.cfg.logger != nil {
		p.cfg.logger.Printf("goose: %s", legacyMsg)
	}
}

// runMigrations runs migrations sequentially in the given direction. If the migrations list is
// empty, return nil without error.
func (p *Provider) runMigrations(
	ctx context.Context,
	conn *sql.Conn,
	migrations []*Migration,
	direction sqlparser.Direction,
	byOne bool,
) ([]*MigrationResult, error) {
	if len(migrations) == 0 {
		if !p.cfg.disableVersioning {
			// No need to print this message if versioning is disabled because there are no
			// migrations being tracked in the goose version table.
			maxVersion, err := p.getDBMaxVersion(ctx, conn)
			if err != nil {
				return nil, err
			}
			p.logf(ctx,
				fmt.Sprintf("no migrations to run, current version: %d", maxVersion),
				"no migrations to run",
				slog.Int64("current_version", maxVersion),
			)
		}
		return nil, nil
	}
	apply := migrations
	if byOne {
		apply = migrations[:1]
	}

	// SQL migrations are lazily parsed in both directions. This is done before attempting to run
	// any migrations to catch errors early and prevent leaving the database in an incomplete state.

	for _, m := range apply {
		if err := p.prepareMigration(p.fsys, m, direction.ToBool()); err != nil {
			return nil, fmt.Errorf("failed to prepare migration %s: %w", m.ref(), err)
		}
	}

	// feat(mf): If we decide to add support for advisory locks at the transaction level, this may
	// be a good place to acquire the lock. However, we need to be sure that ALL migrations are safe
	// to run in a transaction.

	// feat(mf): this is where we can (optionally) group multiple migrations to be run in a single
	// transaction. The default is to apply each migration sequentially on its own. See the
	// following issues for more details:
	//  - https://github.com/pressly/goose/issues/485
	//  - https://github.com/pressly/goose/issues/222
	//
	// Be careful, we can't use a single transaction for all migrations because some may be marked
	// as not using a transaction.

	var results []*MigrationResult
	for _, m := range apply {
		result := &MigrationResult{
			Source: &Source{
				Type:    m.Type,
				Path:    m.Source,
				Version: m.Version,
			},
			Direction: direction.String(),
			Empty:     isEmpty(m, direction.ToBool()),
		}
		start := time.Now()
		if err := p.runIndividually(ctx, conn, m, direction.ToBool()); err != nil {
			// TODO(mf): we should also return the pending migrations here, the remaining items in
			// the apply slice.
			result.Error = err
			result.Duration = time.Since(start)
			return nil, &PartialError{
				Applied: results,
				Failed:  result,
				Err:     err,
			}
		}
		result.Duration = time.Since(start)
		results = append(results, result)
		// Log the result of the migration.
		var state string
		if result.Empty {
			state = "empty"
		} else {
			state = "applied"
		}
		p.logf(ctx,
			result.String(),
			"migration completed",
			slog.String("source", filepath.Base(result.Source.Path)),
			slog.String("direction", result.Direction),
			slog.Float64("duration_seconds", result.Duration.Seconds()),
			slog.String("state", state),
			slog.Int64("version", result.Source.Version),
			slog.String("type", string(result.Source.Type)),
		)
	}
	if !p.cfg.disableVersioning && !byOne {
		maxVersion, err := p.getDBMaxVersion(ctx, conn)
		if err != nil {
			return nil, err
		}
		p.logf(ctx,
			fmt.Sprintf("successfully migrated database, current version: %d", maxVersion),
			"successfully migrated database",
			slog.Int64("current_version", maxVersion),
		)
	}
	return results, nil
}

func (p *Provider) runIndividually(
	ctx context.Context,
	conn *sql.Conn,
	m *Migration,
	direction bool,
) error {
	useTx, err := useTx(m, direction)
	if err != nil {
		return err
	}
	if useTx && !p.cfg.isolateDDL {
		return beginTx(ctx, conn, func(tx *sql.Tx) error {
			if err := p.runMigration(ctx, tx, m, direction); err != nil {
				return err
			}
			return p.maybeInsertOrDelete(ctx, tx, m.Version, direction)
		})
	}
	switch m.Type {
	case TypeGo:
		// Note, we are using *sql.DB instead of *sql.Conn because it's the Go migration contract.
		// This may be a deadlock scenario if max open connections is set to 1 AND a lock is
		// acquired on the database. In this case, the migration will block forever unable to
		// acquire a connection from the pool.
		//
		// For now, we guard against this scenario by checking the max open connections and
		// returning an error in the prepareMigration function.
		if err := p.runMigration(ctx, p.db, m, direction); err != nil {
			return err
		}
		return p.maybeInsertOrDelete(ctx, p.db, m.Version, direction)
	case TypeSQL:
		if err := p.runMigration(ctx, conn, m, direction); err != nil {
			return err
		}
		return p.maybeInsertOrDelete(ctx, conn, m.Version, direction)
	}
	return fmt.Errorf("failed to run individual migration: neither sql or go: %v", m)
}

func (p *Provider) maybeInsertOrDelete(
	ctx context.Context,
	db database.DBTxConn,
	version int64,
	direction bool,
) error {
	// If versioning is disabled, we don't need to insert or delete the migration version.
	if p.cfg.disableVersioning {
		return nil
	}
	if direction {
		return p.store.Insert(ctx, db, database.InsertRequest{Version: version})
	}
	return p.store.Delete(ctx, db, version)
}

// beginTx begins a transaction and runs the given function. If the function returns an error, the
// transaction is rolled back. Otherwise, the transaction is committed.
func beginTx(ctx context.Context, conn *sql.Conn, fn func(tx *sql.Tx) error) (retErr error) {
	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if retErr != nil {
			retErr = multierr.Append(retErr, tx.Rollback())
		}
	}()
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}

func (p *Provider) initialize(ctx context.Context, useLocker bool) (*sql.Conn, func() error, error) {
	p.mu.Lock()
	conn, err := p.db.Conn(ctx)
	if err != nil {
		p.mu.Unlock()
		return nil, nil, err
	}
	// cleanup is a function that cleans up the connection, and optionally, the lock.
	cleanup := func() error {
		p.mu.Unlock()
		return conn.Close()
	}

	// Handle locking if enabled and requested
	if useLocker && p.cfg.lockEnabled {
		// Session locker (connection-based locking)
		if p.cfg.sessionLocker != nil {
			l := p.cfg.sessionLocker
			if err := l.SessionLock(ctx, conn); err != nil {
				return nil, nil, multierr.Append(err, cleanup())
			}
			// A lock was acquired, so we need to unlock the session when we're done. This is done
			// by returning a cleanup function that unlocks the session and closes the connection.
			cleanup = func() error {
				p.mu.Unlock()
				// Use a detached context to unlock the session. This is because the context passed
				// to SessionLock may have been canceled, and we don't want to cancel the unlock.
				return multierr.Append(
					l.SessionUnlock(context.WithoutCancel(ctx), conn),
					conn.Close(),
				)
			}
		}
		// General locker (db-based locking)
		if p.cfg.locker != nil {
			l := p.cfg.locker
			if err := l.Lock(ctx, p.db); err != nil {
				return nil, nil, multierr.Append(err, cleanup())
			}
			// A lock was acquired, so we need to unlock when we're done.
			cleanup = func() error {
				p.mu.Unlock()
				// Use a detached context to unlock. This is because the context passed to Lock may
				// have been canceled, and we don't want to cancel the unlock.
				return multierr.Append(
					l.Unlock(context.WithoutCancel(ctx), p.db),
					conn.Close(),
				)
			}
		}
	}
	// If versioning is enabled, ensure the version table exists. For ad-hoc migrations, we don't
	// need the version table because no versions are being tracked.
	if !p.cfg.disableVersioning {
		if err := p.ensureVersionTable(ctx, conn); err != nil {
			return nil, nil, multierr.Append(err, cleanup())
		}
	}
	return conn, cleanup, nil
}

func (p *Provider) ensureVersionTable(
	ctx context.Context,
	conn *sql.Conn,
) (retErr error) {
	// There are 2 optimizations here:
	//  - 1. We create the version table once per Provider instance.
	//  - 2. We retry the operation a few times in case the table is being created concurrently.
	//
	// Regarding item 2, certain goose operations, like HasPending, don't respect a SessionLocker.
	// So, when goose is run for the first time in a multi-instance environment, it's possible that
	// multiple instances will try to create the version table at the same time. This is why we
	// retry this operation a few times. Best case, the table is created by one instance and all the
	// other instances see that change immediately. Worst case, all instances try to create the
	// table at the same time, but only one will succeed and the others will retry.
	p.versionTableOnce.Do(func() {
		retErr = p.tryEnsureVersionTable(ctx, conn)
	})
	return retErr
}

func (p *Provider) tryEnsureVersionTable(ctx context.Context, conn *sql.Conn) error {
	b := retry.NewConstant(1 * time.Second)
	b = retry.WithMaxRetries(3, b)
	return retry.Do(ctx, b, func(ctx context.Context) error {
		exists, err := p.store.TableExists(ctx, conn)
		if err == nil && exists {
			return nil
		} else if err != nil && errors.Is(err, errors.ErrUnsupported) {
			// Fallback strategy for checking table existence:
			//
			// When direct table existence checks aren't supported, we attempt to query the initial
			// migration (version 0). This approach has two implications:
			//
			//  1. If the table exists, the query succeeds and confirms existence
			//  2. If the table doesn't exist, the query fails and generates an error log
			//
			// Note: This check must occur outside any transaction, as a failed query would
			// otherwise cause the entire transaction to roll back. The error logs generated by this
			// approach are expected and can be safely ignored.
			if res, err := p.store.GetMigration(ctx, conn, 0); err == nil && res != nil {
				return nil
			}
			// Fallthrough to create the table.
		} else if err != nil {
			return fmt.Errorf("check if version table exists: %w", err)
		}

		if p.cfg.isolateDDL {
			// If isolation is enabled, we create the version table separately to ensure subsequent
			// DML operations are not mixed with DDL.
			if err := p.store.CreateVersionTable(ctx, conn); err != nil {
				return retry.RetryableError(fmt.Errorf("create version table: %w", err))
			}
			if err := p.store.Insert(ctx, conn, database.InsertRequest{Version: 0}); err != nil {
				return retry.RetryableError(fmt.Errorf("insert zero version: %w", err))
			}
		} else {
			// If DDL isolation is not enabled, we can create the version table and insert the zero
			// version in a single transaction.
			if err := beginTx(ctx, conn, func(tx *sql.Tx) error {
				if err := p.store.CreateVersionTable(ctx, tx); err != nil {
					return err
				}
				return p.store.Insert(ctx, tx, database.InsertRequest{Version: 0})
			}); err != nil {
				// Mark the error as retryable so we can try again. It's possible that another
				// instance is creating the table at the same time and the checks above will succeed
				// on the next iteration.
				return retry.RetryableError(fmt.Errorf("create version table: %w", err))
			}
		}

		return nil
	})
}

// getMigration returns the migration for the given version. If no migration is found, then
// ErrVersionNotFound is returned.
func (p *Provider) getMigration(version int64) (*Migration, error) {
	for _, m := range p.migrations {
		if m.Version == version {
			return m, nil
		}
	}
	return nil, ErrVersionNotFound
}

// useTx is a helper function that returns true if the migration should be run in a transaction. It
// must only be called after the migration has been parsed and initialized.
func useTx(m *Migration, direction bool) (bool, error) {
	switch m.Type {
	case TypeGo:
		if m.goUp.Mode == 0 || m.goDown.Mode == 0 {
			return false, fmt.Errorf("go migrations must have a mode set")
		}
		if direction {
			return m.goUp.Mode == TransactionEnabled, nil
		}
		return m.goDown.Mode == TransactionEnabled, nil
	case TypeSQL:
		if !m.sql.Parsed {
			return false, fmt.Errorf("sql migrations must be parsed")
		}
		return m.sql.UseTx, nil
	}
	return false, fmt.Errorf("use tx: invalid migration type: %q", m.Type)
}

// isEmpty is a helper function that returns true if the migration has no functions or no statements
// to execute. It must only be called after the migration has been parsed and initialized.
func isEmpty(m *Migration, direction bool) bool {
	switch m.Type {
	case TypeGo:
		if direction {
			return m.goUp.RunTx == nil && m.goUp.RunDB == nil
		}
		return m.goDown.RunTx == nil && m.goDown.RunDB == nil
	case TypeSQL:
		if direction {
			return len(m.sql.Up) == 0
		}
		return len(m.sql.Down) == 0
	}
	return true
}

// runMigration is a helper function that runs the migration in the given direction. It must only be
// called after the migration has been parsed and initialized.
func (p *Provider) runMigration(ctx context.Context, db database.DBTxConn, m *Migration, direction bool) error {
	switch m.Type {
	case TypeGo:
		return p.runGo(ctx, db, m, direction)
	case TypeSQL:
		return p.runSQL(ctx, db, m, direction)
	}
	return fmt.Errorf("invalid migration type: %q", m.Type)
}

// runGo is a helper function that runs the given Go functions in the given direction. It must only
// be called after the migration has been initialized.
func (p *Provider) runGo(ctx context.Context, db database.DBTxConn, m *Migration, direction bool) (retErr error) {
	defer func() {
		if r := recover(); r != nil {
			retErr = fmt.Errorf("panic: %v\n%s", r, debug.Stack())
		}
	}()

	switch db := db.(type) {
	case *sql.Conn:
		return fmt.Errorf("go migrations are not supported with *sql.Conn")
	case *sql.DB:
		if direction && m.goUp.RunDB != nil {
			return m.goUp.RunDB(ctx, db)
		}
		if !direction && m.goDown.RunDB != nil {
			return m.goDown.RunDB(ctx, db)
		}
		return nil
	case *sql.Tx:
		if direction && m.goUp.RunTx != nil {
			return m.goUp.RunTx(ctx, db)
		}
		if !direction && m.goDown.RunTx != nil {
			return m.goDown.RunTx(ctx, db)
		}
		return nil
	}
	return fmt.Errorf("invalid database connection type: %T", db)
}

// runSQL is a helper function that runs the given SQL statements in the given direction. It must
// only be called after the migration has been parsed.
func (p *Provider) runSQL(ctx context.Context, db database.DBTxConn, m *Migration, direction bool) error {
	if !m.sql.Parsed {
		return fmt.Errorf("sql migrations must be parsed")
	}
	var statements []string
	if direction {
		statements = m.sql.Up
	} else {
		statements = m.sql.Down
	}
	for _, stmt := range statements {
		p.logf(ctx,
			fmt.Sprintf("Executing statement: %s", stmt),
			"executing statement",
			slog.String("statement", stmt),
			slog.String("source", filepath.Base(m.Source)),
			slog.Int64("version", m.Version),
			slog.String("type", string(m.Type)),
			slog.String("direction", string(sqlparser.FromBool(direction))),
		)
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}
