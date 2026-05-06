# Theine
[![Go Reference](https://pkg.go.dev/badge/github.com/Yiling-J/theine-go.svg)](https://pkg.go.dev/github.com/Yiling-J/theine-go)
[![codecov](https://codecov.io/gh/Yiling-J/theine-go/branch/main/graph/badge.svg?token=E1HJLJH07V)](https://codecov.io/gh/Yiling-J/theine-go)

High performance in-memory & hybrid cache inspired by [Caffeine](https://github.com/ben-manes/caffeine).


- Good performance
- Support for Generics
- High hit ratio with adaptive [W-TinyLFU](https://arxiv.org/pdf/1512.00727.pdf) eviction policy
- Expired data are removed automatically using [hierarchical timer wheel](http://www.cs.columbia.edu/~nahum/w6998/papers/ton97-timing-wheels.pdf)
- Simple API

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [API](#api)
- [Cache Persistence](#cache-persistence)
- [Benchmarks](#benchmarks)
  * [throughput](#throughput)
  * [hit ratios](#hit-ratios)
- [Secondary Cache(Experimental)](#secondary-cacheexperimental)
- [Support](#support)

## Requirements
Go 1.19+

## Installation
```
go get github.com/Yiling-J/theine-go
```

## API

**Builder API**

Theine provides two types of client, simple cache and loading cache. Both of them are initialized from a builder. The difference between simple cache and loading cache is: loading cache's Get method will compute the value using loader function when there is a miss, while simple cache client only return false and do nothing.

Loading cache uses [singleflight](https://pkg.go.dev/golang.org/x/sync/singleflight) to prevent concurrent loading to same key(thundering herd).

**Entry Pool**

Theine stores `*Entry` as the value in the hashmap, where each entry contains key, value, and metadata related to the policy. Before v0.6.0, Theine used a `sync pool` to automatically reuse evicted entries. This approach was beneficial for scenarios with heavy concurrent writes. If your system is already optimized for allocation, it should significantly reduce memory allocations. However, if cache writes are rare and GC is triggered often by other parts of your system, the sync pool becomes nearly useless.

And sync pool had a potential drawback: **race conditions within the policy**. Theine sends events to the policy asynchronously via channels/buffers, so there was a small chance that an event could be applied to the wrong entry if the entry was evicted and then reused by the pool.

To mitigate this, Theine rechecks the key first when updating the policy, but this behavior might be flagged by the race detector. Starting from v0.6.0, Theine introduced a new option called `UseEntryPool`, which defaults to `false`. If you are dealing with heavy concurrent writes and minimize allocations is crucial, you can enable this option.

**API Details**

simple cache:

```GO
import "github.com/Yiling-J/theine-go"

// key type string, value type string, max size 1000
// max size is the only required configuration to build a client
client, err := theine.NewBuilder[string, string](1000).Build()
if err != nil {
	panic(err)
}

// builder also provide several optional configurations
// you can chain them together and call build once
// client, err := theine.NewBuilder[string, string](1000).Cost(...).Doorkeeper(...).Build()

// or create builder first
builder := theine.NewBuilder[string, string](1000)

// dynamic cost function based on value
// use 0 in Set will call this function to evaluate cost at runtime
builder.Cost(func(v string) int64 {
		return int64(len(v))
})

// enable entryPool (default false)
builder.UseEntryPool(true)

// doorkeeper (default false)
// doorkeeper will drop Set if they are not in bloomfilter yet
// this can improve write performance, but may lower hit ratio
builder.Doorkeeper(true)

// removal listener, this function will be called when entry is removed
// RemoveReason could be REMOVED/EVICTED/EXPIRED
// REMOVED: remove by API
// EVICTED: evicted by Window-TinyLFU policy
// EXPIRED: expired by timing wheel
builder.RemovalListener(func(key K, value V, reason theine.RemoveReason) {})

```
loading cache:

```go
import "github.com/Yiling-J/theine-go"

// loader function: func(ctx context.Context, key K) (theine.Loaded[V], error)
// Loaded struct should include cache value, cost and ttl, which required by Set method
client, err := theine.NewBuilder[string, string](1000).Loading(
	func(ctx context.Context, key string) (theine.Loaded[string], error) {
		return theine.Loaded[string]{Value: key, Cost: 1, TTL: 0}, nil
	},
).Build()
if err != nil {
	panic(err)
}

```
Other builder options are same as simple cache(cost, doorkeeper, removal listener).


**Client API**

```Go
// set, key foo, value bar, cost 1
// success will be false if cost > max size
success := client.Set("foo", "bar", 1)
// cost 0 means using dynamic cost function
// success := client.Set("foo", "bar", 0)

// set with ttl
success = client.SetWithTTL("foo", "bar", 1, 1*time.Second)

// get(simple cache version)
value, ok := client.Get("foo")

// get(loading cache version)
value, err := client.Get(ctx, "foo")

// remove
client.Delete("foo")

// iterate key/value in cache and apply custom function
// if function returns false, range stops the iteration
client.Range(func(key, value int) bool {
	return true
})

// returns an estimation of the cache size usage
client.EstimatedSize()

// get cache stats(in-memory cache only), include hits, misses and hit ratio
client.Stats()

// close client, set hashmaps in shard to nil and close all goroutines
client.Close()

```

## Cache Persistence
Theine supports persisting the cache into `io.Writer` and restoring from `io.Reader`. [Gob](https://pkg.go.dev/encoding/gob) is used to encode/decode data, so **make sure your key/value can be encoded by gob correctly first** before using this feature.

#### API
```go
func (c *Cache[K, V]) SaveCache(version uint64, writer io.Writer) error
func (c *Cache[K, V]) LoadCache(version uint64, reader io.Reader) error
```
**- Important:** please `LoadCache` immediately after client created, or existing entries' TTL might be affected.

#### Example:
```go
// save
f, err := os.Create("test")
err := client.SaveCache(0, f)
f.Close()

// load
f, err = os.Open("test")
require.Nil(t, err)
newClient, err := theine.NewBuilder[int, int](100).Build()
// load immediately after client created
err = newClient.LoadCache(0, f)
f.Close()
```
Version number must be same when saving and loading, or `LoadCache` will return `theine.VersionMismatch` error. You can change the version number when you want to ignore persisted cache.
```go
err := newClient.LoadCache(1, f)
// VersionMismatch is a global variable
if err == theine.VersionMismatch {
	// ignore and skip loading
} else if err != nil {
	// panic error
}
```

Theine does not guarantee that caches from previous versions will be compatible after an upgrade, so it is highly recommended not to use the old persistence file when upgrading Theine.

#### Details
When persisting cache, Theine roughly do:
- Store version number.
- Store clock(used in TTL).
- Store frequency sketch.
- Store entries one by one in protected LRU in most-recently:least-recently order.
- Store entries one by one in probation LRU in most-recently:least-recently order.
- Loop shards and store entries one by one in each shard deque.

When loading cache, Theine roughly do:
- Load version number, compare to current version number.
- Load clock.
- Load frequency sketch.
- Load protected LRU and insert entries back to new protected LRU and shards/timingwheel, expired entries will be ignored. Because cache capacity may change, this step will stop if max protected LRU size reached.
- Load probation LRU and insert entries back to new probation LRU and shards/timingwheel, expired entries will be ignored, Because cache capacity may change, this step will stop if max probation LRU size reached.
- Load deque entries and insert back to shards, expired entries will be ignored.

Theine will save checksum when persisting cache and verify checksum first when loading.

## Benchmarks

Source: https://github.com/maypok86/benchmarks

### throughput

100% read (cpu 8/16/32)

```
goos: linux
goarch: amd64
pkg: github.com/maypok86/benchmarks/throughput
cpu: Intel(R) Xeon(R) Platinum 8163 CPU @ 2.50GHz

BenchmarkCache/zipf_otter_reads=100%,writes=0%-8                88954334                14.78 ns/op       67648151 ops/s
BenchmarkCache/zipf_theine_reads=100%,writes=0%-8               51908306                21.87 ns/op       45729075 ops/s
BenchmarkCache/zipf_ristretto_reads=100%,writes=0%-8            27217994                42.36 ns/op       23606992 ops/s

BenchmarkCache/zipf_otter_reads=100%,writes=0%-16               132372591                8.397 ns/op     119086508 ops/s
BenchmarkCache/zipf_theine_reads=100%,writes=0%-16              85420364                13.78 ns/op       72549558 ops/s
BenchmarkCache/zipf_ristretto_reads=100%,writes=0%-16           47790158                25.17 ns/op       39734070 ops/s

BenchmarkCache/zipf_otter_reads=100%,writes=0%-32               174121321                7.078 ns/op     141273879 ops/s
BenchmarkCache/zipf_theine_reads=100%,writes=0%-32              118185849               10.45 ns/op       95703790 ops/s
BenchmarkCache/zipf_ristretto_reads=100%,writes=0%-32           66458452                18.85 ns/op       53055079 ops/s

```

75% read (cpu 8/16/32)
```
goos: linux
goarch: amd64
pkg: github.com/maypok86/benchmarks/throughput
cpu: Intel(R) Xeon(R) Platinum 8163 CPU @ 2.50GHz

BenchmarkCache/zipf_otter_reads=75%,writes=25%-8                49907841                32.67 ns/op       30609572 ops/s
BenchmarkCache/zipf_theine_reads=75%,writes=25%-8               21484245                48.89 ns/op       20453469 ops/s
BenchmarkCache/zipf_ristretto_reads=75%,writes=25%-8             8651056               130.5 ns/op         7664450 ops/s

BenchmarkCache/zipf_otter_reads=75%,writes=25%-16               50226466                21.85 ns/op       45764160 ops/s
BenchmarkCache/zipf_theine_reads=75%,writes=25%-16              46674459                24.68 ns/op       40523215 ops/s
BenchmarkCache/zipf_ristretto_reads=75%,writes=25%-16           10233784               108.0 ns/op         9262524 ops/s

BenchmarkCache/zipf_otter_reads=75%,writes=25%-32               89651678                11.96 ns/op       83606257 ops/s
BenchmarkCache/zipf_theine_reads=75%,writes=25%-32              75969892                15.53 ns/op       64394679 ops/s
BenchmarkCache/zipf_ristretto_reads=75%,writes=25%-32           15766912                76.37 ns/op       13093551 ops/s

```


100% write (cpu 8/16/32)

```
goos: linux
goarch: amd64
pkg: github.com/maypok86/benchmarks/throughput
cpu: Intel(R) Xeon(R) Platinum 8163 CPU @ 2.50GHz

BenchmarkCache/zipf_otter_reads=0%,writes=100%-8                 1567917               723.0 ns/op         1383080 ops/s
BenchmarkCache/zipf_theine_reads=0%,writes=100%-8                2194747               542.4 ns/op         1843615 ops/s
BenchmarkCache/zipf_ristretto_reads=0%,writes=100%-8             1839237               642.5 ns/op         1556503 ops/s

BenchmarkCache/zipf_otter_reads=0%,writes=100%-16                1384345               846.0 ns/op         1181980 ops/s
BenchmarkCache/zipf_theine_reads=0%,writes=100%-16               1915946               528.8 ns/op         1891008 ops/s
BenchmarkCache/zipf_ristretto_reads=0%,writes=100%-16            1765465               697.3 ns/op         1434089 ops/s

BenchmarkCache/zipf_otter_reads=0%,writes=100%-32                1265883               979.8 ns/op         1020607 ops/s
BenchmarkCache/zipf_theine_reads=0%,writes=100%-32               1953358               526.1 ns/op         1900935 ops/s
BenchmarkCache/zipf_ristretto_reads=0%,writes=100%-32            1618098               696.1 ns/op         1436625 ops/s
```

benchmem 100% write (cpu 32)
```
goos: linux
goarch: amd64
pkg: github.com/maypok86/benchmarks/throughput
cpu: Intel(R) Xeon(R) Platinum 8163 CPU @ 2.50GHz

BenchmarkCache/zipf_otter_reads=0%,writes=100%-32                80 B/op          1 allocs/op
BenchmarkCache/zipf_theine_reads=0%,writes=100%-32               0 B/op           0 allocs/op
BenchmarkCache/zipf_ristretto_reads=0%,writes=100%-32            112 B/op         3 allocs/op

```

### hit ratios

**zipf**

![hit ratios](benchmarks/results/zipf.png)
**s3**

![hit ratios](benchmarks/results/s3.png)
**ds1**

![hit ratios](benchmarks/results/ds1.png)
**oltp**

![hit ratios](benchmarks/results/oltp.png)
**wiki CDN**

![hit ratios](benchmarks/results/wikicdn.png)
**Twitter Cache**

![hit ratios](benchmarks/results/twitter-c52s10.png)


## Secondary Cache(Experimental)

SecondaryCache is the interface for caching data on a secondary tier, which can be a non-volatile media or alternate forms of caching such as sqlite. The purpose of the secondary cache is to support other ways of caching the object. It can be viewed as an extension of Theine’s current in-memory cache.

Currently, the SecondaryCache interface has one implementation inspired by CacheLib's Hybrid Cache.

```go
type SecondaryCache[K comparable, V any] interface {
	Get(key K) (value V, cost int64, expire int64, ok bool, err error)
	Set(key K, value V, cost int64, expire int64) error
	Delete(key K) error
	HandleAsyncError(err error)
}
```

If you plan to use a remote cache or database, such as Redis, as a secondary cache, keep in mind that the in-memory cache remains the primary source of truth. Evicted entries from memory are sent to the secondary cache. This approach differs from most tiered cache systems, where the remote cache is treated as the primary source of truth and is written to first.

#### Secondary Cache Implementations
NVM: https://github.com/Yiling-J/theine-nvm

#### Limitations
- Cache Persistence is not currently supported, but it may be added in the future. You can still use the Persistence API in a hybrid-enabled cache, but only the DRAM part of the cache will be saved or loaded.
- The removal listener will only receive REMOVED events, which are generated when an entry is explicitly removed by calling the Delete API.
- No Range/Len API.


## Support
Feel free to open an issue or ask question in discussions.
