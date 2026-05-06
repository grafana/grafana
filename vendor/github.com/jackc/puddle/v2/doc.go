// Package puddle is a generic resource pool with type-parametrized api.
/*

Puddle is a tiny generic resource pool library for Go that uses the standard
context library to signal cancellation of acquires. It is designed to contain
the minimum functionality a resource pool needs that cannot be implemented
without concurrency concerns. For example, a database connection pool may use
puddle internally and implement health checks and keep-alive behavior without
needing to implement any concurrent code of its own.
*/
package puddle
