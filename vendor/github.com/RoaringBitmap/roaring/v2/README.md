# roaring 

[![GoDoc](https://godoc.org/github.com/RoaringBitmap/roaring?status.svg)](https://godoc.org/github.com/RoaringBitmap/roaring) [![Go Report Card](https://goreportcard.com/badge/RoaringBitmap/roaring)](https://goreportcard.com/report/github.com/RoaringBitmap/roaring)

![Go-CI](https://github.com/RoaringBitmap/roaring/workflows/Go-CI/badge.svg)
![Go-ARM-CI](https://github.com/RoaringBitmap/roaring/workflows/Go-ARM-CI/badge.svg)
![Go-Windows-CI](https://github.com/RoaringBitmap/roaring/workflows/Go-Windows-CI/badge.svg)
=============

This is a go version of the Roaring bitmap data structure. 

Roaring bitmaps are used by several major systems such as [Apache Lucene][lucene] and derivative systems such as [Solr][solr] and
[Elasticsearch][elasticsearch], [Apache Druid (Incubating)][druid], [LinkedIn Pinot][pinot], [Netflix Atlas][atlas],  [Apache Spark][spark], [OpenSearchServer][opensearchserver], [anacrolix/torrent][anacrolix/torrent], [Whoosh][whoosh], [Redpanda](https://github.com/redpanda-data/redpanda), [Pilosa][pilosa],  [Microsoft Visual Studio Team Services (VSTS)][vsts], and eBay's [Apache Kylin][kylin]. The YouTube SQL Engine, [Google Procella](https://research.google/pubs/pub48388/), uses Roaring bitmaps for indexing.

[lucene]: https://lucene.apache.org/
[solr]: https://lucene.apache.org/solr/
[elasticsearch]: https://www.elastic.co/products/elasticsearch
[druid]: https://druid.apache.org/
[spark]: https://spark.apache.org/
[opensearchserver]: http://www.opensearchserver.com
[anacrolix/torrent]: https://github.com/anacrolix/torrent
[whoosh]: https://bitbucket.org/mchaput/whoosh/wiki/Home
[pilosa]: https://www.pilosa.com/
[kylin]: http://kylin.apache.org/
[pinot]: http://github.com/linkedin/pinot/wiki
[vsts]: https://www.visualstudio.com/team-services/
[atlas]: https://github.com/Netflix/atlas

Roaring bitmaps are found to work well in many important applications:

> Use Roaring for bitmap compression whenever possible. Do not use other bitmap compression methods ([Wang et al., SIGMOD 2017](http://db.ucsd.edu/wp-content/uploads/2017/03/sidm338-wangA.pdf))


The ``roaring`` Go library is used by
* [anacrolix/torrent]
* [InfluxDB](https://www.influxdata.com)
* [Pilosa](https://www.pilosa.com/)
* [Bleve](http://www.blevesearch.com)
* [Weaviate](https://github.com/weaviate/weaviate)
* [lindb](https://github.com/lindb/lindb)
* [Elasticell](https://github.com/deepfabric/elasticell)
* [SourceGraph](https://github.com/sourcegraph/sourcegraph)
* [M3](https://github.com/m3db/m3)
* [trident](https://github.com/NetApp/trident)
* [Husky](https://www.datadoghq.com/blog/engineering/introducing-husky/)
* [FrostDB](https://github.com/polarsignals/frostdb)

This library is used in production in several systems, it is part of the [Awesome Go collection](https://awesome-go.com).


There are also  [Java](https://github.com/RoaringBitmap/RoaringBitmap) and [C/C++](https://github.com/RoaringBitmap/CRoaring) versions.  The Java, C, C++ and Go version are binary compatible: e.g,  you can save bitmaps
from a Java program and load them back in Go, and vice versa. We have a [format specification](https://github.com/RoaringBitmap/RoaringFormatSpec).


This code is licensed under Apache License, Version 2.0 (ASL2.0).

Copyright 2016-... by the authors.

When should you use a bitmap?
===================================


Sets are a fundamental abstraction in
software. They can be implemented in various
ways, as hash sets, as trees, and so forth.
In databases and search engines, sets are often an integral
part of indexes. For example, we may need to maintain a set
of all documents or rows  (represented by numerical identifier)
that satisfy some property. Besides adding or removing
elements from the set, we need fast functions
to compute the intersection, the union, the difference between sets, and so on.


To implement a set
of integers, a particularly appealing strategy is the
bitmap (also called bitset or bit vector). Using n bits,
we can represent any set made of the integers from the range
[0,n): the ith bit is set to one if integer i is present in the set.
Commodity processors use words of W=32 or W=64 bits. By combining many such words, we can
support large values of n. Intersections, unions and differences can then be implemented
 as bitwise AND, OR and ANDNOT operations.
More complicated set functions can also be implemented as bitwise operations.

When the bitset approach is applicable, it can be orders of
magnitude faster than other possible implementation of a set (e.g., as a hash set)
while using several times less memory.

However, a bitset, even a compressed one is not always applicable. For example, if
you have 1000 random-looking integers, then a simple array might be the best representation.
We refer to this case as the "sparse" scenario.

When should you use compressed bitmaps?
===================================

An uncompressed BitSet can use a lot of memory. For example, if you take a BitSet
and set the bit at position 1,000,000 to true and you have just over 100kB. That is over 100kB
to store the position of one bit. This is wasteful  even if you do not care about memory:
suppose that you need to compute the intersection between this BitSet and another one
that has a bit at position 1,000,001 to true, then you need to go through all these zeroes,
whether you like it or not. That can become very wasteful.

This being said, there are definitively cases where attempting to use compressed bitmaps is wasteful.
For example, if you have a small universe size. E.g., your bitmaps represent sets of integers
from [0,n) where n is small (e.g., n=64 or n=128). If you can use uncompressed BitSet and
it does not blow up your memory usage,  then compressed bitmaps are probably not useful
to you. In fact, if you do not need compression, then a BitSet offers remarkable speed.

The sparse scenario is another use case where compressed bitmaps should not be used.
Keep in mind that random-looking data is usually not compressible. E.g., if you have a small set of
32-bit random integers, it is not mathematically possible to use far less than 32 bits per integer,
and attempts at compression can be counterproductive.

How does Roaring compares with the alternatives?
==================================================


Most alternatives to Roaring are part of a larger family of compressed bitmaps that are run-length-encoded
bitmaps. They identify long runs of 1s or 0s and they represent them with a marker word.
If you have a local mix of 1s and 0, you use an uncompressed word.

There are many formats in this family:

* Oracle's BBC is an obsolete format at this point: though it may provide good compression,
it is likely much slower than more recent alternatives due to excessive branching.
* WAH is a patented variation on BBC that provides better performance.
* Concise is a variation on the patented WAH. It some specific instances, it can compress
much better than WAH (up to 2x better), but it is generally slower.
* EWAH is both free of patent, and it is faster than all the above. On the downside, it
does not compress quite as well. It is faster because it allows some form of "skipping"
over uncompressed words. So though none of these formats are great at random access, EWAH
is better than the alternatives.



There is a big problem with these formats however that can hurt you badly in some cases: there is no random access. If you want to check whether a given value is present in the set, you have to start from the beginning and "uncompress" the whole thing. This means that if you want to intersect a big set with a large set, you still have to uncompress the whole big set in the worst case...

Roaring solves this problem. It works in the following manner. It divides the data into chunks of 2<sup>16</sup> integers
(e.g., [0, 2<sup>16</sup>), [2<sup>16</sup>, 2 x 2<sup>16</sup>), ...). Within a chunk, it can use an uncompressed bitmap, a simple list of integers,
or a list of runs. Whatever format it uses, they all allow you to check for the presence of any one value quickly
(e.g., with a binary search). The net result is that Roaring can compute many operations much faster than run-length-encoded
formats like WAH, EWAH, Concise... Maybe surprisingly, Roaring also generally offers better compression ratios.





### References

- Daniel Lemire, Owen Kaser, Nathan Kurz, Luca Deri, Chris O'Hara, François Saint-Jacques, Gregory Ssi-Yan-Kai, Roaring Bitmaps: Implementation of an Optimized Software Library, Software: Practice and Experience 48 (4), 2018 [arXiv:1709.07821](https://arxiv.org/abs/1709.07821)
-  Samy Chambi, Daniel Lemire, Owen Kaser, Robert Godin,
Better bitmap performance with Roaring bitmaps,
Software: Practice and Experience 46 (5), 2016.[arXiv:1402.6407](http://arxiv.org/abs/1402.6407) This paper used data from http://lemire.me/data/realroaring2014.html
- Daniel Lemire, Gregory Ssi-Yan-Kai, Owen Kaser, Consistently faster and smaller compressed bitmaps with Roaring, Software: Practice and Experience 46 (11), 2016. [arXiv:1603.06549](http://arxiv.org/abs/1603.06549)

### Dependencies

Dependencies are fetched automatically by giving the `-t` flag to `go get`.

they include
  - github.com/bits-and-blooms/bitset
  - github.com/mschoch/smat
  - github.com/glycerine/go-unsnap-stream
  - github.com/philhofer/fwd
  - github.com/jtolds/gls

Note that the smat library requires Go 1.15 or better.

#### Installation

  - go get -t github.com/RoaringBitmap/roaring

### Instructions for contributors

Using bash or other common shells:
```
$ git clone git@github.com:RoaringBitmap/roaring.git
$ export GO111MODULE=on 
$ go mod tidy
$ go test -v
```

### Example

Here is a simplified but complete example:

```go
package main

import (
    "fmt"
    "github.com/RoaringBitmap/roaring/v2"
    "bytes"
)


func main() {
    // example inspired by https://github.com/fzandona/goroar
    fmt.Println("==roaring==")
    rb1 := roaring.BitmapOf(1, 2, 3, 4, 5, 100, 1000)
    fmt.Println(rb1.String())

    rb2 := roaring.BitmapOf(3, 4, 1000)
    fmt.Println(rb2.String())

    rb3 := roaring.New()
    fmt.Println(rb3.String())

    fmt.Println("Cardinality: ", rb1.GetCardinality())

    fmt.Println("Contains 3? ", rb1.Contains(3))

    rb1.And(rb2)

    rb3.Add(1)
    rb3.Add(5)

    rb3.Or(rb1)

    // computes union of the three bitmaps in parallel using 4 workers  
    roaring.ParOr(4, rb1, rb2, rb3)
    // computes intersection of the three bitmaps in parallel using 4 workers  
    roaring.ParAnd(4, rb1, rb2, rb3)


    // prints 1, 3, 4, 5, 1000
    i := rb3.Iterator()
    for i.HasNext() {
        fmt.Println(i.Next())
    }
    fmt.Println()

    // next we include an example of serialization
    buf := new(bytes.Buffer)
    rb1.WriteTo(buf) // we omit error handling
    newrb:= roaring.New()
    newrb.ReadFrom(buf)
    if rb1.Equals(newrb) {
    	fmt.Println("I wrote the content to a byte stream and read it back.")
    }
    // you can iterate over bitmaps using ReverseIterator(), Iterator, ManyIterator()
}
```

If you wish to use serialization and handle errors, you might want to
consider the following sample of code:

```go
	rb := BitmapOf(1, 2, 3, 4, 5, 100, 1000)
	buf := new(bytes.Buffer)
	size,err:=rb.WriteTo(buf)
	if err != nil {
		fmt.Println("Failed writing") // return or panic
	}
	newrb:= New()
	size,err=newrb.ReadFrom(buf)
	if err != nil {
		fmt.Println("Failed reading") // return or panic
	}
	// if buf is an untrusted source, you should validate the result
	// (this adds a bit of complexity but it is necessary for security)
	if newrb.Validate() != nil {
		fmt.Println("Failed validation") // return or panic
	}
	if ! rb.Equals(newrb) {
		fmt.Println("Cannot retrieve serialized version")
	}
```

Given N integers in [0,x), then the serialized size in bytes of
a Roaring bitmap should never exceed this bound:

`` 8 + 9 * ((long)x+65535)/65536 + 2 * N ``

That is, given a fixed overhead for the universe size (x), Roaring
bitmaps never use more than 2 bytes per integer. You can call
``BoundSerializedSizeInBytes`` for a more precise estimate.

### 64-bit Roaring

By default, roaring is used to stored unsigned 32-bit integers. However, we also offer
an extension dedicated to 64-bit integers. It supports roughly the same functions:

```go
package main

import (
    "fmt"
    "github.com/RoaringBitmap/roaring/v2/roaring64"
    "bytes"
)


func main() {
    // example inspired by https://github.com/fzandona/goroar
    fmt.Println("==roaring64==")
    rb1 := roaring64.BitmapOf(1, 2, 3, 4, 5, 100, 1000)
    fmt.Println(rb1.String())

    rb2 := roaring64.BitmapOf(3, 4, 1000)
    fmt.Println(rb2.String())

    rb3 := roaring64.New()
    fmt.Println(rb3.String())

    fmt.Println("Cardinality: ", rb1.GetCardinality())

    fmt.Println("Contains 3? ", rb1.Contains(3))

    rb1.And(rb2)

    rb3.Add(1)
    rb3.Add(5)

    rb3.Or(rb1)



    // prints 1, 3, 4, 5, 1000
    i := rb3.Iterator()
    for i.HasNext() {
        fmt.Println(i.Next())
    }
    fmt.Println()

    // next we include an example of serialization
    buf := new(bytes.Buffer)
    rb1.WriteTo(buf) // we omit error handling
    newrb:= roaring64.New()
    newrb.ReadFrom(buf)
    if rb1.Equals(newrb) {
    	fmt.Println("I wrote the content to a byte stream and read it back.")
    }
    // you can iterate over bitmaps using ReverseIterator(), Iterator, ManyIterator()
}
```

Only the 32-bit roaring format is standard and cross-operable between Java, C++, C and Go. There is no guarantee that the 64-bit versions are compatible.

### Documentation

Current documentation is available at https://pkg.go.dev/github.com/RoaringBitmap/roaring and https://pkg.go.dev/github.com/RoaringBitmap/roaring/roaring64

### Goroutine safety

In general, it should not generally be considered safe to access
the same bitmaps using different goroutines--they are left
unsynchronized for performance. Should you want to access
a Bitmap from more than one goroutine, you should
provide synchronization. Typically this is done by using channels to pass
the *Bitmap around (in Go style; so there is only ever one owner),
or by using `sync.Mutex` to serialize operations on Bitmaps.

### Coverage

We test our software. For a report on our test coverage, see

https://coveralls.io/github/RoaringBitmap/roaring?branch=master

### Benchmark

Type

         go test -bench Benchmark -run -

To run benchmarks on [Real Roaring Datasets](https://github.com/RoaringBitmap/real-roaring-datasets)
run the following:

```sh
go get github.com/RoaringBitmap/real-roaring-datasets
BENCH_REAL_DATA=1 go test -bench BenchmarkRealData -run -
```

### Iterative use

You can use roaring with gore:

- go install github.com/x-motemen/gore/cmd/gore@latest
- Make sure that ``$GOPATH/bin`` is in your ``$PATH``.

```go
$ gore
gore version 0.2.6  :help for help
gore> :import github.com/RoaringBitmap/roaring
gore> x:=roaring.New()
gore> x.Add(1)
gore> x.String()
"{1}"
```


### Fuzzy testing

You can help us test further the library with fuzzy testing:

         go get github.com/dvyukov/go-fuzz/go-fuzz
         go get github.com/dvyukov/go-fuzz/go-fuzz-build
         go test -tags=gofuzz -run=TestGenerateSmatCorpus
         go-fuzz-build github.com/RoaringBitmap/roaring
         go-fuzz -bin=./roaring-fuzz.zip -workdir=workdir/ -timeout=200 -func FuzzSmat

Let it run, and if the # of crashers is > 0, check out the reports in
the workdir where you should be able to find the panic goroutine stack
traces.

You may also replace `-func FuzzSmat`  by `-func FuzzSerializationBuffer` or `-func FuzzSerializationStream`.

### Alternative in Go

There is a Go version wrapping the C/C++ implementation https://github.com/RoaringBitmap/gocroaring

For an alternative implementation in Go, see https://github.com/fzandona/goroar
The two versions were written independently.


### Mailing list/discussion group

https://groups.google.com/forum/#!forum/roaring-bitmaps
