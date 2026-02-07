[![license](https://img.shields.io/github/license/tjhop/slog-gokit)](https://github.com/tjhop/slog-gokit/blob/master/LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/tjhop/slog-gokit)](https://goreportcard.com/report/github.com/tjhop/slog-gokit)
[![golangci-lint](https://github.com/tjhop/slog-gokit/actions/workflows/golangci-lint.yaml/badge.svg)](https://github.com/tjhop/slog-gokit/actions/workflows/golangci-lint.yaml)
[![Latest Release](https://img.shields.io/github/v/release/tjhop/slog-gokit)](https://github.com/tjhop/slog-gokit/releases/latest)

# Go slog-gokit Adapter

This library provides a custom slog.Handler that wraps a go-kit Logger, so that loggers created via `slog.New()` chain their log calls to the internal go-kit Logger.

## Install

```bash
go get github.com/tjhop/slog-gokit
```

## Documentation

Documentation can be found here:

https://pkg.go.dev/github.com/tjhop/slog-gokit

## Example

```go
package main

import (
	"log/slog"
	"os"

	"github.com/go-kit/log"
	slgk "github.com/tjhop/slog-gokit"
)

func main() {
	// Take an existing go-kit/log Logger:
	gklogger := log.NewLogfmtLogger(os.Stderr)

	// Create an slog Logger that chains log calls to the go-kit/log Logger:
	slogger := slog.New(slgk.NewGoKitHandler(gklogger, nil))
	slogger.WithGroup("example_group").With("foo", "bar").Info("hello world")

	// The slog Logger produces logs at slog.LevelInfo by default.
	// Optionally create an slog.Leveler to dynamically adjust the level of
	// the slog Logger.
	lvl := &slog.LevelVar{}
	lvl.Set(slog.LevelDebug)
	slogger = slog.New(slgk.NewGoKitHandler(gklogger, lvl))
	slogger.WithGroup("example_group").With("foo", "bar").Info("hello world")
}
```

## Development

Contributions are welcome! Commits should follow [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) syntax.

### Required Software/Tools

- Working Go environment
- Docker
- GNU Make
