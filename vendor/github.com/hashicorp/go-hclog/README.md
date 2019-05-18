# go-hclog

[![Go Documentation](http://img.shields.io/badge/go-documentation-blue.svg?style=flat-square)][godocs]

[godocs]: https://godoc.org/github.com/hashicorp/go-hclog

`go-hclog` is a package for Go that provides a simple key/value logging
interface for use in development and production environments.

It provides logging levels that provide decreased output based upon the
desired amount of output, unlike the standard library `log` package.

It provides `Printf` style logging of values via `hclog.Fmt()`.

It provides a human readable output mode for use in development as well as
JSON output mode for production.

## Stability Note

While this library is fully open source and HashiCorp will be maintaining it
(since we are and will be making extensive use of it), the API and output
format is subject to minor changes as we fully bake and vet it in our projects.
This notice will be removed once it's fully integrated into our major projects
and no further changes are anticipated.

## Installation and Docs

Install using `go get github.com/hashicorp/go-hclog`.

Full documentation is available at
http://godoc.org/github.com/hashicorp/go-hclog

## Usage

### Use the global logger

```go
hclog.Default().Info("hello world")
```

```text
2017-07-05T16:15:55.167-0700 [INFO ] hello world
```

(Note timestamps are removed in future examples for brevity.)

### Create a new logger

```go
appLogger := hclog.New(&hclog.LoggerOptions{
	Name:  "my-app",
	Level: hclog.LevelFromString("DEBUG"),
})
```

### Emit an Info level message with 2 key/value pairs

```go
input := "5.5"
_, err := strconv.ParseInt(input, 10, 32)
if err != nil {
	appLogger.Info("Invalid input for ParseInt", "input", input, "error", err)
}
```

```text
... [INFO ] my-app: Invalid input for ParseInt: input=5.5 error="strconv.ParseInt: parsing "5.5": invalid syntax"
```

### Create a new Logger for a major subsystem

```go
subsystemLogger := appLogger.Named("transport")
subsystemLogger.Info("we are transporting something")
```

```text
... [INFO ] my-app.transport: we are transporting something
```

Notice that logs emitted by `subsystemLogger` contain `my-app.transport`,
reflecting both the application and subsystem names.

### Create a new Logger with fixed key/value pairs

Using `With()` will include a specific key-value pair in all messages emitted
by that logger.

```go
requestID := "5fb446b6-6eba-821d-df1b-cd7501b6a363"
requestLogger := subsystemLogger.With("request", requestID)
requestLogger.Info("we are transporting a request")
```

```text
... [INFO ] my-app.transport: we are transporting a request: request=5fb446b6-6eba-821d-df1b-cd7501b6a363
```

This allows sub Loggers to be context specific without having to thread that
into all the callers.

### Using `hclog.Fmt()`

```go
var int totalBandwidth = 200
appLogger.Info("total bandwidth exceeded", "bandwidth", hclog.Fmt("%d GB/s", totalBandwidth))
```

```text
... [INFO ] my-app: total bandwidth exceeded: bandwidth="200 GB/s"
```

### Use this with code that uses the standard library logger

If you want to use the standard library's `log.Logger` interface you can wrap
`hclog.Logger` by calling the `StandardLogger()` method. This allows you to use
it with the familiar `Println()`, `Printf()`, etc. For example:

```go
stdLogger := appLogger.StandardLogger(&hclog.StandardLoggerOptions{
	InferLevels: true,
})
// Printf() is provided by stdlib log.Logger interface, not hclog.Logger
stdLogger.Printf("[DEBUG] %+v", stdLogger)
```

```text
... [DEBUG] my-app: &{mu:{state:0 sema:0} prefix: flag:0 out:0xc42000a0a0 buf:[]}
```

Alternatively, you may configure the system-wide logger:

```go
// log the standard logger from 'import "log"'
log.SetOutput(appLogger.Writer(&hclog.StandardLoggerOptions{InferLevels: true}))
log.SetPrefix("")
log.SetFlags(0)

log.Printf("[DEBUG] %d", 42)
```

```text
... [DEBUG] my-app: 42
```

Notice that if `appLogger` is initialized with the `INFO` log level _and_ you
specify `InferLevels: true`, you will not see any output here. You must change
`appLogger` to `DEBUG` to see output. See the docs for more information.
