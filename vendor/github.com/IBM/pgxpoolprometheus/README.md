[![Build Status](https://app.travis-ci.com/github/IBM/pgxpoolprometheus.svg?branch=main)](https://app.travis-ci.com/github/IBM/pgxpoolprometheus)
[![Release](https://img.shields.io/github/v/release/IBM/pgxpoolprometheus)](https://github.com/IBM/pgxpoolprometheus/releases/latest)
![GitHub go.mod Go version](https://img.shields.io/github/go-mod/go-version/IBM/pgxpoolprometheus)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Prometheus Collector for PGX Pool

This is a [Prometheus Collector](https://pkg.go.dev/github.com/prometheus/client_golang/prometheus#Collector) for [PGX Pool](https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool).

## Example Usage

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/IBM/pgxpoolprometheus"
)

func main() {
	pool, err := pgxpool.Connect(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}

	collector := pgxpoolprometheus.NewCollector(pool, map[string]string{"db_name": "my_db"})
	prometheus.MustRegister(collector)

	http.Handle("/metrics", promhttp.Handler())
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

## Metrics Collected

This collector provides metrics for all the stats produced by [pgxpool.Stat](https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool#Stat) all prefixed with `pgxpool`:

| Name                           | Description                                                                                                                                |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| pgxpool_acquire_count          | Cumulative count of successful acquires from the pool.                                                                                     |
| pgxpool_acquire_duration_ns    | Total duration of all successful acquires from the pool in nanoseconds.                                                                    |
| pgxpool_acquired_conns         | Number of currently acquired connections in the pool.                                                                                      |
| pgxpool_canceled_acquire_count | Cumulative count of acquires from the pool that were canceled by a context.                                                                |
| pgxpool_constructing_conns     | Number of conns with construction in progress in the pool.                                                                                 |
| pgxpool_empty_acquire          | Cumulative count of successful acquires from the pool that waited for a resource to be released or constructed because the pool was empty. |
| pgxpool_idle_conns             | Number of currently idle conns in the pool.                                                                                                |
| pgxpool_max_conns              | Maximum size of the pool.                                                                                                                  |
| pgxpool_total_conns            | Total number of resources currently in the pool. The value is the sum of ConstructingConns, AcquiredConns, and IdleConns.                  |

