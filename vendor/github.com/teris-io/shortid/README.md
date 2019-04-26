[![Build status][buildimage]][build] [![Coverage][codecovimage]][codecov] [![GoReportCard][cardimage]][card] [![API documentation][docsimage]][docs]

# Generator of unique non-sequential short Ids

The package `shortid`enables the generation of short, fully unique,
non-sequential and by default URL friendly Ids at a rate of hundreds of thousand per second. It
guarantees uniqueness during the time period until 2050!

The package is heavily inspired by the node.js [shortid][nodeshortid] library (see more detail below).

The easiest way to start generating Ids is:

	fmt.Printf(shortid.Generate())
	fmt.Printf(shortid.Generate())

The recommended one is to initialise and reuse a generator specific to a given worker:

	sid, err := shortid.New(1, shortid.DefaultABC, 2342)

	// then either:
	fmt.Printf(sid.Generate())
	fmt.Printf(sid.Generate())

	// or:
	shortid.SetDefault(sid)
	// followed by:
	fmt.Printf(shortid.Generate())
	fmt.Printf(shortid.Generate())


### Id Length

The standard Id length is 9 symbols when generated at a rate of 1 Id per millisecond,
occasionally it reaches 11 (at the rate of a few thousand Ids per millisecond) and very-very
rarely it can go beyond that during continuous generation at full throttle on high-performant
hardware. A test generating 500k Ids at full throttle on conventional hardware generated the
following Ids at the head and the tail (length > 9 is expected for this test):

	-NDveu-9Q
	iNove6iQ9J
	NVDve6-9Q
	VVDvc6i99J
	NVovc6-QQy
	VVoveui9QC
	...
	tFmGc6iQQs
	KpTvcui99k
	KFTGcuiQ9p
	KFmGeu-Q9O
	tFTvcu-QQt
	tpTveu-99u

### Life span

The package guarantees the generation of unique Ids with no collisions for 34 years
(1/1/2016-1/1/2050) using the same worker Id within a single (although can be concurrent)
application provided application restarts take longer than 1 millisecond. The package supports
up to 32 workers all providing unique sequences from each other.

### Implementation details

Although heavily inspired by the node.js [shortid][nodeshortid] library this is
not just a Go port. This implementation

* is safe to concurrency (test included);
* does not require any yearly version/epoch resets (test included);
* provides stable Id size over a the whole range of operation at the rate of 1ms (test included);
* guarantees no collisions: due to guaranteed fixed size of Ids between milliseconds and because
multiple requests within the same ms lead to longer Ids with the prefix unique to the ms (tests
included);
* supports 32 instead of 16 workers (test included)

The algorithm uses less randomness than the original node.js implementation, which permits to extend
the life span as well as reduce and guarantee the length. In general terms, each Id has the
following 3 pieces of information encoded: the millisecond since epoch (first 8 symbols, epoch:
1/1/2016), the worker Id (9th symbol), the running concurrent counter within the millisecond (only
if required, spanning over all remaining symbols).

The element of randomness per symbol is 1/2 for the worker and the millisecond data and 0 for the
counter. The original algorithm of the node.js library uses 1/4 throughout. Here 0 means no
randomness, i.e. every value is encoded using a 64-base alphabet directly; 1/2 means one of two
matching symbols of the supplied alphabet is used randomly, 1/4 one of four matching symbols. All
methods accepting the parameters that govern the randomness are exported and can be used to directly
implement an algorithm with e.g. more randomness, but with longer Ids and shorter life spans.

### License and copyright

	Copyright (c) 2016. Oleg Sklyar and teris.io. MIT license applies. All rights reserved.

**[Original algorithm][nodeshortid]:** Copyright (c) 2015 Dylan Greene, contributors. The same MIT
license applies. Many thanks to Dylan for putting together the original node.js library, which
inspired this "port":

**Seed computation:** based on The Central Randomizer 1.3. Copyright (c) 1997 Paul Houle (houle@msc.cornell.edu)

[go]: https://golang.org
[nodeshortid]: https://github.com/dylang/shortid

[build]: https://travis-ci.org/teris-io/shortid
[buildimage]: https://travis-ci.org/teris-io/shortid.svg?branch=master

[codecov]: https://codecov.io/github/teris-io/shortid?branch=master
[codecovimage]: https://codecov.io/github/teris-io/shortid/coverage.svg?branch=master

[card]: http://goreportcard.com/report/teris-io/shortid
[cardimage]: https://goreportcard.com/badge/github.com/teris-io/shortid

[docs]: https://godoc.org/github.com/teris-io/shortid
[docsimage]: http://img.shields.io/badge/godoc-reference-blue.svg?style=flat
