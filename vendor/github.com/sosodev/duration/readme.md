# duration

[![Go Reference](https://pkg.go.dev/badge/github.com/sosodev/duration.svg)](https://pkg.go.dev/github.com/sosodev/duration)

It's a Go module for parsing [ISO 8601 durations](https://en.wikipedia.org/wiki/ISO_8601#Durations) and converting them to the often much more useful `time.Duration`.

## why?

ISO 8601 is a pretty common standard and sometimes these durations show up in the wild.

## installation

`go get github.com/sosodev/duration`

## [usage](https://go.dev/play/p/Nz5akjy1c6W)

```go
package main

import (
	"fmt"
	"time"
	"github.com/sosodev/duration"
)

func main() {
	d, err := duration.Parse("P3Y6M4DT12H30M5.5S")
	if err != nil {
		panic(err)
	}
	
	fmt.Println(d.Years) // 3
	fmt.Println(d.Months) // 6
	fmt.Println(d.Days) // 4
	fmt.Println(d.Hours) // 12
	fmt.Println(d.Minutes) // 30
	fmt.Println(d.Seconds) // 5.5
	
	d, err = duration.Parse("PT33.3S")
	if err != nil {
		panic(err)
	}
	
	fmt.Println(d.ToTimeDuration() == time.Second*33+time.Millisecond*300) // true
}
```

## correctness

This module aims to implement the ISO 8601 duration specification correctly. It properly supports fractional units and has unit tests
that assert the correctness of it's parsing and conversion to a `time.Duration`.

With that said durations with months or years specified will be converted to `time.Duration` with a little fuzziness. Since I
couldn't find a standard value, and they obviously vary, for those I used `2.628e+15` nanoseconds for a month and `3.154e+16` nanoseconds for a year.
