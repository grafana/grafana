## bbloom: a bitset Bloom filter for go/golang

===

package implements a fast bloom filter with real 'bitset' and JSONMarshal/JSONUnmarshal to
store/reload the Bloom filter.

NOTE: the package uses unsafe.Pointer to set and read the bits from the bitset. If you're
uncomfortable with using the unsafe package, please consider using my bloom filter package at
github.com/AndreasBriese/bloom

===

changelog 11/2015: new thread safe methods AddTS(), HasTS(), AddIfNotHasTS() following a suggestion
from Srdjan Marinovic (github @a-little-srdjan), who used this to code a bloomfilter cache.

This bloom filter was developed to strengthen a website-log database and was tested and optimized
for this log-entry mask: "2014/%02i/%02i %02i:%02i:%02i /info.html". Nonetheless bbloom should work
with any other form of entries.

~~Hash function is a modified Berkeley DB sdbm hash (to optimize for smaller strings). sdbm
http://www.cse.yorku.ca/~oz/hash.html~~

Found sipHash (SipHash-2-4, a fast short-input PRF created by Jean-Philippe Aumasson and Daniel J.
Bernstein.) to be about as fast. sipHash had been ported by Dimtry Chestnyk to Go
(github.com/dchest/siphash )

Minimum hashset size is: 512 ([4]uint64; will be set automatically).

### install

```sh
go get github.com/AndreasBriese/bbloom
```

### test

- change to folder ../bbloom
- create wordlist in file "words.txt" (you might use `python permut.py`)
- run 'go test -bench=.' within the folder

```go
go test -bench=.
```

~~If you've installed the GOCONVEY TDD-framework http://goconvey.co/ you can run the tests
automatically.~~

using go's testing framework now (have in mind that the op timing is related to 65536 operations of
Add, Has, AddIfNotHas respectively)

### usage

after installation add

```go
import (
  ...
  "github.com/AndreasBriese/bbloom"
  ...
  )
```

at your header. In the program use

```go
// create a bloom filter for 65536 items and 1 % wrong-positive ratio
bf := bbloom.New(float64(1<<16), float64(0.01))

// or
// create a bloom filter with 650000 for 65536 items and 7 locs per hash explicitly
// bf = bbloom.New(float64(650000), float64(7))
// or
bf = bbloom.New(650000.0, 7.0)

// add one item
bf.Add([]byte("butter"))

// Number of elements added is exposed now
// Note: ElemNum will not be included in JSON export (for compatability to older version)
nOfElementsInFilter := bf.ElemNum

// check if item is in the filter
isIn := bf.Has([]byte("butter"))    // should be true
isNotIn := bf.Has([]byte("Butter")) // should be false

// 'add only if item is new' to the bloomfilter
added := bf.AddIfNotHas([]byte("butter"))    // should be false because 'butter' is already in the set
added = bf.AddIfNotHas([]byte("buTTer"))    // should be true because 'buTTer' is new

// thread safe versions for concurrent use: AddTS, HasTS, AddIfNotHasTS
// add one item
bf.AddTS([]byte("peanutbutter"))
// check if item is in the filter
isIn = bf.HasTS([]byte("peanutbutter"))    // should be true
isNotIn = bf.HasTS([]byte("peanutButter")) // should be false
// 'add only if item is new' to the bloomfilter
added = bf.AddIfNotHasTS([]byte("butter"))    // should be false because 'peanutbutter' is already in the set
added = bf.AddIfNotHasTS([]byte("peanutbuTTer"))    // should be true because 'penutbuTTer' is new

// convert to JSON ([]byte)
Json := bf.JSONMarshal()

// bloomfilters Mutex is exposed for external un-/locking
// i.e. mutex lock while doing JSON conversion
bf.Mtx.Lock()
Json = bf.JSONMarshal()
bf.Mtx.Unlock()

// restore a bloom filter from storage
bfNew := bbloom.JSONUnmarshal(Json)

isInNew := bfNew.Has([]byte("butter"))    // should be true
isNotInNew := bfNew.Has([]byte("Butter")) // should be false

```

to work with the bloom filter.

### why 'fast'?

It's about 3 times faster than William Fitzgeralds bitset bloom filter
https://github.com/willf/bloom . And it is about so fast as my []bool set variant for Boom filters
(see https://github.com/AndreasBriese/bloom ) but having a 8times smaller memory footprint:

```sh
Bloom filter (filter size 524288, 7 hashlocs)
github.com/AndreasBriese/bbloom 'Add' 65536 items (10 repetitions): 6595800 ns (100 ns/op)
github.com/AndreasBriese/bbloom 'Has' 65536 items (10 repetitions): 5986600 ns (91 ns/op)
github.com/AndreasBriese/bloom 'Add' 65536 items (10 repetitions): 6304684 ns (96 ns/op)
github.com/AndreasBriese/bloom 'Has' 65536 items (10 repetitions): 6568663 ns (100 ns/op)

github.com/willf/bloom 'Add' 65536 items (10 repetitions): 24367224 ns (371 ns/op)
github.com/willf/bloom 'Test' 65536 items (10 repetitions): 21881142 ns (333 ns/op)
github.com/dataence/bloom/standard 'Add' 65536 items (10 repetitions): 23041644 ns (351 ns/op)
github.com/dataence/bloom/standard 'Check' 65536 items (10 repetitions): 19153133 ns (292 ns/op)
github.com/cabello/bloom 'Add' 65536 items (10 repetitions): 131921507 ns (2012 ns/op)
github.com/cabello/bloom 'Contains' 65536 items (10 repetitions): 131108962 ns (2000 ns/op)
```

(on MBPro15 OSX10.8.5 i7 4Core 2.4Ghz)

With 32bit bloom filters (bloom32) using modified sdbm, bloom32 does hashing with only 2 bit shifts,
one xor and one substraction per byte. smdb is about as fast as fnv64a but gives less collisions
with the dataset (see mask above). bloom.New(float64(10 \* 1<<16),float64(7)) populated with 1<<16
random items from the dataset (see above) and tested against the rest results in less than 0.05%
collisions.
