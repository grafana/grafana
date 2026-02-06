package store

import (
	"context"
	"database/sql"
	"time"
)

// LockStore defines the interface for storing and managing database locks.
type LockStore interface {
	// CreateLockTable creates the lock table if it doesn't exist. Implementations should ensure
	// that this operation is idempotent.
	CreateLockTable(ctx context.Context, db *sql.DB) error
	// TableExists checks if the lock table exists.
	TableExists(ctx context.Context, db *sql.DB) (bool, error)
	// AcquireLock attempts to acquire a lock for the given lockID.
	AcquireLock(ctx context.Context, db *sql.DB, lockID int64, lockedBy string, leaseDuration time.Duration) (*AcquireLockResult, error)
	// ReleaseLock releases a lock held by the current instance.
	ReleaseLock(ctx context.Context, db *sql.DB, lockID int64, lockedBy string) (*ReleaseLockResult, error)
	// UpdateLease updates the lease expiration time for a lock (heartbeat).
	UpdateLease(ctx context.Context, db *sql.DB, lockID int64, lockedBy string, leaseDuration time.Duration) (*UpdateLeaseResult, error)
	// CheckLockStatus checks the current status of a lock.
	CheckLockStatus(ctx context.Context, db *sql.DB, lockID int64) (*LockStatus, error)
	// CleanupStaleLocks removes any locks that have expired using server time. Returns the list of
	// lock IDs that were cleaned up, if any.
	CleanupStaleLocks(ctx context.Context, db *sql.DB) ([]int64, error)
}

// LockStatus represents the current status of a lock.
type LockStatus struct {
	Locked         bool
	LockedBy       *string
	LeaseExpiresAt *time.Time
	UpdatedAt      *time.Time
}

// AcquireLockResult contains the result of a lock acquisition attempt.
type AcquireLockResult struct {
	LockedBy       string
	LeaseExpiresAt time.Time
}

// ReleaseLockResult contains the result of a lock release.
type ReleaseLockResult struct {
	LockID int64
}

// UpdateLeaseResult contains the result of a lease update.
type UpdateLeaseResult struct {
	LeaseExpiresAt time.Time
}
