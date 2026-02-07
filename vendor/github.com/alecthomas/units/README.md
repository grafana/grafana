[![Go Reference](https://pkg.go.dev/badge/github.com/alecthomas/units.svg)](https://pkg.go.dev/github.com/alecthomas/units)

# Units - Helpful unit multipliers and functions for Go

The goal of this package is to have functionality similar to the [time](http://golang.org/pkg/time/) package.

It allows for code like this:

```go
n, err := ParseBase2Bytes("1KB")
// n == 1024
n = units.Mebibyte * 512
```
