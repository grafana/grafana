# BigQuery Benchmark
This directory contains benchmarks for BigQuery client.

## Usage
`go run bench.go -- <your project id> queries.json`

BigQuery service caches requests so the benchmark should be run
at least twice, disregarding the first result.
