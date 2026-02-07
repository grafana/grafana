# Redis client for Go

![build workflow](https://github.com/go-redis/redis/actions/workflows/build.yml/badge.svg)
[![PkgGoDev](https://pkg.go.dev/badge/github.com/go-redis/redis/v8)](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc)
[![Documentation](https://img.shields.io/badge/redis-documentation-informational)](https://redis.uptrace.dev/)

go-redis is brought to you by :star: [**uptrace/uptrace**](https://github.com/uptrace/uptrace).
Uptrace is an open source and blazingly fast **distributed tracing** backend powered by
OpenTelemetry and ClickHouse. Give it a star as well!

## Resources

- [Discussions](https://github.com/go-redis/redis/discussions)
- [Documentation](https://redis.uptrace.dev)
- [Reference](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc)
- [Examples](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#pkg-examples)
- [RealWorld example app](https://github.com/uptrace/go-treemux-realworld-example-app)

Other projects you may like:

- [Bun](https://bun.uptrace.dev) - fast and simple SQL client for PostgreSQL, MySQL, and SQLite.
- [BunRouter](https://bunrouter.uptrace.dev/) - fast and flexible HTTP router for Go.

## Ecosystem

- [Redis Mock](https://github.com/go-redis/redismock)
- [Distributed Locks](https://github.com/bsm/redislock)
- [Redis Cache](https://github.com/go-redis/cache)
- [Rate limiting](https://github.com/go-redis/redis_rate)

## Features

- Redis 3 commands except QUIT, MONITOR, and SYNC.
- Automatic connection pooling with
  [circuit breaker](https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern) support.
- [Pub/Sub](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#PubSub).
- [Transactions](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#example-Client-TxPipeline).
- [Pipeline](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#example-Client.Pipeline) and
  [TxPipeline](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#example-Client.TxPipeline).
- [Scripting](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#Script).
- [Timeouts](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#Options).
- [Redis Sentinel](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#NewFailoverClient).
- [Redis Cluster](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#NewClusterClient).
- [Cluster of Redis Servers](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#example-NewClusterClient-ManualSetup)
  without using cluster mode and Redis Sentinel.
- [Ring](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#NewRing).
- [Instrumentation](https://pkg.go.dev/github.com/go-redis/redis/v8?tab=doc#example-package-Instrumentation).

## Installation

go-redis supports 2 last Go versions and requires a Go version with
[modules](https://github.com/golang/go/wiki/Modules) support. So make sure to initialize a Go
module:

```shell
go mod init github.com/my/repo
```

And then install go-redis/v8 (note _v8_ in the import; omitting it is a popular mistake):

```shell
go get github.com/go-redis/redis/v8
```

## Quickstart

```go
import (
    "context"
    "github.com/go-redis/redis/v8"
    "fmt"
)

var ctx = context.Background()

func ExampleClient() {
    rdb := redis.NewClient(&redis.Options{
        Addr:     "localhost:6379",
        Password: "", // no password set
        DB:       0,  // use default DB
    })

    err := rdb.Set(ctx, "key", "value", 0).Err()
    if err != nil {
        panic(err)
    }

    val, err := rdb.Get(ctx, "key").Result()
    if err != nil {
        panic(err)
    }
    fmt.Println("key", val)

    val2, err := rdb.Get(ctx, "key2").Result()
    if err == redis.Nil {
        fmt.Println("key2 does not exist")
    } else if err != nil {
        panic(err)
    } else {
        fmt.Println("key2", val2)
    }
    // Output: key value
    // key2 does not exist
}
```

## Look and feel

Some corner cases:

```go
// SET key value EX 10 NX
set, err := rdb.SetNX(ctx, "key", "value", 10*time.Second).Result()

// SET key value keepttl NX
set, err := rdb.SetNX(ctx, "key", "value", redis.KeepTTL).Result()

// SORT list LIMIT 0 2 ASC
vals, err := rdb.Sort(ctx, "list", &redis.Sort{Offset: 0, Count: 2, Order: "ASC"}).Result()

// ZRANGEBYSCORE zset -inf +inf WITHSCORES LIMIT 0 2
vals, err := rdb.ZRangeByScoreWithScores(ctx, "zset", &redis.ZRangeBy{
    Min: "-inf",
    Max: "+inf",
    Offset: 0,
    Count: 2,
}).Result()

// ZINTERSTORE out 2 zset1 zset2 WEIGHTS 2 3 AGGREGATE SUM
vals, err := rdb.ZInterStore(ctx, "out", &redis.ZStore{
    Keys: []string{"zset1", "zset2"},
    Weights: []int64{2, 3}
}).Result()

// EVAL "return {KEYS[1],ARGV[1]}" 1 "key" "hello"
vals, err := rdb.Eval(ctx, "return {KEYS[1],ARGV[1]}", []string{"key"}, "hello").Result()

// custom command
res, err := rdb.Do(ctx, "set", "key", "value").Result()
```

## Run the test

go-redis will start a redis-server and run the test cases.

The paths of redis-server bin file and redis config file are defined in `main_test.go`:

```
var (
	redisServerBin, _  = filepath.Abs(filepath.Join("testdata", "redis", "src", "redis-server"))
	redisServerConf, _ = filepath.Abs(filepath.Join("testdata", "redis", "redis.conf"))
)
```

For local testing, you can change the variables to refer to your local files, or create a soft link
to the corresponding folder for redis-server and copy the config file to `testdata/redis/`:

```
ln -s /usr/bin/redis-server ./go-redis/testdata/redis/src
cp ./go-redis/testdata/redis.conf ./go-redis/testdata/redis/
```

Lastly, run:

```
go test
```

## Contributors

Thanks to all the people who already contributed!

<a href="https://github.com/go-redis/redis/graphs/contributors">
  <img src="https://contributors-img.web.app/image?repo=go-redis/redis" />
</a>
