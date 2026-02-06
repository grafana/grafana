package lock

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/pressly/goose/v3/lock/internal/store"
	"github.com/pressly/goose/v3/lock/internal/table"
	"github.com/sethvargo/go-retry"
)

// NewPostgresTableLocker returns a Locker that uses PostgreSQL table-based locking. It manages a
// single lock row and keeps the lock alive automatically.
//
// Default behavior:
//
//   - Lease (30s): How long the lock is valid if heartbeat stops
//   - Heartbeat (5s): How often the lock gets refreshed to keep it alive
//   - If the process dies, others can take the lock after lease expires
//
// Defaults:
//
//	Table: "goose_lock"
//	Lock ID: 4097083626 (crc64 of "goose")
//	Lock retry: 5s intervals, 5min timeout
//	Unlock retry: 2s intervals, 1min timeout
//
// Lock and Unlock both retry on failure. Lock stays alive automatically until released. All
// defaults can be overridden with options.
func NewPostgresTableLocker(options ...TableLockerOption) (Locker, error) {
	config := table.Config{
		TableName:         DefaultLockTableName,
		LockID:            DefaultLockID,
		LeaseDuration:     30 * time.Second,
		HeartbeatInterval: 5 * time.Second,
		LockTimeout: table.ProbeConfig{
			IntervalDuration: 5 * time.Second,
			FailureThreshold: 60, // 5 minutes total
		},
		UnlockTimeout: table.ProbeConfig{
			IntervalDuration: 2 * time.Second,
			FailureThreshold: 30, // 1 minute total
		},
	}
	for _, opt := range options {
		if err := opt.apply(&config); err != nil {
			return nil, err
		}
	}
	lockStore, err := store.NewPostgres(config.TableName)
	if err != nil {
		return nil, fmt.Errorf("create lock store: %w", err)
	}
	return table.New(lockStore, config), nil
}

// NewPostgresSessionLocker returns a SessionLocker that utilizes PostgreSQL's exclusive
// session-level advisory lock mechanism.
//
// This function creates a SessionLocker that can be used to acquire and release a lock for
// synchronization purposes. The lock acquisition is retried until it is successfully acquired or
// until the failure threshold is reached. The default lock duration is set to 5 minutes, and the
// default unlock duration is set to 1 minute.
//
// If you have long running migrations, you may want to increase the lock duration.
//
// See [SessionLockerOption] for options that can be used to configure the SessionLocker.
func NewPostgresSessionLocker(opts ...SessionLockerOption) (SessionLocker, error) {
	cfg := sessionLockerConfig{
		lockID: DefaultLockID,
		lockProbe: probe{
			intervalDuration: 5 * time.Second,
			failureThreshold: 60,
		},
		unlockProbe: probe{
			intervalDuration: 2 * time.Second,
			failureThreshold: 30,
		},
	}
	for _, opt := range opts {
		if err := opt.apply(&cfg); err != nil {
			return nil, err
		}
	}
	return &postgresSessionLocker{
		lockID: cfg.lockID,
		retryLock: retry.WithMaxRetries(
			cfg.lockProbe.failureThreshold,
			retry.NewConstant(cfg.lockProbe.intervalDuration),
		),
		retryUnlock: retry.WithMaxRetries(
			cfg.unlockProbe.failureThreshold,
			retry.NewConstant(cfg.unlockProbe.intervalDuration),
		),
	}, nil
}

type postgresSessionLocker struct {
	lockID      int64
	retryLock   retry.Backoff
	retryUnlock retry.Backoff
}

var _ SessionLocker = (*postgresSessionLocker)(nil)

func (l *postgresSessionLocker) SessionLock(ctx context.Context, conn *sql.Conn) error {
	return retry.Do(ctx, l.retryLock, func(ctx context.Context) error {
		row := conn.QueryRowContext(ctx, "SELECT pg_try_advisory_lock($1)", l.lockID)
		var locked bool
		if err := row.Scan(&locked); err != nil {
			return fmt.Errorf("failed to execute pg_try_advisory_lock: %w", err)
		}
		if locked {
			// A session-level advisory lock was acquired.
			return nil
		}
		// A session-level advisory lock could not be acquired. This is likely because another
		// process has already acquired the lock. We will continue retrying until the lock is
		// acquired or the maximum number of retries is reached.
		return retry.RetryableError(errors.New("failed to acquire lock"))
	})
}

func (l *postgresSessionLocker) SessionUnlock(ctx context.Context, conn *sql.Conn) error {
	return retry.Do(ctx, l.retryUnlock, func(ctx context.Context) error {
		var unlocked bool
		row := conn.QueryRowContext(ctx, "SELECT pg_advisory_unlock($1)", l.lockID)
		if err := row.Scan(&unlocked); err != nil {
			return fmt.Errorf("failed to execute pg_advisory_unlock: %w", err)
		}
		if unlocked {
			// A session-level advisory lock was released.
			return nil
		}
		/*
			docs(md): provide users with some documentation on how they can unlock the session
			manually.

			This is probably not an issue for 99.99% of users since pg_advisory_unlock_all() will
			release all session level advisory locks held by the current session. It is implicitly
			invoked at session end, even if the client disconnects ungracefully.

			Here is output from a session that has a lock held:

			SELECT pid, granted, ((classid::bigint << 32) | objid::bigint) AS goose_lock_id FROM
			pg_locks WHERE locktype = 'advisory';

			| pid | granted | goose_lock_id       |
			|-----|---------|---------------------|
			| 191 | t       | 4097083626          |

			A forceful way to unlock the session is to terminate the backend with SIGTERM:

			SELECT pg_terminate_backend(191);

			Subsequent commands on the same connection will fail with:

			Query 1 ERROR: FATAL: terminating connection due to administrator command
		*/
		return retry.RetryableError(errors.New("failed to unlock session"))
	})
}
