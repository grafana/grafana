// Package lock defines the Locker interface and implements the locking logic.
package lock

import (
	"context"
	"database/sql"
	"errors"
)

var (
	// ErrLockNotImplemented is returned when the database does not support locking.
	ErrLockNotImplemented = errors.New("lock not implemented")
	// ErrUnlockNotImplemented is returned when the database does not support unlocking.
	ErrUnlockNotImplemented = errors.New("unlock not implemented")
)

// SessionLocker is the interface to lock and unlock the database for the duration of a session. The
// session is defined as the duration of a single connection and both methods must be called on the
// same connection.
type SessionLocker interface {
	SessionLock(ctx context.Context, conn *sql.Conn) error
	SessionUnlock(ctx context.Context, conn *sql.Conn) error
}

// Locker is the interface to lock and unlock the database.
//
// Unlike [SessionLocker], the Lock and Unlock methods are called on a [*sql.DB] and do not require
// the same connection to be used for both methods.
type Locker interface {
	Lock(ctx context.Context, db *sql.DB) error
	Unlock(ctx context.Context, db *sql.DB) error
}
