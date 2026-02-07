# sqlstats

[![GoDoc](https://godoc.org/github.com/dlmiddlecote/sqlstats?status.svg)](http://godoc.org/github.com/dlmiddlecote/sqlstats)
[![Go Report Card](https://goreportcard.com/badge/github.com/dlmiddlecote/sqlstats)](https://goreportcard.com/report/github.com/dlmiddlecote/sqlstats)
[![License](https://img.shields.io/github/license/dlmiddlecote/sqlstats.svg)](https://github.com/dlmiddlecote/sqlstats/blob/master/LICENSE)

A Go library for collecting [sql.DBStats](https://golang.org/pkg/database/sql/#DBStats) and exporting them in Prometheus format.

A [sql.DB](https://golang.org/pkg/database/sql/#DB) object represents a pool of zero or more underlying
connections that get created and freed automatically. Connections in the pool may also be idle. There are a few settings
([SetMaxOpenConns()](https://golang.org/pkg/database/sql/#DB.SetMaxOpenConns), [SetMaxIdleConns()](https://golang.org/pkg/database/sql/#DB.SetMaxIdleConns)
and [SetConnMaxLifetime()](https://golang.org/pkg/database/sql/#DB.SetConnMaxLifetime)) that can be used to control the
pool of connections. This library exposes stats about this pool in Prometheus format, to aid with understanding of the pool.

## Installation

```bash
go get github.com/dlmiddlecote/sqlstats
```

## Example

```go
package main

import (
	"database/sql"
	"net/http"

	_ "github.com/lib/pq"
	"github.com/dlmiddlecote/sqlstats"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	if err := run(); err != nil {
		panic(err)
	}
}

func run() error {
	// Open connection to a DB (could also use the https://github.com/jmoiron/sqlx library)
	db, err := sql.Open("postgres", "postgres://postgres:postgres@localhost:5432/postgres")
	if err != nil {
		return err
	}

	// Create a new collector, the name will be used as a label on the metrics
	collector := sqlstats.NewStatsCollector("db_name", db)

	// Register it with Prometheus
	prometheus.MustRegister(collector)

	// Register the metrics handler
	http.Handle("/metrics", promhttp.Handler())

	// Run the web server
	return http.ListenAndServe(":8080", nil)
}
```

## Exposed Metrics

| Name                                          | Description                                                       | Labels  | Go Version |
|-----------------------------------------------|-------------------------------------------------------------------|---------|------------|
| go_sql_stats_connections_max_open             | Maximum number of open connections to the database.               | db_name | 1.11+      |
| go_sql_stats_connections_open                 | The number of established connections both in use and idle.       | db_name | 1.11+      |
| go_sql_stats_connections_in_use               | The number of connections currently in use.                       | db_name | 1.11+      |
| go_sql_stats_connections_idle                 | The number of idle connections.                                   | db_name | 1.11+      |
| go_sql_stats_connections_waited_for           | The total number of connections waited for.                       | db_name | 1.11+      |
| go_sql_stats_connections_blocked_seconds      | The total time blocked waiting for a new connection.              | db_name | 1.11+      |
| go_sql_stats_connections_closed_max_idle      | The total number of connections closed due to SetMaxIdleConns.    | db_name | 1.11+      |
| go_sql_stats_connections_closed_max_lifetime  | The total number of connections closed due to SetConnMaxLifetime. | db_name | 1.11+      |
| go_sql_stats_connections_closed_max_idle_time | The total number of connections closed due to SetConnMaxIdleTime. | db_name | 1.15+      |
