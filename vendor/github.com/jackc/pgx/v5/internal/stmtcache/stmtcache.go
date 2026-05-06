// Package stmtcache is a cache for statement descriptions.
package stmtcache

import (
	"crypto/sha256"
	"encoding/hex"

	"github.com/jackc/pgx/v5/pgconn"
)

// StatementName returns a statement name that will be stable for sql across multiple connections and program
// executions.
func StatementName(sql string) string {
	digest := sha256.Sum256([]byte(sql))
	return "stmtcache_" + hex.EncodeToString(digest[0:24])
}

// Cache caches statement descriptions.
type Cache interface {
	// Get returns the statement description for sql. Returns nil if not found.
	Get(sql string) *pgconn.StatementDescription

	// Put stores sd in the cache. Put panics if sd.SQL is "". Put does nothing if sd.SQL already exists in the cache.
	Put(sd *pgconn.StatementDescription)

	// Invalidate invalidates statement description identified by sql. Does nothing if not found.
	Invalidate(sql string)

	// InvalidateAll invalidates all statement descriptions.
	InvalidateAll()

	// GetInvalidated returns a slice of all statement descriptions invalidated since the last call to RemoveInvalidated.
	GetInvalidated() []*pgconn.StatementDescription

	// RemoveInvalidated removes all invalidated statement descriptions. No other calls to Cache must be made between a
	// call to GetInvalidated and RemoveInvalidated or RemoveInvalidated may remove statement descriptions that were
	// never seen by the call to GetInvalidated.
	RemoveInvalidated()

	// Len returns the number of cached prepared statement descriptions.
	Len() int

	// Cap returns the maximum number of cached prepared statement descriptions.
	Cap() int
}
