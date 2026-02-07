[![Build Status](https://travis-ci.org/xrash/smetrics.svg?branch=master)](http://travis-ci.org/xrash/smetrics)

# smetrics

`smetrics` is "string metrics".

Package smetrics provides a bunch of algorithms for calculating the distance between strings.

There are implementations for calculating the popular Levenshtein distance (aka Edit Distance or Wagner-Fischer), as well as the Jaro distance, the Jaro-Winkler distance, and more.

# How to import

```go
import "github.com/xrash/smetrics"
```

# Documentation

Go to [https://pkg.go.dev/github.com/xrash/smetrics](https://pkg.go.dev/github.com/xrash/smetrics) for complete documentation.

# Example

```go
package main

import (
	"github.com/xrash/smetrics"
)

func main() {
	smetrics.WagnerFischer("POTATO", "POTATTO", 1, 1, 2)
	smetrics.WagnerFischer("MOUSE", "HOUSE", 2, 2, 4)

	smetrics.Ukkonen("POTATO", "POTATTO", 1, 1, 2)
	smetrics.Ukkonen("MOUSE", "HOUSE", 2, 2, 4)

	smetrics.Jaro("AL", "AL")
	smetrics.Jaro("MARTHA", "MARHTA")

	smetrics.JaroWinkler("AL", "AL", 0.7, 4)
	smetrics.JaroWinkler("MARTHA", "MARHTA", 0.7, 4)

	smetrics.Soundex("Euler")
	smetrics.Soundex("Ellery")

	smetrics.Hamming("aaa", "aaa")
	smetrics.Hamming("aaa", "aab")
}
```
