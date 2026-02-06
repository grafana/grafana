## Go Deep Copy

[![Build Status](https://travis-ci.org/barkimedes/go-deepcopy.svg?branch=master)](https://travis-ci.org/barkimedes/go-deepcopy) [![codecov](https://codecov.io/gh/barkimedes/go-deepcopy/branch/master/graph/badge.svg)](https://codecov.io/gh/barkimedes/go-deepcopy) [![](https://godoc.org/github.com/nathany/looper?status.svg)](https://godoc.org/github.com/barkimedes/go-deepcopy)

This package is a Golang implementation for creating deep copies of virtually any kind of Go type. 

This is a truly deep copy--every single value behind a pointer, every item in a slice or array, and every key and value in a map are all cloned so nothing is pointing to what it pointed to before.

To handle circular pointer references (e.g. a pointer to a struct with a pointer field that points back to the original struct), we keep track of a map of pointers that have already been visited. This serves two purposes. First, it keeps us from getting into any kind of infinite loop. Second, it ensures that the code will behave similarly to how it would have on the original struct -- if you expect two values to be pointing at the same value within the copied tree, then they'll both still point to the same thing.

### Sample Program

```go
package main

import (
	"fmt"

	"github.com/barkimedes/go-deepcopy"
)

type Foo struct {
	Bar []string
	Baz *Baz
}

type Baz struct {
	Qux   int
	Corgi map[bool]string
	Foo   *Foo
}

func main() {
	x := &Foo{
		Bar: []string{"a", "b", "c", "d"},
		Baz: &Baz{
			Qux: 4,
			Corgi: map[bool]string{
				false: "nope",
				true:  "yup",
			},
		},
	}

	x.Baz.Foo = x // just for funsies

	y, err := deepcopy.Anything(x)
	if err != nil {
		panic(err)
	}
	print(x)
	fmt.Println()
	print(y.(*Foo))
}

func print(x *Foo) {
	fmt.Printf("Foo: %p %v\n", x, x)
	fmt.Printf("\tFoo.Bar: %p %v\n", x.Bar, x.Bar)
	fmt.Printf("\tFoo.Baz: %p %v\n", x.Baz, x.Baz)
	fmt.Printf("\t\tFoo.Baz.Qux: %v\n", x.Baz.Qux)
	fmt.Printf("\t\tFoo.Baz.Corgi: %p %v\n", x.Baz.Corgi, x.Baz.Corgi)
	fmt.Printf("\t\tFoo.Baz.Foo: %p %v\n", x.Baz.Foo, x.Baz.Foo)
}
```

### Sample Output

_Note that the values are all the same, but the addresses are all different.
Note also that circular dependencies are handled--the self-referential Foo remains self-referential within each instance, but different across copies._

```go
Foo: 0xc00000c0a0 &{[a b c d] 0xc00000c0c0}
	Foo.Bar: 0xc000016080 [a b c d]
	Foo.Baz: 0xc00000c0c0 &{4 map[false:nope true:yup] 0xc00000c0a0}
		Foo.Baz.Qux: 4
		Foo.Baz.Corgi: 0xc000060180 map[false:nope true:yup]
		Foo.Baz.Foo: 0xc00000c0a0 &{[a b c d] 0xc00000c0c0}

Foo: 0xc00000c0e0 &{[a b c d] 0xc00000c160}
	Foo.Bar: 0xc0000160c0 [a b c d]
	Foo.Baz: 0xc00000c160 &{4 map[false:nope true:yup] 0xc00000c0e0}
		Foo.Baz.Qux: 4
		Foo.Baz.Corgi: 0xc0000601e0 map[false:nope true:yup]
		Foo.Baz.Foo: 0xc00000c0e0 &{[a b c d] 0xc00000c160}
```
