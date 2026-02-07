// Package pgconn is a low-level PostgreSQL database driver.
/*
pgconn provides lower level access to a PostgreSQL connection than a database/sql or pgx connection. It operates at
nearly the same level is the C library libpq.

Establishing a Connection

Use Connect to establish a connection. It accepts a connection string in URL or keyword/value format and will read the
environment for libpq style environment variables.

Executing a Query

ExecParams and ExecPrepared execute a single query. They return readers that iterate over each row. The Read method
reads all rows into memory.

Executing Multiple Queries in a Single Round Trip

Exec and ExecBatch can execute multiple queries in a single round trip. They return readers that iterate over each query
result. The ReadAll method reads all query results into memory.

Pipeline Mode

Pipeline mode allows sending queries without having read the results of previously sent queries. It allows control of
exactly how many and when network round trips occur.

Context Support

All potentially blocking operations take a context.Context. The default behavior when a context is canceled is for the
method to immediately return. In most circumstances, this will also close the underlying connection. This behavior can
be customized by using BuildContextWatcherHandler on the Config to create a ctxwatch.Handler with different behavior.
This can be especially useful when queries that are frequently canceled and the overhead of creating new connections is
a problem. DeadlineContextWatcherHandler and CancelRequestContextWatcherHandler can be used to introduce a delay before
interrupting the query in such a way as to close the connection.

The CancelRequest method may be used to request the PostgreSQL server cancel an in-progress query without forcing the
client to abort.
*/
package pgconn
