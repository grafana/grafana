# XXH3
[![GoDoc](https://godoc.org/github.com/zeebo/xxh3?status.svg)](https://godoc.org/github.com/zeebo/xxh3)
[![Sourcegraph](https://sourcegraph.com/github.com/zeebo/xxh3/-/badge.svg)](https://sourcegraph.com/github.com/zeebo/xxh3?badge)
[![Go Report Card](https://goreportcard.com/badge/github.com/zeebo/xxh3)](https://goreportcard.com/report/github.com/zeebo/xxh3)

This package is a port of the [xxh3](https://github.com/Cyan4973/xxHash) library to Go.

Upstream has fixed the output as of v0.8.0, and this package matches that.

---

# Benchmarks

Run on my `i7-8850H CPU @ 2.60GHz`

## Small Sizes

| Bytes     | Rate                                 |
|-----------|--------------------------------------|
|` 0 `      |` 0.74 ns/op `                       |
|` 1-3 `    |` 4.19 ns/op (0.24 GB/s - 0.71 GB/s) `|
|` 4-8 `    |` 4.16 ns/op (0.97 GB/s - 1.98 GB/s) `|
|` 9-16 `   |` 4.46 ns/op (2.02 GB/s - 3.58 GB/s) `|
|` 17-32 `  |` 6.22 ns/op (2.76 GB/s - 5.15 GB/s) `|
|` 33-64 `  |` 8.00 ns/op (4.13 GB/s - 8.13 GB/s) `|
|` 65-96 `  |` 11.0 ns/op (5.91 GB/s - 8.84 GB/s) `|
|` 97-128 ` |` 12.8 ns/op (7.68 GB/s - 10.0 GB/s) `|

## Large Sizes

| Bytes   | Rate                     | SSE2 Rate                | AVX2 Rate                |
|---------|--------------------------|--------------------------|--------------------------|
|` 129 `  |` 13.6 ns/op (9.45 GB/s) `|                          |                          |
|` 240 `  |` 23.8 ns/op (10.1 GB/s) `|                          |                          |
|` 241 `  |` 40.5 ns/op (5.97 GB/s) `|` 23.3 ns/op (10.4 GB/s) `|` 20.1 ns/op (12.0 GB/s) `|
|` 512 `  |` 69.8 ns/op (7.34 GB/s) `|` 30.4 ns/op (16.9 GB/s) `|` 24.7 ns/op (20.7 GB/s) `|
|` 1024 ` |` 132  ns/op (7.77 GB/s) `|` 48.9 ns/op (20.9 GB/s) `|` 37.7 ns/op (27.2 GB/s) `|
|` 100KB `|` 13.0 us/op (7.88 GB/s) `|` 4.05 us/op (25.3 GB/s) `|` 2.31 us/op (44.3 GB/s) `|
