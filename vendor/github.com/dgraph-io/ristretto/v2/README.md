# Ristretto

[![GitHub License](https://img.shields.io/github/license/hypermodeinc/ristretto)](https://github.com/hypermodeinc/ristretto?tab=Apache-2.0-1-ov-file#readme)
[![chat](https://img.shields.io/discord/1267579648657850441)](https://discord.hypermode.com)
[![GitHub Repo stars](https://img.shields.io/github/stars/hypermodeinc/ristretto)](https://github.com/hypermodeinc/ristretto/stargazers)
[![GitHub commit activity](https://img.shields.io/github/commit-activity/m/hypermodeinc/ristretto)](https://github.com/hypermodeinc/ristretto/commits/main/)
[![Go Report Card](https://img.shields.io/badge/go%20report-A%2B-brightgreen)](https://goreportcard.com/report/github.com/dgraph-io/ristretto)

Ristretto is a fast, concurrent cache library built with a focus on performance and correctness.

The motivation to build Ristretto comes from the need for a contention-free cache in [Dgraph][].

[Dgraph]: https://github.com/hypermodeinc/dgraph

## Features

- **High Hit Ratios** - with our unique admission/eviction policy pairing, Ristretto's performance
  is best in class.
  - **Eviction: SampledLFU** - on par with exact LRU and better performance on Search and Database
    traces.
  - **Admission: TinyLFU** - extra performance with little memory overhead (12 bits per counter).
- **Fast Throughput** - we use a variety of techniques for managing contention and the result is
  excellent throughput.
- **Cost-Based Eviction** - any large new item deemed valuable can evict multiple smaller items
  (cost could be anything).
- **Fully Concurrent** - you can use as many goroutines as you want with little throughput
  degradation.
- **Metrics** - optional performance metrics for throughput, hit ratios, and other stats.
- **Simple API** - just figure out your ideal `Config` values and you're off and running.

## Status

Ristretto is production-ready. See [Projects using Ristretto](#projects-using-ristretto).

## Getting Started

### Installing

To start using Ristretto, install Go 1.21 or above. Ristretto needs go modules. From your project,
run the following command

```sh
go get github.com/dgraph-io/ristretto/v2
```

This will retrieve the library.

#### Choosing a version

Following these rules:

- v1.x.x is the first version used in most programs with Ristretto dependencies.
- v2.x.x is the new version with support for generics, for which it has a slightly different
  interface. This version is designed to solve compatibility problems of programs using the old
  version of Ristretto. If you start writing a new program, it is recommended to use this version.

## Usage

```go
package main

import (
  "fmt"

  "github.com/dgraph-io/ristretto/v2"
)

func main() {
  cache, err := ristretto.NewCache(&ristretto.Config[string, string]{
    NumCounters: 1e7,     // number of keys to track frequency of (10M).
    MaxCost:     1 << 30, // maximum cost of cache (1GB).
    BufferItems: 64,      // number of keys per Get buffer.
  })
  if err != nil {
    panic(err)
  }
  defer cache.Close()

  // set a value with a cost of 1
  cache.Set("key", "value", 1)

  // wait for value to pass through buffers
  cache.Wait()

  // get value from cache
  value, found := cache.Get("key")
  if !found {
    panic("missing value")
  }
  fmt.Println(value)

  // del value from cache
  cache.Del("key")
}
```

## Benchmarks

The benchmarks can be found in
https://github.com/hypermodeinc/dgraph-benchmarks/tree/main/cachebench/ristretto.

### Hit Ratios for Search

This trace is described as "disk read accesses initiated by a large commercial search engine in
response to various web search requests."

<p align="center">
  <img src="https://raw.githubusercontent.com/hypermodeinc/ristretto/main/benchmarks/Hit%20Ratios%20-%20Search%20(ARC-S3).svg"
  alt="Graph showing hit ratios comparison for search workload">
</p>

### Hit Ratio for Database

This trace is described as "a database server running at a commercial site running an ERP
application on top of a commercial database."

<p align="center">
  <img src="https://raw.githubusercontent.com/hypermodeinc/ristretto/main/benchmarks/Hit%20Ratios%20-%20Database%20(ARC-DS1).svg"
  alt="Graph showing hit ratios comparison for database workload">
</p>

### Hit Ratio for Looping

This trace demonstrates a looping access pattern.

<p align="center">
  <img src="https://raw.githubusercontent.com/hypermodeinc/ristretto/main/benchmarks/Hit%20Ratios%20-%20Glimpse%20(LIRS-GLI).svg"
  alt="Graph showing hit ratios comparison for looping access pattern">
</p>

### Hit Ratio for CODASYL

This trace is described as "references to a CODASYL database for a one hour period."

<p align="center">
  <img src="https://raw.githubusercontent.com/hypermodeinc/ristretto/main/benchmarks/Hit%20Ratios%20-%20CODASYL%20(ARC-OLTP).svg"
  alt="Graph showing hit ratios comparison for CODASYL workload">
</p>

### Throughput for Mixed Workload

<p align="center">
  <img src="https://raw.githubusercontent.com/hypermodeinc/ristretto/main/benchmarks/Throughput%20-%20Mixed.svg"
  alt="Graph showing throughput comparison for mixed workload">
</p>

### Throughput ffor Read Workload

<p align="center">
  <img src="https://raw.githubusercontent.com/hypermodeinc/ristretto/main/benchmarks/Throughput%20-%20Read%20(Zipfian).svg"
  alt="Graph showing throughput comparison for read workload">
</p>

### Through for Write Workload

<p align="center">
  <img src="https://raw.githubusercontent.com/hypermodeinc/ristretto/main/benchmarks/Throughput%20-%20Write%20(Zipfian).svg"
  alt="Graph showing throughput comparison for write workload">
</p>

## Projects Using Ristretto

Below is a list of known projects that use Ristretto:

- [Badger](https://github.com/hypermodeinc/badger) - Embeddable key-value DB in Go
- [Dgraph](https://github.com/hypermodeinc/dgraph) - Horizontally scalable and distributed GraphQL
  database with a graph backend

## FAQ

### How are you achieving this performance? What shortcuts are you taking?

We go into detail in the
[Ristretto blog post](https://hypermode.com/blog/introducing-ristretto-high-perf-go-cache/), but in
short: our throughput performance can be attributed to a mix of batching and eventual consistency.
Our hit ratio performance is mostly due to an excellent
[admission policy](https://arxiv.org/abs/1512.00727) and SampledLFU eviction policy.

As for "shortcuts," the only thing Ristretto does that could be construed as one is dropping some
Set calls. That means a Set call for a new item (updates are guaranteed) isn't guaranteed to make it
into the cache. The new item could be dropped at two points: when passing through the Set buffer or
when passing through the admission policy. However, this doesn't affect hit ratios much at all as we
expect the most popular items to be Set multiple times and eventually make it in the cache.

### Is Ristretto distributed?

No, it's just like any other Go library that you can import into your project and use in a single
process.
