<p align="center">
  <img src="./assets/logo.png" width="40%" height="auto" >
  <h2 align="center">High performance in-memory cache</h2>
</p>

<p align="center">
<a href="https://pkg.go.dev/github.com/maypok86/otter"><img src="https://pkg.go.dev/badge/github.com/maypok86/otter.svg" alt="Go Reference"></a>
<img src="https://github.com/maypok86/otter/actions/workflows/test.yml/badge.svg" />
<a href="https://codecov.io/gh/maypok86/otter" >
    <img src="https://codecov.io/gh/maypok86/otter/graph/badge.svg?token=G0PJFOR8IF"/>
</a>
<img src="https://goreportcard.com/badge/github.com/maypok86/otter" />
<a href="https://github.com/avelino/awesome-go"><img src="https://awesome.re/mentioned-badge.svg" alt="Mentioned in Awesome Go"></a>
</p>

Otter is one of the most powerful caching libraries for Go based on researches in caching and concurrent data structures. Otter also uses the experience of designing caching libraries in other languages (for example, [caffeine](https://github.com/ben-manes/caffeine)).

## 📖 Contents

- [Features](#features)
- [Related works](#related-works)
- [Usage](#usage)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Examples](#examples)
- [Performance](#performance)
  - [Throughput](#throughput)
  - [Hit ratio](#hit-ratio)
  - [Memory consumption](#memory-consumption)
- [Contribute](#contribute)
- [License](#license)

## ✨ Features <a id="features" />

- **Simple API**: Just set the parameters you want in the builder and enjoy
- **Autoconfiguration**: Otter is automatically configured based on the parallelism of your application
- **Generics**: You can safely use any comparable types as keys and any types as values
- **TTL**: Expired values will be automatically deleted from the cache
- **Cost-based eviction**: Otter supports eviction based on the cost of each entry
- **Deletion listener**: You can pass a callback function in the builder that will be called when an entry is deleted from the cache
- **Stats**: You can collect various usage statistics
- **Excellent throughput**: Otter can handle a [huge number of requests](#throughput)
- **Great hit ratio**: New S3-FIFO algorithm is used, which shows excellent [results](#hit-ratio)

## 🗃 Related works <a id="related-works" />

Otter is based on the following papers:

- [BP-Wrapper: A Framework Making Any Replacement Algorithms (Almost) Lock Contention Free](https://www.researchgate.net/publication/220966845_BP-Wrapper_A_System_Framework_Making_Any_Replacement_Algorithms_Almost_Lock_Contention_Free)
- [FIFO queues are all you need for cache eviction](https://dl.acm.org/doi/10.1145/3600006.3613147)
- [A large scale analysis of hundreds of in-memory cache clusters at Twitter](https://www.usenix.org/system/files/osdi20-yang.pdf)

## 📚 Usage <a id="usage" />

### 📋 Requirements <a id="requirements" />

- Go 1.19+

### 🛠️ Installation <a id="installation" />

```shell
go get -u github.com/maypok86/otter
```

### ✏️ Examples <a id="examples" />

Otter uses a builder pattern that allows you to conveniently create a cache instance with different parameters.

**Cache with const TTL**
```go
package main

import (
    "fmt"
    "time"

    "github.com/maypok86/otter"
)

func main() {
    // create a cache with capacity equal to 10000 elements
    cache, err := otter.MustBuilder[string, string](10_000).
        CollectStats().
        Cost(func(key string, value string) uint32 {
            return 1
        }).
        WithTTL(time.Hour).
        Build()
    if err != nil {
        panic(err)
    }

    // set item with ttl (1 hour) 
    cache.Set("key", "value")

    // get value from cache
    value, ok := cache.Get("key")
    if !ok {
        panic("not found key")
    }
    fmt.Println(value)

    // delete item from cache
    cache.Delete("key")

    // delete data and stop goroutines
    cache.Close()
}
```

**Cache with variable TTL**
```go
package main

import (
    "fmt"
    "time"

    "github.com/maypok86/otter"
)

func main() {
    // create a cache with capacity equal to 10000 elements
    cache, err := otter.MustBuilder[string, string](10_000).
        CollectStats().
        Cost(func(key string, value string) uint32 {
            return 1
        }).
        WithVariableTTL().
        Build()
    if err != nil {
        panic(err)
    }

    // set item with ttl (1 hour)
    cache.Set("key1", "value1", time.Hour)
    // set item with ttl (1 minute)
    cache.Set("key2", "value2", time.Minute)

    // get value from cache
    value, ok := cache.Get("key1")
    if !ok {
        panic("not found key")
    }
    fmt.Println(value)

    // delete item from cache
    cache.Delete("key1")

    // delete data and stop goroutines
    cache.Close()
}
```

## 📊 Performance <a id="performance" />

The benchmark code can be found [here](https://github.com/maypok86/benchmarks).

### 🚀 Throughput <a id="throughput" />

Throughput benchmarks are a Go port of the caffeine [benchmarks](https://github.com/ben-manes/caffeine/blob/master/caffeine/src/jmh/java/com/github/benmanes/caffeine/cache/GetPutBenchmark.java). This microbenchmark compares the throughput of caches on a zipf distribution, which allows to show various inefficient places in implementations.

You can find results [here](https://maypok86.github.io/otter/performance/throughput/).

### 🎯 Hit ratio <a id="hit-ratio" />

The hit ratio simulator tests caches on various traces:
1. Synthetic (zipf distribution)
2. Traditional (widely known and used in various projects and papers)
3. Modern (recently collected from the production of the largest companies in the world)

You can find results [here](https://maypok86.github.io/otter/performance/hit-ratio/).

### 💾 Memory consumption <a id="memory-consumption" />

The memory overhead benchmark shows how much additional memory the cache will require at different capacities.

You can find results [here](https://maypok86.github.io/otter/performance/memory-consumption/).

## 👏 Contribute <a id="contribute" />

Contributions are welcome as always, before submitting a new PR please make sure to open a new issue so community members can discuss it.
For more information please see [contribution guidelines](./CONTRIBUTING.md).

Additionally, you might find existing open issues which can help with improvements.

This project follows a standard [code of conduct](./CODE_OF_CONDUCT.md) so that you can understand what actions will and will not be tolerated.

## 📄 License <a id="license" />

This project is Apache 2.0 licensed, as found in the [LICENSE](./LICENSE).
