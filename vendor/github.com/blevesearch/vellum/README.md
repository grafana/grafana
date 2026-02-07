# ![vellum](docs/logo.png) vellum

[![Tests](https://github.com/couchbase/vellum/workflows/Tests/badge.svg?branch=master&event=push)](https://github.com/couchbase/vellum/actions?query=workflow%3ATests+event%3Apush+branch%3Amaster)
[![Coverage Status](https://coveralls.io/repos/github/couchbase/vellum/badge.svg?branch=master)](https://coveralls.io/github/couchbase/vellum?branch=master)
[![GoDoc](https://godoc.org/github.com/couchbase/vellum?status.svg)](https://godoc.org/github.com/couchbase/vellum)
[![Go Report Card](https://goreportcard.com/badge/github.com/couchbase/vellum)](https://goreportcard.com/report/github.com/couchbase/vellum)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A Go library implementing an FST (finite state transducer) capable of:
  - mapping between keys ([]byte) and a value (uint64)
  - enumerating keys in lexicographic order

Some additional goals of this implementation:
 - bounded memory use while building the FST
 - streaming out FST data while building
 - mmap FST runtime to support very large FTSs (optional)

## Usage

### Building an FST

To build an FST, create a new builder using the `New()` method.  This method takes an `io.Writer` as an argument.  As the FST is being built, data will be streamed to the writer as soon as possible.  With this builder you **MUST** insert keys in lexicographic order.  Inserting keys out of order will result in an error.  After inserting the last key into the builder, you **MUST** call `Close()` on the builder.  This will flush all remaining data to the underlying writer.

In memory:
```go
  var buf bytes.Buffer
  builder, err := vellum.New(&buf, nil)
  if err != nil {
    log.Fatal(err)
  }
```

To disk:
```go
  f, err := os.Create("/tmp/vellum.fst")
  if err != nil {
    log.Fatal(err)
  }
  builder, err := vellum.New(f, nil)
  if err != nil {
    log.Fatal(err)
  }
```

**MUST** insert keys in lexicographic order:
```go
err = builder.Insert([]byte("cat"), 1)
if err != nil {
  log.Fatal(err)
}

err = builder.Insert([]byte("dog"), 2)
if err != nil {
  log.Fatal(err)
}

err = builder.Insert([]byte("fish"), 3)
if err != nil {
  log.Fatal(err)
}

err = builder.Close()
if err != nil {
  log.Fatal(err)
}
```

### Using an FST

After closing the builder, the data can be used to instantiate an FST.  If the data was written to disk, you can use the `Open()` method to mmap the file.  If the data is already in memory, or you wish to load/mmap the data yourself, you can instantiate the FST with the `Load()` method.

Load in memory:
```go
  fst, err := vellum.Load(buf.Bytes())
  if err != nil {
    log.Fatal(err)
  }
```

Open from disk:
```go
  fst, err := vellum.Open("/tmp/vellum.fst")
  if err != nil {
    log.Fatal(err)
  }
```

Get key/value:
```go
  val, exists, err = fst.Get([]byte("dog"))
  if err != nil {
    log.Fatal(err)
  }
  if exists {
    fmt.Printf("contains dog with val: %d\n", val)
  } else {
    fmt.Printf("does not contain dog")
  }
```

Iterate key/values:
```go
  itr, err := fst.Iterator(startKeyInclusive, endKeyExclusive)
  for err == nil {
    key, val := itr.Current()
    fmt.Printf("contains key: %s val: %d", key, val)
    err = itr.Next()
  }
  if err != nil {
    log.Fatal(err)
  }
```

### How does the FST get built?

A full example of the implementation is beyond the scope of this README, but let's consider a small example where we want to insert 3 key/value pairs.

First we insert "are" with the value 4.

![step1](docs/demo1.png)

Next, we insert "ate" with the value 2.

![step2](docs/demo2.png)

Notice how the values associated with the transitions were adjusted so that by summing them while traversing we still get the expected value.

At this point, we see that state 5 looks like state 3, and state 4 looks like state 2.  But, we cannot yet combine them because future inserts could change this.

Now, we insert "see" with value 3.  Once it has been added, we now know that states 5 and 4 can longer change.  Since they are identical to 3 and 2, we replace them.

![step3](docs/demo3.png)

Again, we see that states 7 and 8 appear to be identical to 2 and 3.

Having inserted our last key, we call `Close()` on the builder.

![step4](docs/demo4.png)

Now, states 7 and 8 can safely be replaced with 2 and 3.

For additional information, see the references at the bottom of this document.

### What does the serialized format look like?

We've broken out a separate document on the [vellum disk format v1](docs/format.md).

### What if I want to use this on a system that doesn't have mmap?

The mmap library itself is guarded with system/architecture build tags, but we've also added an additional build tag in vellum.  If you'd like to Open() a file based representation of an FST, but not use mmap, you can build the library with the `nommap` build tag.  NOTE: if you do this, the entire FST will be read into memory.

### Can I use this with Unicode strings?

Yes, however this implementation is only aware of the byte representation you choose.  In order to find matches, you must work with some canonical byte representation of the string.  In the future, some encoding-aware traversals may be possible on top of the lower-level byte transitions.

### How did this library come to be?

In my work on the [Bleve](https://github.com/blevesearch/bleve) project I became aware of the power of the FST for many search-related tasks.  The obvious starting point for such a thing in Go was the [mafsa](https://github.com/smartystreets/mafsa) project.  While working with mafsa I encountered some issues.  First, it did not stream data to disk while building.  Second, it chose to use a rune as the fundamental unit of transition in the FST, but I felt using a byte would be more powerful in the end.  My hope is that higher-level encoding-aware traversals will be possible when necessary.  Finally, as I reported bugs and submitted PRs I learned that the mafsa project was mainly a research project and no longer being maintained.  I wanted to build something that could be used in production.  As the project advanced more and more techniques from the [BurntSushi/fst](https://github.com/BurntSushi/fst) were adapted to our implementation.

### Are there tools to work with vellum files?

Under the cmd/vellum subdirectory, there's a command-line tool which
features subcommands that can allow you to create, inspect and query
vellum files.

### How can I generate a state transition diagram from a vellum file?

The vellum command-line tool has a "dot" subcommand that can emit
graphviz dot output data from an input vellum file.  The dot file can
in turn be converted into an image using graphviz tools.  Example...

    $ vellum dot myFile.vellum > output.dot
    $ dot -Tpng output.dot -o output.png

## Related Work

Much credit goes to two existing projects:
 - [mafsa](https://github.com/smartystreets/mafsa)
 - [BurntSushi/fst](https://github.com/BurntSushi/fst)

Most of the original implementation here started with my digging into the internals of mafsa.  As the implementation progressed, I continued to borrow ideas/approaches from the BurntSushi/fst library as well.

For a great introduction to this topic, please read the blog post [Index 1,600,000,000 Keys with Automata and Rust](http://blog.burntsushi.net/transducers/)
