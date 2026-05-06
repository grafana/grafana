# Redis client for Go

[![build workflow](https://github.com/redis/go-redis/actions/workflows/build.yml/badge.svg)](https://github.com/redis/go-redis/actions)
[![PkgGoDev](https://pkg.go.dev/badge/github.com/redis/go-redis/v9)](https://pkg.go.dev/github.com/redis/go-redis/v9?tab=doc)
[![Documentation](https://img.shields.io/badge/redis-documentation-informational)](https://redis.uptrace.dev/)
[![Go Report Card](https://goreportcard.com/badge/github.com/redis/go-redis/v9)](https://goreportcard.com/report/github.com/redis/go-redis/v9)
[![codecov](https://codecov.io/github/redis/go-redis/graph/badge.svg?token=tsrCZKuSSw)](https://codecov.io/github/redis/go-redis)

[![Discord](https://img.shields.io/discord/697882427875393627.svg?style=social&logo=discord)](https://discord.gg/W4txy5AeKM)
[![Twitch](https://img.shields.io/twitch/status/redisinc?style=social)](https://www.twitch.tv/redisinc)
[![YouTube](https://img.shields.io/youtube/channel/views/UCD78lHSwYqMlyetR0_P4Vig?style=social)](https://www.youtube.com/redisinc)
[![Twitter](https://img.shields.io/twitter/follow/redisinc?style=social)](https://twitter.com/redisinc)
[![Stack Exchange questions](https://img.shields.io/stackexchange/stackoverflow/t/go-redis?style=social&logo=stackoverflow&label=Stackoverflow)](https://stackoverflow.com/questions/tagged/go-redis)

> go-redis is the official Redis client library for the Go programming language. It offers a straightforward interface for interacting with Redis servers. 

## Supported versions

In `go-redis` we are aiming to support the last three releases of Redis. Currently, this means we do support:
- [Redis 7.2](https://raw.githubusercontent.com/redis/redis/7.2/00-RELEASENOTES) - using Redis Stack 7.2 for modules support
- [Redis 7.4](https://raw.githubusercontent.com/redis/redis/7.4/00-RELEASENOTES) - using Redis Stack 7.4 for modules support
- [Redis 8.0](https://raw.githubusercontent.com/redis/redis/8.0/00-RELEASENOTES) - using Redis CE 8.0 where modules are included

Although the `go.mod` states it requires at minimum `go 1.18`, our CI is configured to run the tests against all three
versions of Redis and latest two versions of Go ([1.23](https://go.dev/doc/devel/release#go1.23.0),
[1.24](https://go.dev/doc/devel/release#go1.24.0)). We observe that some modules related test may not pass with
Redis Stack 7.2 and some commands are changed with Redis CE 8.0.
Please do refer to the documentation and the tests if you experience any issues. We do plan to update the go version
in the `go.mod` to `go 1.24` in one of the next releases.

## How do I Redis?

[Learn for free at Redis University](https://university.redis.com/)

[Build faster with the Redis Launchpad](https://launchpad.redis.com/)

[Try the Redis Cloud](https://redis.com/try-free/)

[Dive in developer tutorials](https://developer.redis.com/)

[Join the Redis community](https://redis.com/community/)

[Work at Redis](https://redis.com/company/careers/jobs/)

## Documentation

- [English](https://redis.uptrace.dev)
- [简体中文](https://redis.uptrace.dev/zh/)

## Resources

- [Discussions](https://github.com/redis/go-redis/discussions)
- [Chat](https://discord.gg/W4txy5AeKM)
- [Reference](https://pkg.go.dev/github.com/redis/go-redis/v9)
- [Examples](https://pkg.go.dev/github.com/redis/go-redis/v9#pkg-examples)

## Ecosystem

- [Redis Mock](https://github.com/go-redis/redismock)
- [Distributed Locks](https://github.com/bsm/redislock)
- [Redis Cache](https://github.com/go-redis/cache)
- [Rate limiting](https://github.com/go-redis/redis_rate)

This client also works with [Kvrocks](https://github.com/apache/incubator-kvrocks), a distributed
key value NoSQL database that uses RocksDB as storage engine and is compatible with Redis protocol.

## Features

- Redis commands except QUIT and SYNC.
- Automatic connection pooling.
- [Pub/Sub](https://redis.uptrace.dev/guide/go-redis-pubsub.html).
- [Pipelines and transactions](https://redis.uptrace.dev/guide/go-redis-pipelines.html).
- [Scripting](https://redis.uptrace.dev/guide/lua-scripting.html).
- [Redis Sentinel](https://redis.uptrace.dev/guide/go-redis-sentinel.html).
- [Redis Cluster](https://redis.uptrace.dev/guide/go-redis-cluster.html).
- [Redis Ring](https://redis.uptrace.dev/guide/ring.html).
- [Redis Performance Monitoring](https://redis.uptrace.dev/guide/redis-performance-monitoring.html).
- [Redis Probabilistic [RedisStack]](https://redis.io/docs/data-types/probabilistic/)

## Installation

go-redis supports 2 last Go versions and requires a Go version with
[modules](https://github.com/golang/go/wiki/Modules) support. So make sure to initialize a Go
module:

```shell
go mod init github.com/my/repo
```

Then install go-redis/**v9**:

```shell
go get github.com/redis/go-redis/v9
```

## Quickstart

```go
import (
    "context"
    "fmt"

    "github.com/redis/go-redis/v9"
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

The above can be modified to specify the version of the RESP protocol by adding the `protocol`
option to the `Options` struct:

```go
    rdb := redis.NewClient(&redis.Options{
        Addr:     "localhost:6379",
        Password: "", // no password set
        DB:       0,  // use default DB
        Protocol: 3, // specify 2 for RESP 2 or 3 for RESP 3
    })

```

### Connecting via a redis url

go-redis also supports connecting via the
[redis uri specification](https://github.com/redis/redis-specifications/tree/master/uri/redis.txt).
The example below demonstrates how the connection can easily be configured using a string, adhering
to this specification.

```go
import (
    "github.com/redis/go-redis/v9"
)

func ExampleClient() *redis.Client {
    url := "redis://user:password@localhost:6379/0?protocol=3"
    opts, err := redis.ParseURL(url)
    if err != nil {
        panic(err)
    }

    return redis.NewClient(opts)
}

```

### Instrument with OpenTelemetry

```go
import (
    "github.com/redis/go-redis/v9"
    "github.com/redis/go-redis/extra/redisotel/v9"
    "errors"
)

func main() {
    ...
    rdb := redis.NewClient(&redis.Options{...})

    if err := errors.Join(redisotel.InstrumentTracing(rdb), redisotel.InstrumentMetrics(rdb)); err != nil {
        log.Fatal(err)
    }
```


### Advanced Configuration

go-redis supports extending the client identification phase to allow projects to send their own custom client identification.

#### Default Client Identification

By default, go-redis automatically sends the client library name and version during the connection process. This feature is available in redis-server as of version 7.2. As a result, the command is "fire and forget", meaning it should fail silently, in the case that the redis server does not support this feature.

#### Disabling Identity Verification

When connection identity verification is not required or needs to be explicitly disabled, a `DisableIdentity` configuration option exists.
Initially there was a typo and the option was named `DisableIndentity` instead of `DisableIdentity`. The misspelled option is marked as Deprecated and will be removed in V10 of this library.
Although both options will work at the moment, the correct option is `DisableIdentity`. The deprecated option will be removed in V10 of this library, so please use the correct option name to avoid any issues.

To disable verification, set the `DisableIdentity` option to `true` in the Redis client options:

```go
rdb := redis.NewClient(&redis.Options{
    Addr:            "localhost:6379",
    Password:        "",
    DB:              0,
    DisableIdentity: true, // Disable set-info on connect
})
```

#### Unstable RESP3 Structures for RediSearch Commands
When integrating Redis with application functionalities using RESP3, it's important to note that some response structures aren't final yet. This is especially true for more complex structures like search and query results. We recommend using RESP2 when using the search and query capabilities, but we plan to stabilize the RESP3-based API-s in the coming versions. You can find more guidance in the upcoming release notes.

To enable unstable RESP3, set the option in your client configuration:

```go
redis.NewClient(&redis.Options{
			UnstableResp3: true,
		})
```
**Note:** When UnstableResp3 mode is enabled, it's necessary to use RawResult() and RawVal() to retrieve a raw data.
          Since, raw response is the only option for unstable search commands Val() and Result() calls wouldn't have any affect on them:

```go
res1, err := client.FTSearchWithArgs(ctx, "txt", "foo bar", &redis.FTSearchOptions{}).RawResult()
val1 := client.FTSearchWithArgs(ctx, "txt", "foo bar", &redis.FTSearchOptions{}).RawVal()
```

#### Redis-Search Default Dialect

In the Redis-Search module, **the default dialect is 2**. If needed, you can explicitly specify a different dialect using the appropriate configuration in your queries.

**Important**: Be aware that the query dialect may impact the results returned. If needed, you can revert to a different dialect version by passing the desired dialect in the arguments of the command you want to execute.
For example:
```
	res2, err := rdb.FTSearchWithArgs(ctx,
		"idx:bicycle",
		"@pickup_zone:[CONTAINS $bike]",
		&redis.FTSearchOptions{
			Params: map[string]interface{}{
				"bike": "POINT(-0.1278 51.5074)",
			},
			DialectVersion: 3,
		},
	).Result()
```
You can find further details in the [query dialect documentation](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/dialects/).

## Contributing
We welcome contributions to the go-redis library! If you have a bug fix, feature request, or improvement, please open an issue or pull request on GitHub.
We appreciate your help in making go-redis better for everyone.
If you are interested in contributing to the go-redis library, please check out our [contributing guidelines](CONTRIBUTING.md) for more information on how to get started.

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

```go
var (
	redisServerBin, _  = filepath.Abs(filepath.Join("testdata", "redis", "src", "redis-server"))
	redisServerConf, _ = filepath.Abs(filepath.Join("testdata", "redis", "redis.conf"))
)
```

For local testing, you can change the variables to refer to your local files, or create a soft link
to the corresponding folder for redis-server and copy the config file to `testdata/redis/`:

```shell
ln -s /usr/bin/redis-server ./go-redis/testdata/redis/src
cp ./go-redis/testdata/redis.conf ./go-redis/testdata/redis/
```

Lastly, run:

```shell
go test
```

Another option is to run your specific tests with an already running redis. The example below, tests
against a redis running on port 9999.:

```shell
REDIS_PORT=9999 go test <your options>
```

## See also

- [Golang ORM](https://bun.uptrace.dev) for PostgreSQL, MySQL, MSSQL, and SQLite
- [Golang PostgreSQL](https://bun.uptrace.dev/postgres/)
- [Golang HTTP router](https://bunrouter.uptrace.dev/)
- [Golang ClickHouse ORM](https://github.com/uptrace/go-clickhouse)

## Contributors

> The go-redis project was originally initiated by :star: [**uptrace/uptrace**](https://github.com/uptrace/uptrace).
> Uptrace is an open-source APM tool that supports distributed tracing, metrics, and logs. You can
> use it to monitor applications and set up automatic alerts to receive notifications via email,
> Slack, Telegram, and others.
>
> See [OpenTelemetry](https://github.com/redis/go-redis/tree/master/example/otel) example which
> demonstrates how you can use Uptrace to monitor go-redis.

Thanks to all the people who already contributed!

<a href="https://github.com/redis/go-redis/graphs/contributors">
  <img src="https://contributors-img.web.app/image?repo=redis/go-redis" />
</a>
