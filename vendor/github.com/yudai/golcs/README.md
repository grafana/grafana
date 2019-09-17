# Go Longest Common Subsequence (LCS)

[![GoDoc](https://godoc.org/github.com/yudai/golcs?status.svg)][godoc]
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg)][license]

[godoc]: https://godoc.org/github.com/yudai/golcs
[license]: https://github.com/yudai/golcs/blob/master/LICENSE

A package to calculate [LCS](http://en.wikipedia.org/wiki/Longest_common_subsequence_problem) of slices.

## Usage

```sh
go get github.com/yudai/golcs
```

```go
import " github.com/yudai/golcs"

left = []interface{}{1, 2, 5, 3, 1, 1, 5, 8, 3}
right = []interface{}{1, 2, 3, 3, 4, 4, 5, 1, 6}

lcs := golcs.New(left, right)

lcs.Values()     // LCS values       => []interface{}{1, 2, 5, 1}
lcs.IndexPairs() // Matched indices  => [{Left: 0, Right: 0}, {Left: 1, Right: 1}, {Left: 2, Right: 6}, {Left: 4, Right: 7}]
lcs.Length()     // Matched length   => 4

lcs.Table()      // Memo table
```

All the methods of `Lcs` cache their return values. For example, the memo table is calculated only once and reused when `Values()`, `Length()` and other methods are called.


## FAQ

### How can I give `[]byte` values to `Lcs()` as its arguments?

As `[]interface{}` is incompatible with `[]othertype` like `[]byte`, you need to create a `[]interface{}` slice and copy the values in your `[]byte` slice into it. Unfortunately, Go doesn't provide any mesure to cast a slice into `[]interface{}` with zero cost. Your copy costs O(n).

```go
leftBytes := []byte("TGAGTA")
left = make([]interface{}, len(leftBytes))
for i, v := range leftBytes {
	left[i] = v
}

rightBytes := []byte("GATA")
right = make([]interface{}, len(rightBytes))
for i, v := range rightBytes {
	right[i] = v
}

lcs.New(left, right)
```


## LICENSE

The MIT license (See `LICENSE` for detail)
