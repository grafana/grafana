[![GoDoc reference](https://img.shields.io/badge/godoc-reference-blue.svg)](https://pkg.go.dev/github.com/puzpuzpuz/xsync/v4)
[![GoReport](https://goreportcard.com/badge/github.com/puzpuzpuz/xsync/v4)](https://goreportcard.com/report/github.com/puzpuzpuz/xsync/v4)
[![codecov](https://codecov.io/gh/puzpuzpuz/xsync/branch/main/graph/badge.svg)](https://codecov.io/gh/puzpuzpuz/xsync)

# xsync

Concurrent data structures for Go. Aims to provide more scalable alternatives for some of the data structures from the standard `sync` package, but not only.

Covered with tests following the approach described [here](https://puzpuzpuz.dev/testing-concurrent-code-for-fun-and-profit).

## Benchmarks

Benchmark results may be found [here](BENCHMARKS.md). I'd like to thank [@felixge](https://github.com/felixge) who kindly ran the benchmarks on a beefy multicore machine.

Also, a non-scientific, unfair benchmark comparing Java's [j.u.c.ConcurrentHashMap](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) and `xsync.Map` is available [here](https://puzpuzpuz.dev/concurrent-map-in-go-vs-java-yet-another-meaningless-benchmark).

## Usage

The latest xsync major version is v4, so `/v4` suffix should be used when importing the library:

```go
import (
	"github.com/puzpuzpuz/xsync/v4"
)
```

Minimal required Golang version is 1.24.

*Note for pre-v4 users*: the main change between v3 and v4 is removal of non-generic data structures and some improvements in `Map` API. The old `*Of` types are kept as type aliases for the renamed data structures to simplify the migration, e.g. `MapOf` is an alias for `Map`. While the API has some breaking changes, the migration should be trivial.

### Counter

A `Counter` is a striped `int64` counter inspired by the `j.u.c.a.LongAdder` class from the Java standard library.

```go
c := xsync.NewCounter()
// increment and decrement the counter
c.Inc()
c.Dec()
// read the current value
v := c.Value()
```

Works better in comparison with a single atomically updated `int64` counter in high contention scenarios.

### Map

A `Map` is like a concurrent hash table-based map. It follows the interface of `sync.Map` with a number of valuable extensions like `Compute` or `Size`.

```go
m := xsync.NewMap[string, string]()
m.Store("foo", "bar")
v, ok := m.Load("foo")
s := m.Size()
```

`Map` uses a modified version of Cache-Line Hash Table (CLHT) data structure: https://github.com/LPD-EPFL/CLHT

CLHT is built around the idea of organizing the hash table in cache-line-sized buckets, so that on all modern CPUs update operations complete with minimal cache-line transfer. Also, `Get` operations are obstruction-free and involve no writes to shared memory, hence no mutexes or any other sort of locks. Due to this design, in all considered scenarios `Map` outperforms `sync.Map`. `Map` also uses cooperative parallel rehashing: this means that the goroutines executing write operations may participate in a concurrent rehashing instead of waiting for it to finish.

Apart from CLHT, `Map` borrows ideas from Java's `j.u.c.ConcurrentHashMap` (immutable K/V pair structs instead of atomic snapshots) and C++'s `absl::flat_hash_map` (meta memory and SWAR-based lookups).

Besides the `Range` method available for map iteration, there is also `ToPlainMap` utility function to convert a `Map` to a built-in Go's `map`:
```go
m := xsync.NewMap[int, int]()
m.Store(42, 42)
pm := xsync.ToPlainMap(m)
```

`Map` uses the built-in Golang's hash function which has DDOS protection. It uses `maphash.Comparable` as the default hash function. This means that each map instance gets its own seed number and the hash function uses that seed for hash code calculation.

By default, `Map` spawns additional goroutines to speed up resizing the hash table. This can be disabled by creating a `Map` with the `WithSerialResize` setting.
```go
m := xsync.NewMap[int, int](xsync.WithSerialResize())
// resize will take place on the current goroutine only
for i := 0; i < 10000; i++ {
	m.Store(i, i)
}
```

### UMPSCQueue

A `UMPSCQueue` is an unbounded multi-producer single-consumer concurrent queue. This means that multiple goroutines can publish items to the queue while not more than a single goroutine must be consuming those items. Unlike bounded queues, this one puts no limit to the queue capacity.

```go
q := xsync.NewUMPSCQueue[string]()
// producer inserts an item into the queue; doesn't block
// safe to invoke from multiple goroutines
inserted := q.Enqueue("bar")
// consumer obtains an item from the queue
// must be called from a single goroutine
item := q.Dequeue() // string
```

`UMPSCQueue` is meant to serve as a replacement for a channel. However, crucially, it has infinite capacity. This is a very bad idea in many cases as it means that it never exhibits backpressure. In other words, if nothing is consuming elements from the queue, it will eventually consume all available memory and crash the process. However, there are also cases where this is desired behavior as it means the queue will dynamically allocate more memory to store temporary bursts, allowing producers to never block while the consumer catches up.

The backing data structure is represented as a singly linked list of large segments. Each segment is a slice of `T` along with a corresponding `sync.WaitGroup` for each index. Producers use an atomic counter to determine the unique index in the segment where they will write their value, and mark the corresponding wait group as done after having written the value. The consumer simply keeps track of the index it wants to read and waits for the corresponding wait group to complete. Neither operation acquires a lock and therefore performs quite well under highly contentious loads.

Note however that because no locks are acquired, it is unsafe for multiple goroutines to consume from the queue. Consumers must explicitly synchronize between themselves. This allows setups with a single consumer to never acquire a lock, significantly speeding up consumption.

### SPSCQueue

A `SPSCQueue` is a bounded single-producer single-consumer concurrent queue. This means that not more than a single goroutine must be publishing items to the queue while not more than a single goroutine must be consuming those items.

```go
q := xsync.NewSPSCQueue[string](1024)
// producer inserts an item into the queue
// optimistic insertion attempt; doesn't block
inserted := q.TryEnqueue("bar")
// consumer obtains an item from the queue
// optimistic obtain attempt; doesn't block
item, ok := q.TryDequeue() // string
```

The queue is based on the data structure from this [article](https://rigtorp.se/ringbuffer). The idea is to reduce the CPU cache coherency traffic by keeping cached copies of read and write indexes used by producer and consumer respectively.

Make sure to implement proper back-off strategy to handle failed optimistic operation attempts. The most basic back-off would be calling `runtime.Gosched()`.

### MPMCQueue

A `MPMCQueue` is a bounded multi-producer multi-consumer concurrent queue.

```go
q := xsync.NewMPMCQueue[string](1024)
// producer optimistically inserts an item into the queue
// optimistic insertion attempt; doesn't block
inserted := q.TryEnqueue("bar")
// consumer obtains an item from the queue
// optimistic obtain attempt; doesn't block
item, ok := q.TryDequeue() // string
```

The queue is based on the algorithm from the [MPMCQueue](https://github.com/rigtorp/MPMCQueue) C++ library which in its turn references D.Vyukov's [MPMC queue](https://www.1024cores.net/home/lock-free-algorithms/queues/bounded-mpmc-queue). According to the following [classification](https://www.1024cores.net/home/lock-free-algorithms/queues), the queue is array-based, fails on overflow, provides causal FIFO, has blocking producers and consumers.

The idea of the algorithm is to allow parallelism for concurrent producers and consumers by introducing the notion of tickets, i.e. values of two counters, one per producers/consumers. An atomic increment of one of those counters is the only noticeable contention point in queue operations. The rest of the operation avoids contention on writes thanks to the turn-based read/write access for each of the queue items.

In essence, `MPMCQueue` is a specialized queue for scenarios where there are multiple concurrent producers and consumers of a single queue running on a large multicore machine.

To get the optimal performance, you may want to set the queue size to be large enough, say, an order of magnitude greater than the number of producers/consumers, to allow producers and consumers to progress with their queue operations in parallel most of the time.

Other than that, make sure to implement proper back-off strategy to handle failed optimistic operation attempts. The most basic back-off would be calling `runtime.Gosched()`.

### RBMutex

A `RBMutex` is a reader-biased reader/writer mutual exclusion lock. The lock can be held by many readers or a single writer.

```go
mu := xsync.NewRBMutex()
// reader lock calls return a token
t := mu.RLock()
// the token must be later used to unlock the mutex
mu.RUnlock(t)
// writer locks are the same as in sync.RWMutex
mu.Lock()
mu.Unlock()
```

`RBMutex` is based on a modified version of BRAVO (Biased Locking for Reader-Writer Locks) algorithm: https://arxiv.org/pdf/1810.01553.pdf

The idea of the algorithm is to build on top of an existing reader-writer mutex and introduce a fast path for readers. On the fast path, reader lock attempts are sharded over an internal array based on the reader identity (a token in the case of Golang). This means that readers do not contend over a single atomic counter like it's done in, say, `sync.RWMutex` allowing for better scalability in terms of cores.

Hence, by the design `RBMutex` is a specialized mutex for scenarios, such as caches, where the vast majority of locks are acquired by readers and write lock acquire attempts are infrequent. In such scenarios, `RBMutex` should perform better than the `sync.RWMutex` on large multicore machines.

`RBMutex` extends `sync.RWMutex` internally and uses it as the "reader bias disabled" fallback, so the same semantics apply. The only noticeable difference is in the reader tokens returned from the `RLock`/`RUnlock` methods.

Apart from blocking methods, `RBMutex` also has methods for optimistic locking:
```go
mu := xsync.NewRBMutex()
if locked, t := mu.TryRLock(); locked {
	// critical reader section...
	mu.RUnlock(t)
}
if mu.TryLock() {
	// critical writer section...
	mu.Unlock()
}
```

## License

Licensed under Apache v2.
