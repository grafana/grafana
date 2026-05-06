cli
===

[![Run Tests](https://github.com/urfave/cli/actions/workflows/cli.yml/badge.svg?branch=v1-maint)](https://github.com/urfave/cli/actions/workflows/cli.yml)
[![Go Reference](https://pkg.go.dev/badge/github.com/urfave/cli/.svg)](https://pkg.go.dev/github.com/urfave/cli/)
[![Go Report Card](https://goreportcard.com/badge/urfave/cli)](https://goreportcard.com/report/urfave/cli)
[![codecov](https://codecov.io/gh/urfave/cli/branch/v1-maint/graph/badge.svg)](https://codecov.io/gh/urfave/cli)

cli is a simple, fast, and fun package for building command line apps in Go. The
goal is to enable developers to write fast and distributable command line
applications in an expressive way.

## Usage Documentation

Usage documentation for `v1` is available [at the docs
site](https://cli.urfave.org/v1/getting-started/) or in-tree at
[./docs/v1/manual.md](./docs/v1/manual.md)

## Installation

Make sure you have a working Go environment. Go version 1.18+ is supported.

### Supported platforms

cli is tested against multiple versions of Go on Linux, and against the latest released
version of Go on OS X and Windows.  For full details, see
[./.github/workflows/cli.yml](./.github/workflows/cli.yml).

### Build tags

You can use the following build tags:

#### `urfave_cli_no_docs`

When set, this removes `ToMarkdown` and `ToMan` methods, so your application
won't be able to call those. This reduces the resulting binary size by about
300-400 KB (measured using Go 1.18.1 on Linux/amd64), due to less dependencies.

### Using `v1` releases

```
$ go get github.com/urfave/cli
```

```go
...
import (
  "github.com/urfave/cli"
)
...
```
