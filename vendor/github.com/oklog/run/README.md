# run

[![GoDoc](https://godoc.org/github.com/oklog/run?status.svg)](https://godoc.org/github.com/oklog/run) 
[![Build Status](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Foklog%2Frun%2Fbadge&style=flat-square&label=build)](https://github.com/oklog/run/actions?query=workflow%3ATest)
[![Go Report Card](https://goreportcard.com/badge/github.com/oklog/run)](https://goreportcard.com/report/github.com/oklog/run)
[![Apache 2 licensed](https://img.shields.io/badge/license-Apache2-blue.svg)](https://raw.githubusercontent.com/oklog/run/master/LICENSE)

run.Group is a universal mechanism to manage goroutine lifecycles.

Create a zero-value run.Group, and then add actors to it. Actors are defined as
a pair of functions: an **execute** function, which should run synchronously;
and an **interrupt** function, which, when invoked, should cause the execute
function to return. Finally, invoke Run, which concurrently runs all of the
actors, waits until the first actor exits, invokes the interrupt functions, and
finally returns control to the caller only once all actors have returned. This
general-purpose API allows callers to model pretty much any runnable task, and
achieve well-defined lifecycle semantics for the group.

run.Group was written to manage component lifecycles in func main for 
[OK Log](https://github.com/oklog/oklog). 
But it's useful in any circumstance where you need to orchestrate multiple
goroutines as a unit whole.
[Click here](https://www.youtube.com/watch?v=LHe1Cb_Ud_M&t=15m45s) to see a
video of a talk where run.Group is described.

## Examples

### context.Context

```go
ctx, cancel := context.WithCancel(context.Background())
g.Add(func() error {
	return myProcess(ctx, ...)
}, func(error) {
	cancel()
})
```

### net.Listener

```go
ln, _ := net.Listen("tcp", ":8080")
g.Add(func() error {
	return http.Serve(ln, nil)
}, func(error) {
	ln.Close()
})
```

### io.ReadCloser

```go
var conn io.ReadCloser = ...
g.Add(func() error {
	s := bufio.NewScanner(conn)
	for s.Scan() {
		println(s.Text())
	}
	return s.Err()
}, func(error) {
	conn.Close()
})
```

## Comparisons

Package run is somewhat similar to package 
[errgroup](https://godoc.org/golang.org/x/sync/errgroup), 
except it doesn't require actor goroutines to understand context semantics.

It's somewhat similar to package
[tomb.v1](https://godoc.org/gopkg.in/tomb.v1) or 
[tomb.v2](https://godoc.org/gopkg.in/tomb.v2),
except it has a much smaller API surface, delegating e.g. staged shutdown of 
goroutines to the caller.
