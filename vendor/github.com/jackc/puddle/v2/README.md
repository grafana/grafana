[![Go Reference](https://pkg.go.dev/badge/github.com/jackc/puddle/v2.svg)](https://pkg.go.dev/github.com/jackc/puddle/v2)
![Build Status](https://github.com/jackc/puddle/actions/workflows/ci.yml/badge.svg)

# Puddle

Puddle is a tiny generic resource pool library for Go that uses the standard
context library to signal cancellation of acquires. It is designed to contain
the minimum functionality required for a resource pool. It can be used directly
or it can be used as the base for a domain specific resource pool. For example,
a database connection pool may use puddle internally and implement health checks
and keep-alive behavior without needing to implement any concurrent code of its
own.

## Features

* Acquire cancellation via context standard library
* Statistics API for monitoring pool pressure
* No dependencies outside of standard library and golang.org/x/sync
* High performance
* 100% test coverage of reachable code

## Example Usage

```go
package main

import (
	"context"
	"log"
	"net"

	"github.com/jackc/puddle/v2"
)

func main() {
	constructor := func(context.Context) (net.Conn, error) {
		return net.Dial("tcp", "127.0.0.1:8080")
	}
	destructor := func(value net.Conn) {
		value.Close()
	}
	maxPoolSize := int32(10)

	pool, err := puddle.NewPool(&puddle.Config[net.Conn]{Constructor: constructor, Destructor: destructor, MaxSize: maxPoolSize})
	if err != nil {
		log.Fatal(err)
	}

	// Acquire resource from the pool.
	res, err := pool.Acquire(context.Background())
	if err != nil {
		log.Fatal(err)
	}

	// Use resource.
	_, err = res.Value().Write([]byte{1})
	if err != nil {
		log.Fatal(err)
	}

	// Release when done.
	res.Release()
}
```

## Status

Puddle is stable and feature complete.

* Bug reports and fixes are welcome.
* New features will usually not be accepted if they can be feasibly implemented in a wrapper.
* Performance optimizations will usually not be accepted unless the performance issue rises to the level of a bug.

## Supported Go Versions

puddle supports the same versions of Go that are supported by the Go project. For [Go](https://golang.org/doc/devel/release.html#policy) that is the two most recent major releases. This means puddle supports Go 1.19 and higher.

## License

MIT
