# levenshtein
levenshtein automaton 

This package makes it fast and simple to build a finite determinic automaton that computes the levenshtein distance from a given string.

# Sample usage:

```
// build a re-usable builder
lb := NewLevenshteinAutomatonBuilder(2, false)

origTerm := "couchbasefts"
dfa := lb.BuildDfa("couchbases", 2)
ed := dfa.eval([]byte(origTerm))
if ed.distance() != 2 {
	log.Errorf("expected distance 2, actual: %d", ed.distance())
}

```

This implementation is inspired by [blog post](https://fulmicoton.com/posts/levenshtein/) and is intended to be
a port of original rust implementation: https://github.com/tantivy-search/levenshtein-automata


Micro Benchmark Results against the current vellum/levenshtein is as below.

```
BenchmarkNewEditDistance1-8       	   30000	     52684 ns/op	   89985 B/op	     295 allocs/op
BenchmarkOlderEditDistance1-8     	   10000	    132931 ns/op	  588892 B/op	     363 allocs/op

BenchmarkNewEditDistance2-8       	   10000	    199127 ns/op	  377532 B/op	    1019 allocs/op
BenchmarkOlderEditDistance2-8     	    2000	    988109 ns/op	 4236609 B/op	    1898 allocs/op
```
