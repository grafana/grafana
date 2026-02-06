# encoding/json [![GoDoc](https://godoc.org/github.com/segmentio/encoding/json?status.svg)](https://godoc.org/github.com/segmentio/encoding/json)

Go package offering a replacement implementation of the standard library's
[`encoding/json`](https://golang.org/pkg/encoding/json/) package, with much
better performance.

## Usage

The exported API of this package mirrors the standard library's
[`encoding/json`](https://golang.org/pkg/encoding/json/) package, the only
change needed to take advantage of the performance improvements is the import
path of the `json` package, from:
```go
import (
    "encoding/json"
)
```
to
```go
import (
    "github.com/segmentio/encoding/json"
)
```

One way to gain higher encoding throughput is to disable HTML escaping.
It allows the string encoding to use a much more efficient code path which
does not require parsing UTF-8 runes most of the time.

## Performance Improvements

The internal implementation uses a fair amount of unsafe operations (untyped
code, pointer arithmetic, etc...) to avoid using reflection as much as possible,
which is often the reason why serialization code has a large CPU and memory
footprint.

The package aims for zero unnecessary dynamic memory allocations and hot code
paths that are mostly free from calls into the reflect package.

## Compatibility with encoding/json

This package aims to be a drop-in replacement, therefore it is tested to behave
exactly like the standard library's package. However, there are still a few
missing features that have not been ported yet:

- Streaming decoder, currently the `Decoder` implementation offered by the
package does not support progressively reading values from a JSON array (unlike
the standard library). In our experience this is a very rare use-case, if you
need it you're better off sticking to the standard library, or spend a bit of
time implementing it in here ;)

Note that none of those features should result in performance degradations if
they were implemented in the package, and we welcome contributions!

## Trade-offs

As one would expect, we had to make a couple of trade-offs to achieve greater
performance than the standard library, but there were also features that we
did not want to give away.

Other open-source packages offering a reduced CPU and memory footprint usually
do so by designing a different API, or require code generation (therefore adding
complexity to the build process). These were not acceptable conditions for us,
as we were not willing to trade off developer productivity for better runtime
performance. To achieve this, we chose to exactly replicate the standard
library interfaces and behavior, which meant the package implementation was the
only area that we were able to work with. The internals of this package make
heavy use of unsafe pointer arithmetics and other performance optimizations,
and therefore are not as approachable as typical Go programs. Basically, we put
a bigger burden on maintainers to achieve better runtime cost without
sacrificing developer productivity.

For these reasons, we also don't believe that this code should be ported upstream
to the standard `encoding/json` package. The standard library has to remain
readable and approachable to maximize stability and maintainability, and make
projects like this one possible because a high quality reference implementation
already exists.
