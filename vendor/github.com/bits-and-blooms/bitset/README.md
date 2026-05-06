# bitset

*Go language library to map between non-negative integers and boolean values*

[![Test](https://github.com/bits-and-blooms/bitset/workflows/Test/badge.svg)](https://github.com/willf/bitset/actions?query=workflow%3ATest)
[![Go Report Card](https://goreportcard.com/badge/github.com/willf/bitset)](https://goreportcard.com/report/github.com/willf/bitset)
[![PkgGoDev](https://pkg.go.dev/badge/github.com/bits-and-blooms/bitset?tab=doc)](https://pkg.go.dev/github.com/bits-and-blooms/bitset?tab=doc)


This library is part of the [awesome go collection](https://github.com/avelino/awesome-go). It is used in production by several important systems:

* [beego](https://github.com/beego/beego)
* [CubeFS](https://github.com/cubefs/cubefs)
* [Amazon EKS Distro](https://github.com/aws/eks-distro)
* [sourcegraph](https://github.com/sourcegraph/sourcegraph-public-snapshot)
* [torrent](https://github.com/anacrolix/torrent)


## Description

Package bitset implements bitsets, a mapping between non-negative integers and boolean values.
It should be more efficient than map[uint] bool.

It provides methods for setting, clearing, flipping, and testing individual integers.

But it also provides set intersection, union, difference, complement, and symmetric operations, as well as tests to check whether any, all, or no bits are set, and querying a bitset's current length and number of positive bits.

BitSets are expanded to the size of the largest set bit; the memory allocation is approximately Max bits, where Max is the largest set bit. BitSets are never shrunk automatically, but `Shrink` and `Compact` methods are available. On creation, a hint can be given for the number of bits that will be used.

Many of the methods, including Set, Clear, and Flip, return a BitSet pointer, which allows for chaining.

### Example use:

```go
package main

import (
	"fmt"
	"math/rand"

	"github.com/bits-and-blooms/bitset"
)

func main() {
	fmt.Printf("Hello from BitSet!\n")
	var b bitset.BitSet
	// play some Go Fish
	for i := 0; i < 100; i++ {
		card1 := uint(rand.Intn(52))
		card2 := uint(rand.Intn(52))
		b.Set(card1)
		if b.Test(card2) {
			fmt.Println("Go Fish!")
		}
		b.Clear(card1)
	}

	// Chaining
	b.Set(10).Set(11)

	for i, e := b.NextSet(0); e; i, e = b.NextSet(i + 1) {
		fmt.Println("The following bit is set:", i)
	}
	if b.Intersection(bitset.New(100).Set(10)).Count() == 1 {
		fmt.Println("Intersection works.")
	} else {
		fmt.Println("Intersection doesn't work???")
	}
}
```

If you have Go 1.23 or better, you can iterate over the set bits like so:

```go
for i := range b.EachSet() {}
```



Package documentation is at: https://pkg.go.dev/github.com/bits-and-blooms/bitset?tab=doc

## Serialization


You may serialize a bitset safely and portably to a stream
of bytes as follows:
```Go
    const length = 9585
	const oneEvery = 97
	bs := bitset.New(length)
	// Add some bits
	for i := uint(0); i < length; i += oneEvery {
		bs = bs.Set(i)
	}

	var buf bytes.Buffer
	n, err := bs.WriteTo(&buf)
	if err != nil {
		// failure
	}
	// Here n == buf.Len()
```
You can later deserialize the result as follows:

```Go
	// Read back from buf
	bs = bitset.New()
	n, err = bs.ReadFrom(&buf)
	if err != nil {
		// error
	}
	// n is the number of bytes read
```

The `ReadFrom` function attempts to read the data into the existing
BitSet instance, to minimize memory allocations.


*Performance tip*: 
When reading and writing to a file or a network connection, you may get better performance by 
wrapping your streams with `bufio` instances.

E.g., 
```Go
	f, err := os.Create("myfile")
	w := bufio.NewWriter(f)
```
```Go
	f, err := os.Open("myfile")
	r := bufio.NewReader(f)
```

## Memory Usage

The memory usage of a bitset using `N` bits is at least `N/8` bytes. The number of bits in a bitset is at least as large as one plus the greatest bit index you have accessed. Thus it is possible to run out of memory while using a bitset. If you have lots of bits, you might prefer compressed bitsets, like the [Roaring bitmaps](https://roaringbitmap.org) and its [Go implementation](https://github.com/RoaringBitmap/roaring).

The `roaring` library allows you to go back and forth between compressed Roaring bitmaps and the conventional bitset instances:
```Go
			mybitset := roaringbitmap.ToBitSet()
			newroaringbitmap := roaring.FromBitSet(mybitset)
```


### Goroutine safety

In general, it's not safe to access the same BitSet using different goroutines--they are unsynchronized for performance.

Should you want to access a BitSet from more than one goroutine, you should provide synchronization. Typically this is done by using channels to pass the *BitSet around (in Go style; so there is only ever one owner), or by using `sync.Mutex` to serialize operations on BitSets.

## Installation

```bash
go get github.com/bits-and-blooms/bitset
```

## Contributing

If you wish to contribute to this project, please branch and issue a pull request against master ("[GitHub Flow](https://guides.github.com/introduction/flow/)")

## Running all tests

Before committing the code, please check if it passes tests, has adequate coverage, etc.
```bash
go test
go test -cover
```
