# package log

[![Go Reference](https://pkg.go.dev/badge/github.com/go-kit/log.svg)](https://pkg.go.dev/github.com/go-kit/log)
[![Go Report Card](https://goreportcard.com/badge/go-kit/log)](https://goreportcard.com/report/go-kit/log)
[![GitHub Actions](https://github.com/go-kit/log/actions/workflows/test.yml/badge.svg)](https://github.com/go-kit/log/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/go-kit/log/badge.svg?branch=main)](https://coveralls.io/github/go-kit/log?branch=main)

`package log` provides a minimal interface for structured logging in services.
It may be wrapped to encode conventions, enforce type-safety, provide leveled
logging, and so on. It can be used for both typical application log events,
and log-structured data streams.

## Structured logging

Structured logging is, basically, conceding to the reality that logs are
_data_, and warrant some level of schematic rigor. Using a stricter,
key/value-oriented message format for our logs, containing contextual and
semantic information, makes it much easier to get insight into the
operational activity of the systems we build. Consequently, `package log` is
of the strong belief that "[the benefits of structured logging outweigh the
minimal effort involved](https://www.thoughtworks.com/radar/techniques/structured-logging)".

Migrating from unstructured to structured logging is probably a lot easier
than you'd expect.

```go
// Unstructured
log.Printf("HTTP server listening on %s", addr)

// Structured
logger.Log("transport", "HTTP", "addr", addr, "msg", "listening")
```

## Usage

### Typical application logging

```go
w := log.NewSyncWriter(os.Stderr)
logger := log.NewLogfmtLogger(w)
logger.Log("question", "what is the meaning of life?", "answer", 42)

// Output:
// question="what is the meaning of life?" answer=42
```

### Contextual Loggers

```go
func main() {
	var logger log.Logger
	logger = log.NewLogfmtLogger(log.NewSyncWriter(os.Stderr))
	logger = log.With(logger, "instance_id", 123)

	logger.Log("msg", "starting")
	NewWorker(log.With(logger, "component", "worker")).Run()
	NewSlacker(log.With(logger, "component", "slacker")).Run()
}

// Output:
// instance_id=123 msg=starting
// instance_id=123 component=worker msg=running
// instance_id=123 component=slacker msg=running
```

### Interact with stdlib logger

Redirect stdlib logger to Go kit logger.

```go
import (
	"os"
	stdlog "log"
	kitlog "github.com/go-kit/log"
)

func main() {
	logger := kitlog.NewJSONLogger(kitlog.NewSyncWriter(os.Stdout))
	stdlog.SetOutput(kitlog.NewStdlibAdapter(logger))
	stdlog.Print("I sure like pie")
}

// Output:
// {"msg":"I sure like pie","ts":"2016/01/01 12:34:56"}
```

Or, if, for legacy reasons, you need to pipe all of your logging through the
stdlib log package, you can redirect Go kit logger to the stdlib logger.

```go
logger := kitlog.NewLogfmtLogger(kitlog.StdlibWriter{})
logger.Log("legacy", true, "msg", "at least it's something")

// Output:
// 2016/01/01 12:34:56 legacy=true msg="at least it's something"
```

### Timestamps and callers

```go
var logger log.Logger
logger = log.NewLogfmtLogger(log.NewSyncWriter(os.Stderr))
logger = log.With(logger, "ts", log.DefaultTimestampUTC, "caller", log.DefaultCaller)

logger.Log("msg", "hello")

// Output:
// ts=2016-01-01T12:34:56Z caller=main.go:15 msg=hello
```

## Levels

Log levels are supported via the [level package](https://godoc.org/github.com/go-kit/log/level).

## Supported output formats

- [Logfmt](https://brandur.org/logfmt) ([see also](https://blog.codeship.com/logfmt-a-log-format-thats-easy-to-read-and-write))
- JSON

## Enhancements

`package log` is centered on the one-method Logger interface.

```go
type Logger interface {
	Log(keyvals ...interface{}) error
}
```

This interface, and its supporting code like is the product of much iteration
and evaluation. For more details on the evolution of the Logger interface,
see [The Hunt for a Logger Interface](http://go-talks.appspot.com/github.com/ChrisHines/talks/structured-logging/structured-logging.slide#1),
a talk by [Chris Hines](https://github.com/ChrisHines).
Also, please see
[#63](https://github.com/go-kit/kit/issues/63),
[#76](https://github.com/go-kit/kit/pull/76),
[#131](https://github.com/go-kit/kit/issues/131),
[#157](https://github.com/go-kit/kit/pull/157),
[#164](https://github.com/go-kit/kit/issues/164), and
[#252](https://github.com/go-kit/kit/pull/252)
to review historical conversations about package log and the Logger interface.

Value-add packages and suggestions,
like improvements to [the leveled logger](https://godoc.org/github.com/go-kit/log/level),
are of course welcome. Good proposals should

- Be composable with [contextual loggers](https://godoc.org/github.com/go-kit/log#With),
- Not break the behavior of [log.Caller](https://godoc.org/github.com/go-kit/log#Caller) in any wrapped contextual loggers, and
- Be friendly to packages that accept only an unadorned log.Logger.

## Benchmarks & comparisons

There are a few Go logging benchmarks and comparisons that include Go kit's package log.

- [imkira/go-loggers-bench](https://github.com/imkira/go-loggers-bench) includes kit/log
- [uber-common/zap](https://github.com/uber-common/zap), a zero-alloc logging library, includes a comparison with kit/log
