# Retry

[![GoDoc](https://img.shields.io/badge/go-documentation-blue.svg?style=flat-square)](https://pkg.go.dev/mod/github.com/sethvargo/go-retry)

Retry is a Go library for facilitating retry logic and backoff. It's highly
extensible with full control over how and when retries occur. You can also write
your own custom backoff functions by implementing the Backoff interface.

## Features

- **Extensible** - Inspired by Go's built-in HTTP package, this Go backoff and
  retry library is extensible via middleware. You can write custom backoff
  functions or use a provided filter.

- **Independent** - No external dependencies besides the Go standard library,
  meaning it won't bloat your project.

- **Concurrent** - Unless otherwise specified, everything is safe for concurrent
  use.

- **Context-aware** - Use native Go contexts to control cancellation.

## Usage

Here is an example use for connecting to a database using Go's `database/sql`
package:

```golang
package main

import (
  "context"
  "database/sql"
  "log"
  "time"

  "github.com/sethvargo/go-retry"
)

func main() {
  db, err := sql.Open("mysql", "...")
  if err != nil {
    log.Fatal(err)
  }

  ctx := context.Background()
  if err := retry.Fibonacci(ctx, 1*time.Second, func(ctx context.Context) error {
    if err := db.PingContext(ctx); err != nil {
      // This marks the error as retryable
      return retry.RetryableError(err)
    }
    return nil
  }); err != nil {
    log.Fatal(err)
  }
}
```

## Backoffs

In addition to your own custom algorithms, there are built-in algorithms for
backoff in the library.

### Constant

A very rudimentary backoff, just returns a constant value. Here is an example:

```text
1s -> 1s -> 1s -> 1s -> 1s -> 1s
```

Usage:

```golang
NewConstant(1 * time.Second)
```

### Exponential

Arguably the most common backoff, the next value is double the previous value.
Here is an example:

```text
1s -> 2s -> 4s -> 8s -> 16s -> 32s -> 64s
```

Usage:

```golang
NewExponential(1 * time.Second)
```

### Fibonacci

The Fibonacci backoff uses the Fibonacci sequence to calculate the backoff. The
next value is the sum of the current value and the previous value. This means
retires happen quickly at first, but then gradually take slower, ideal for
network-type issues. Here is an example:

```text
1s -> 1s -> 2s -> 3s -> 5s -> 8s -> 13s
```

Usage:

```golang
NewFibonacci(1 * time.Second)
```

## Modifiers (Middleware)

The built-in backoff algorithms never terminate and have no caps or limits - you
control their behavior with middleware. There's built-in middleware, but you can
also write custom middleware.

### Jitter

To reduce the changes of a thundering herd, add random jitter to the returned
value.

```golang
b := NewFibonacci(1 * time.Second)

// Return the next value, +/- 500ms
b = WithJitter(500*time.Millisecond, b)

// Return the next value, +/- 5% of the result
b = WithJitterPercent(5, b)
```

### MaxRetries

To terminate a retry, specify the maximum number of _retries_. Note this
is _retries_, not _attempts_. Attempts is retries + 1.

```golang
b := NewFibonacci(1 * time.Second)

// Stop after 4 retries, when the 5th attempt has failed. In this example, the worst case elapsed
// time would be 1s + 1s + 2s + 3s = 7s.
b = WithMaxRetries(4, b)
```

### CappedDuration

To ensure an individual calculated duration never exceeds a value, use a cap:

```golang
b := NewFibonacci(1 * time.Second)

// Ensure the maximum value is 2s. In this example, the sleep values would be
// 1s, 1s, 2s, 2s, 2s, 2s...
b = WithCappedDuration(2 * time.Second, b)
```

### WithMaxDuration

For a best-effort limit on the total execution time, specify a max duration:

```golang
b := NewFibonacci(1 * time.Second)

// Ensure the maximum total retry time is 5s.
b = WithMaxDuration(5 * time.Second, b)
```

## Benchmarks

Here are benchmarks against some other popular Go backoff and retry libraries.
You can run these benchmarks yourself via the `benchmark/` folder. Commas and
spacing fixed for clarity.

```text
Benchmark/cenkalti-7      13,052,668     87.3 ns/op
Benchmark/lestrrat-7         902,044    1,355 ns/op
Benchmark/sethvargo-7    203,914,245     5.73 ns/op
```

## Notes and Caveats

- Randomization uses `math/rand` seeded with the Unix timestamp instead of
  `crypto/rand`.
- Ordering of addition of multiple modifiers will make a difference.
  For example; ensure you add `CappedDuration` before `WithMaxDuration`, otherwise it may early out too early.
  Another example is you could add `Jitter` before or after capping depending on your desired outcome.
