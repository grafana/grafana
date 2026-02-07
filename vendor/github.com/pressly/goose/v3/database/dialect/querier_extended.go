package dialect

// QuerierExtender extends the [Querier] interface with optional database-specific optimizations.
// While not required, implementing these methods can improve performance.
//
// IMPORTANT: This interface may be expanded in future versions. Implementors must be prepared to
// update their implementations when new methods are added.
//
// Example compile-time check:
//
//	var _ QuerierExtender = (*CustomQuerierExtended)(nil)
//
// In short, it's exported to allow implementors to have a compile-time check that they are
// implementing the interface correctly.
type QuerierExtender interface {
	Querier

	// TableExists returns a database-specific SQL query to check if a table exists. For example,
	// implementations might query system catalogs like pg_tables or sqlite_master. Return empty
	// string if not supported.
	TableExists(tableName string) string
}
