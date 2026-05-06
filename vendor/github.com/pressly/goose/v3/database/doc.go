// Package database defines a generic [Store] interface for goose to use when interacting with the
// database. It is meant to be generic and not tied to any specific database technology.
//
// At a high level, a [Store] is responsible for:
//   - Creating a version table
//   - Inserting and deleting a version
//   - Getting a specific version
//   - Listing all applied versions
//
// Use the [NewStore] function to create a [Store] for one of the supported dialects.
//
// For more advanced use cases, it's possible to implement a custom [Store] for a database that
// goose does not support.
package database
