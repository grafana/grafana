package dialect

// Querier is the interface that wraps the basic methods to create a dialect specific query.
//
// It is intended tio be using with [database.NewStoreFromQuerier] to create a new [database.Store]
// implementation based on a custom querier.
type Querier interface {
	// CreateTable returns the SQL query string to create the db version table.
	CreateTable(tableName string) string
	// InsertVersion returns the SQL query string to insert a new version into the db version table.
	InsertVersion(tableName string) string
	// DeleteVersion returns the SQL query string to delete a version from the db version table.
	DeleteVersion(tableName string) string
	// GetMigrationByVersion returns the SQL query string to get a single migration by version.
	//
	// The query should return the timestamp and is_applied columns.
	GetMigrationByVersion(tableName string) string
	// ListMigrations returns the SQL query string to list all migrations in descending order by id.
	//
	// The query should return the version_id and is_applied columns.
	ListMigrations(tableName string) string
	// GetLatestVersion returns the SQL query string to get the last version_id from the db version
	// table. Returns a nullable int64 value.
	GetLatestVersion(tableName string) string
}
