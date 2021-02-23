# sqlhooks [![Build Status](https://travis-ci.org/gchaincl/sqlhooks.svg)](https://travis-ci.org/gchaincl/sqlhooks) [![Coverage Status](https://coveralls.io/repos/github/gchaincl/sqlhooks/badge.svg?branch=master)](https://coveralls.io/github/gchaincl/sqlhooks?branch=master) [![Go Report Card](https://goreportcard.com/badge/github.com/gchaincl/sqlhooks)](https://goreportcard.com/report/github.com/gchaincl/sqlhooks)

Attach hooks to any database/sql driver.

The purpose of sqlhooks is to provide a way to instrument your sql statements, making really easy to log queries or measure execution time without modifying your actual code.

# Install
```bash
go get github.com/gchaincl/sqlhooks
```
Requires Go >= 1.8.x

## Breaking changes
`V1` isn't backward compatible with previous versions, if you want to fetch old versions, you can get them from [gopkg.in](http://gopkg.in/)
```bash
go get gopkg.in/gchaincl/sqlhooks.v0
```

# Usage [![GoDoc](https://godoc.org/github.com/gchaincl/dotsql?status.svg)](https://godoc.org/github.com/gchaincl/sqlhooks)

```go
// This example shows how to instrument sql queries in order to display the time that they consume
package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/gchaincl/sqlhooks"
	"github.com/mattn/go-sqlite3"
)

// Hooks satisfies the sqlhook.Hooks interface
type Hooks struct {}

// Before hook will print the query with it's args and return the context with the timestamp
func (h *Hooks) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	fmt.Printf("> %s %q", query, args)
	return context.WithValue(ctx, "begin", time.Now()), nil
}

// After hook will get the timestamp registered on the Before hook and print the elapsed time
func (h *Hooks) After(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	begin := ctx.Value("begin").(time.Time)
	fmt.Printf(". took: %s\n", time.Since(begin))
	return ctx, nil
}

func main() {
	// First, register the wrapper
	sql.Register("sqlite3WithHooks", sqlhooks.Wrap(&sqlite3.SQLiteDriver{}, &Hooks{}))

	// Connect to the registered wrapped driver
	db, _ := sql.Open("sqlite3WithHooks", ":memory:")

	// Do you're stuff
	db.Exec("CREATE TABLE t (id INTEGER, text VARCHAR(16))")
	db.Exec("INSERT into t (text) VALUES(?), (?)", "foo", "bar")
	db.Query("SELECT id, text FROM t")
}

/*
Output should look like:
> CREATE TABLE t (id INTEGER, text VARCHAR(16)) []. took: 121.238µs
> INSERT into t (text) VALUES(?), (?) ["foo" "bar"]. took: 36.364µs
> SELECT id, text FROM t []. took: 4.653µs
*/
```

# Benchmarks
```
 go test -bench=. -benchmem
 BenchmarkSQLite3/Without_Hooks-4                  200000              8572 ns/op             627 B/op         16 allocs/op
 BenchmarkSQLite3/With_Hooks-4                     200000             10231 ns/op             738 B/op         18 allocs/op
 BenchmarkMySQL/Without_Hooks-4                     10000            108421 ns/op             437 B/op         10 allocs/op
 BenchmarkMySQL/With_Hooks-4                        10000            226085 ns/op             597 B/op         13 allocs/op
 BenchmarkPostgres/Without_Hooks-4                  10000            125718 ns/op             649 B/op         17 allocs/op
 BenchmarkPostgres/With_Hooks-4                      5000            354831 ns/op            1122 B/op         27 allocs/op
 PASS
 ok      github.com/gchaincl/sqlhooks    11.713s
 ```
