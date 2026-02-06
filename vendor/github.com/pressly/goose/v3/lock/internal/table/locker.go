package table

import (
	"cmp"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/pressly/goose/v3/lock/internal/store"
	"github.com/sethvargo/go-retry"
)

// RetryPolicyFunc inspects an error and returns whether the caller should retry the operation. This
// allows for database-specific error handling without hardcoding driver-specific logic.
type RetryPolicyFunc func(err error) bool

// Locker implements table-based locking for databases. This implementation is safe for concurrent
// use by multiple goroutines.
type Locker struct {
	store             store.LockStore
	tableName         string
	lockID            int64
	instanceID        string
	leaseDuration     time.Duration
	heartbeatInterval time.Duration
	retryLock         retry.Backoff
	retryUnlock       retry.Backoff
	logger            *slog.Logger
	retryPolicy       RetryPolicyFunc

	// Application-level coordination
	mu sync.Mutex

	// Heartbeat management
	heartbeatCancel context.CancelFunc
	heartbeatDone   chan struct{}
}

// New creates a new table-based locker.
func New(lockStore store.LockStore, cfg Config) *Locker {
	// Generate instance identifier
	hostname, _ := os.Hostname()
	hostname = cmp.Or(hostname, "unknown-hostname")
	instanceID := fmt.Sprintf("%s-%d-%s", hostname, os.Getpid(), randomHex(4))

	logger := cfg.Logger
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	}

	return &Locker{
		store:             lockStore,
		tableName:         cfg.TableName,
		lockID:            cfg.LockID,
		instanceID:        instanceID,
		leaseDuration:     cfg.LeaseDuration,
		heartbeatInterval: cfg.HeartbeatInterval,
		logger:            logger,
		retryPolicy:       cfg.RetryPolicy,
		retryLock: retry.WithMaxRetries(
			cfg.LockTimeout.FailureThreshold,
			// Add +/- 25% jitter to reduce thundering herd
			retry.WithJitterPercent(25, retry.NewConstant(cfg.LockTimeout.IntervalDuration)),
		),
		retryUnlock: retry.WithMaxRetries(
			cfg.UnlockTimeout.FailureThreshold,
			// Add +/- 25% jitter to reduce thundering herd
			retry.WithJitterPercent(25, retry.NewConstant(cfg.UnlockTimeout.IntervalDuration)),
		),
	}
}

// Lock acquires the database lock. This method is safe for concurrent use - the mutex is held until
// Unlock() is called. Only one goroutine can hold the lock at a time across the entire lifecycle.
func (l *Locker) Lock(ctx context.Context, db *sql.DB) error {
	l.mu.Lock()
	// NOTE: mutex is NOT defer unlocked here, it remains held until Unlock() is called explicitly
	// or a specific error occurs below!

	// Ensure the lock table exists
	if err := l.store.CreateLockTable(ctx, db); err != nil {
		l.mu.Unlock()
		return fmt.Errorf("ensure lock table exists: %w", err)
	}

	err := retry.Do(ctx, l.retryLock, func(ctx context.Context) error {
		_, err := l.store.AcquireLock(ctx, db, l.lockID, l.instanceID, l.leaseDuration)
		if err != nil {
			// Clean up any stale locks before retrying
			if _, cleanupErr := l.store.CleanupStaleLocks(ctx, db); cleanupErr != nil {
				l.logger.WarnContext(ctx, "failed to cleanup stale locks",
					slog.Int64("lock_table", l.lockID),
					slog.Any("error", cleanupErr),
				)
				// Continue with retry, cleanup failure shouldn't block acquisition attempts
			}
			if l.shouldRetry(err) {
				return retry.RetryableError(fmt.Errorf("acquire retryable lock: %w", err))
			}
			return fmt.Errorf("acquire lock: %w", err)
		}
		return nil
	})
	if err != nil {
		l.mu.Unlock()
		l.logger.WarnContext(ctx, "failed to acquire lock after retries",
			slog.Int64("lock_id", l.lockID),
			slog.String("instance_id", l.instanceID),
			slog.Any("error", err),
		)
		return fmt.Errorf("acquire lock %d after retries: %w", l.lockID, err)
	}

	l.logger.DebugContext(ctx, "successfully acquired lock",
		slog.Int64("lock_id", l.lockID),
		slog.String("instance_id", l.instanceID),
		slog.Duration("lease_duration", l.leaseDuration),
	)
	// Start heartbeat to maintain the lease
	l.startHeartbeat(ctx, db)

	// Mutex remains held - will be released in Unlock()
	return nil
}

// Unlock releases the database lock. This method must be called exactly once after a successful
// Lock() call.
func (l *Locker) Unlock(ctx context.Context, db *sql.DB) error {
	// NOTE: The mutex was acquired in Lock() and is still held
	defer l.mu.Unlock()

	// Use a context that can't be cancelled to ensure we always attempt to unlock even if the
	// caller's context is cancelled. The call can control the retry behavior via the configured
	// timeouts.
	ctx = context.WithoutCancel(ctx)

	// Stop heartbeat first
	l.stopHeartbeat()

	err := retry.Do(ctx, l.retryUnlock, func(ctx context.Context) error {
		_, err := l.store.ReleaseLock(ctx, db, l.lockID, l.instanceID)
		if err != nil {
			if l.shouldRetry(err) {
				return retry.RetryableError(fmt.Errorf("release retryable lock: %w", err))
			}
			return fmt.Errorf("release lock: %w", err)
		}
		return nil
	})
	if err != nil {
		l.logger.WarnContext(ctx, "failed to release lock",
			slog.Int64("lock_id", l.lockID),
			slog.String("instance_id", l.instanceID),
			slog.Any("error", err),
		)
		return err
	}

	l.logger.DebugContext(ctx, "successfully released lock",
		slog.Int64("lock_id", l.lockID),
		slog.String("instance_id", l.instanceID),
	)
	return nil
}

// startHeartbeat starts the heartbeat goroutine (called from within Lock with mutex held)
func (l *Locker) startHeartbeat(parentCtx context.Context, db *sql.DB) {
	// If there's already a heartbeat running, stop it first
	l.stopHeartbeat()

	// Create a new context for the heartbeat
	ctx, cancel := context.WithCancel(parentCtx)
	l.heartbeatCancel = cancel
	l.heartbeatDone = make(chan struct{})

	go func() {
		defer close(l.heartbeatDone)
		ticker := time.NewTicker(l.heartbeatInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				result, err := l.store.UpdateLease(ctx, db, l.lockID, l.instanceID, l.leaseDuration)
				if err != nil {
					// TODO(mf): should we add a retry policy here?
					l.logger.WarnContext(ctx, "heartbeat failed to update lease",
						slog.Int64("lock_id", l.lockID),
						slog.String("instance_id", l.instanceID),
						slog.Any("error", err),
					)
					continue
				}
				l.logger.DebugContext(ctx, "heartbeat updated lease",
					slog.Int64("lock_id", l.lockID),
					slog.String("instance_id", l.instanceID),
					slog.Time("lease_expires_at", result.LeaseExpiresAt),
				)
			}
		}
	}()
}

// stopHeartbeat stops the heartbeat goroutine (called from within Unlock with mutex held).
func (l *Locker) stopHeartbeat() {
	if l.heartbeatCancel != nil {
		l.heartbeatCancel()
		<-l.heartbeatDone
		l.heartbeatCancel = nil
		l.heartbeatDone = nil
	}
}

// shouldRetry determines whether an error is retryable based on the configured retry policy. If no
// retry policy is configured, it defaults to always retrying.
func (l *Locker) shouldRetry(err error) bool {
	if l.retryPolicy != nil {
		return l.retryPolicy(err)
	}
	return true
}

func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%0*x", n*2, time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}
