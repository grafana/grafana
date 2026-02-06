# pq - A pure Go postgres driver for Go's database/sql package

[![GoDoc](https://godoc.org/github.com/lib/pq?status.svg)](https://pkg.go.dev/github.com/lib/pq?tab=doc)

## Install

	go get github.com/lib/pq

## Features

* SSL
* Handles bad connections for `database/sql`
* Scan `time.Time` correctly (i.e. `timestamp[tz]`, `time[tz]`, `date`)
* Scan binary blobs correctly (i.e. `bytea`)
* Package for `hstore` support
* COPY FROM support
* pq.ParseURL for converting urls to connection strings for sql.Open.
* Many libpq compatible environment variables
* Unix socket support
* Notifications: `LISTEN`/`NOTIFY`
* pgpass support
* GSS (Kerberos) auth

## Tests

`go test` is used for testing.  See [TESTS.md](TESTS.md) for more details.

## Status

This package is currently in maintenance mode, which means:
1.   It generally does not accept new features.
2.   It does accept bug fixes and version compatability changes provided by the community.
3.   Maintainers usually do not resolve reported issues.
4.   Community members are encouraged to help each other with reported issues.

For users that require new features or reliable resolution of reported bugs, we recommend using [pgx](https://github.com/jackc/pgx) which is under active development.
