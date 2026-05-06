package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.uber.org/multierr"
)

// NewPostgres creates a new Postgres-based [LockStore].
func NewPostgres(tableName string) (LockStore, error) {
	if tableName == "" {
		return nil, errors.New("table name must not be empty")
	}
	return &postgresStore{
		tableName: tableName,
	}, nil
}

var _ LockStore = (*postgresStore)(nil)

type postgresStore struct {
	tableName string
}

func (s *postgresStore) TableExists(
	ctx context.Context,
	db *sql.DB,
) (bool, error) {
	var query string
	schemaName, tableName := parseTableIdentifier(s.tableName)
	if schemaName != "" {
		q := `SELECT EXISTS ( SELECT 1 FROM pg_tables WHERE schemaname = '%s' AND tablename = '%s' )`
		query = fmt.Sprintf(q, schemaName, tableName)
	} else {
		q := `SELECT EXISTS ( SELECT 1 FROM pg_tables WHERE (current_schema() IS NULL OR schemaname = current_schema()) AND tablename = '%s' )`
		query = fmt.Sprintf(q, tableName)
	}

	var exists bool
	if err := db.QueryRowContext(ctx, query).Scan(
		&exists,
	); err != nil {
		return false, fmt.Errorf("table exists: %w", err)
	}
	return exists, nil
}

func (s *postgresStore) CreateLockTable(
	ctx context.Context,
	db *sql.DB,
) error {
	exists, err := s.TableExists(ctx, db)
	if err != nil {
		return fmt.Errorf("check lock table existence: %w", err)
	}
	if exists {
		return nil
	}

	query := fmt.Sprintf(`CREATE TABLE %s (
		lock_id bigint NOT NULL PRIMARY KEY,
		locked boolean NOT NULL DEFAULT false,
		locked_at timestamptz NULL,
		locked_by text NULL,
		lease_expires_at timestamptz NULL,
		updated_at timestamptz NULL
	)`, s.tableName)
	if _, err := db.ExecContext(ctx, query); err != nil {
		// Double-check if another process created it concurrently
		if exists, checkErr := s.TableExists(ctx, db); checkErr == nil && exists {
			// Another process created it, that's fine!
			return nil
		}
		return fmt.Errorf("create lock table %q: %w", s.tableName, err)
	}
	return nil
}

func (s *postgresStore) AcquireLock(
	ctx context.Context,
	db *sql.DB,
	lockID int64,
	lockedBy string,
	leaseDuration time.Duration,
) (*AcquireLockResult, error) {
	query := fmt.Sprintf(`INSERT INTO %s (lock_id, locked, locked_at, locked_by, lease_expires_at, updated_at)
	VALUES ($1, true, now(), $2, now() + $3::interval, now())
	ON CONFLICT (lock_id) DO UPDATE SET
		locked = true,
		locked_at = now(),
		locked_by = $2,
		lease_expires_at = now() + $3::interval,
		updated_at = now()
	WHERE %s.locked = false OR %s.lease_expires_at < now()
	RETURNING locked_by, lease_expires_at`, s.tableName, s.tableName, s.tableName)

	// Convert duration to PostgreSQL interval format
	leaseDurationStr := formatDurationAsInterval(leaseDuration)

	var returnedLockedBy string
	var leaseExpiresAt time.Time
	err := db.QueryRowContext(ctx, query,
		lockID,
		lockedBy,
		leaseDurationStr,
	).Scan(
		&returnedLockedBy,
		&leaseExpiresAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// TODO(mf): should we return a special error type here?
			return nil, fmt.Errorf("acquire lock %d: already held by another instance", lockID)
		}
		return nil, fmt.Errorf("acquire lock %d: %w", lockID, err)
	}

	// Verify we got the lock by checking the returned locked_by matches our instance ID
	if returnedLockedBy != lockedBy {
		return nil, fmt.Errorf("acquire lock %d: acquired by %s instead of %s", lockID, returnedLockedBy, lockedBy)
	}

	return &AcquireLockResult{
		LockedBy:       returnedLockedBy,
		LeaseExpiresAt: leaseExpiresAt,
	}, nil
}

func (s *postgresStore) ReleaseLock(
	ctx context.Context,
	db *sql.DB,
	lockID int64,
	lockedBy string,
) (*ReleaseLockResult, error) {
	// Release lock only if it's held by the current instance
	query := fmt.Sprintf(`UPDATE %s SET
		locked = false,
		locked_at = NULL,
		locked_by = NULL,
		lease_expires_at = NULL,
		updated_at = now()
	WHERE lock_id = $1 AND locked_by = $2
	RETURNING lock_id`, s.tableName)

	var returnedLockID int64
	err := db.QueryRowContext(ctx, query,
		lockID,
		lockedBy,
	).Scan(
		&returnedLockID,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// TODO(mf): should we return a special error type here?
			return nil, fmt.Errorf("release lock %d: not held by this instance", lockID)
		}
		return nil, fmt.Errorf("release lock %d: %w", lockID, err)
	}

	// Verify the correct lock was released
	if returnedLockID != lockID {
		return nil, fmt.Errorf("release lock %d: returned lock ID %d does not match", lockID, returnedLockID)
	}

	return &ReleaseLockResult{
		LockID: returnedLockID,
	}, nil
}

func (s *postgresStore) UpdateLease(
	ctx context.Context,
	db *sql.DB,
	lockID int64,
	lockedBy string,
	leaseDuration time.Duration,
) (*UpdateLeaseResult, error) {
	// Update lease expiration time for heartbeat, only if we own the lock
	query := fmt.Sprintf(`UPDATE %s SET
		lease_expires_at = now() + $1::interval,
		updated_at = now()
	WHERE lock_id = $2 AND locked_by = $3 AND locked = true
	RETURNING lease_expires_at`, s.tableName)

	// Convert duration to PostgreSQL interval format
	intervalStr := formatDurationAsInterval(leaseDuration)

	var leaseExpiresAt time.Time
	err := db.QueryRowContext(ctx, query,
		intervalStr,
		lockID,
		lockedBy,
	).Scan(
		&leaseExpiresAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("failed to update lease for lock %d: not held by this instance", lockID)
		}
		return nil, fmt.Errorf("failed to update lease for lock %d: %w", lockID, err)
	}

	return &UpdateLeaseResult{
		LeaseExpiresAt: leaseExpiresAt,
	}, nil
}

func (s *postgresStore) CheckLockStatus(
	ctx context.Context,
	db *sql.DB,
	lockID int64,
) (*LockStatus, error) {
	query := fmt.Sprintf(`SELECT locked, locked_by, lease_expires_at, updated_at FROM %s WHERE lock_id = $1`, s.tableName)
	var status LockStatus

	err := db.QueryRowContext(ctx, query,
		lockID,
	).Scan(
		&status.Locked,
		&status.LockedBy,
		&status.LeaseExpiresAt,
		&status.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("lock %d not found", lockID)
		}
		return nil, fmt.Errorf("check lock status for %d: %w", lockID, err)
	}

	return &status, nil
}

func (s *postgresStore) CleanupStaleLocks(ctx context.Context, db *sql.DB) (_ []int64, retErr error) {
	query := fmt.Sprintf(`UPDATE %s SET
		locked = false,
		locked_at = NULL,
		locked_by = NULL,
		lease_expires_at = NULL,
		updated_at = now()
	WHERE locked = true AND lease_expires_at < now()
	RETURNING lock_id`, s.tableName)

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("cleanup stale locks: %w", err)
	}
	defer func() {
		retErr = multierr.Append(retErr, rows.Close())
	}()

	var cleanedLocks []int64
	for rows.Next() {
		var lockID int64
		if err := rows.Scan(&lockID); err != nil {
			return nil, fmt.Errorf("scan cleaned lock ID: %w", err)
		}
		cleanedLocks = append(cleanedLocks, lockID)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate over cleaned locks: %w", err)
	}

	return cleanedLocks, nil
}

// formatDurationAsInterval converts a time.Duration to PostgreSQL interval format
func formatDurationAsInterval(d time.Duration) string {
	return fmt.Sprintf("%d seconds", int(d.Seconds()))
}

func parseTableIdentifier(name string) (schema, table string) {
	schema, table, found := strings.Cut(name, ".")
	if !found {
		return "", name
	}
	return schema, table
}
