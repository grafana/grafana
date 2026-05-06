package database

import "context"

// StoreExtender is an extension of the Store interface that provides optional optimizations and
// database-specific features. While not required by the core goose package, implementing these
// methods can improve performance and functionality for specific databases.
//
// IMPORTANT: This interface may be expanded in future versions. Implementors MUST be prepared to
// update their implementations when new methods are added, either by implementing the new
// functionality or returning [errors.ErrUnsupported].
//
// The goose package handles these extended capabilities through a [controller.StoreController],
// which automatically uses optimized methods when available while falling back to default behavior
// when they're not implemented.
//
// Example usage to verify implementation:
//
//	var _ StoreExtender = (*CustomStoreExtended)(nil)
//
// In short, it's exported to allows implementors to have a compile-time check that they are
// implementing the interface correctly.
type StoreExtender interface {
	Store

	// TableExists checks if the migrations table exists in the database. Implementing this method
	// allows goose to optimize table existence checks by using database-specific system catalogs
	// (e.g., pg_tables for PostgreSQL, sqlite_master for SQLite) instead of generic SQL queries.
	//
	// Return [errors.ErrUnsupported] if the database does not provide an efficient way to check
	// table existence.
	TableExists(ctx context.Context, db DBTxConn) (bool, error)
}
