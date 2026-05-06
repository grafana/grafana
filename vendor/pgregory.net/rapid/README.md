# rapid [![PkgGoDev][godev-img]][godev] [![CI][ci-img]][ci]

Rapid is a Go library for property-based testing.

Rapid checks that properties you define hold for a large number
of automatically generated test cases. If a failure is found, rapid
automatically minimizes the failing test case before presenting it.

## Features

- Imperative Go API with type-safe data generation using generics
- Data generation biased to explore "small" values and edge cases more thoroughly
- Fully automatic minimization of failing test cases
- Persistence and automatic re-running of minimized failing test cases
- Support for state machine ("stateful" or "model-based") testing
- No dependencies outside the Go standard library

## Examples

Here is what a trivial test using rapid looks like ([playground](https://go.dev/play/p/QJhOzo_BByz)):

```go
package rapid_test

import (
	"sort"
	"testing"

	"pgregory.net/rapid"
)

func TestSortStrings(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.SliceOf(rapid.String()).Draw(t, "s")
		sort.Strings(s)
		if !sort.StringsAreSorted(s) {
			t.Fatalf("unsorted after sort: %v", s)
		}
	})
}
```

More complete examples:

- `ParseDate` function test:
  [source code](./example_function_test.go), [playground](https://go.dev/play/p/tZFU8zv8AUl)
- `Queue` state machine test:
  [source code](./example_statemachine_test.go), [playground](https://go.dev/play/p/cxEh4deG-4n)

## Comparison

Rapid aims to bring to Go the power and convenience
[Hypothesis](https://github.com/HypothesisWorks/hypothesis) brings to Python.

Compared to [testing.F.Fuzz](https://pkg.go.dev/testing#F.Fuzz), rapid shines
in generating complex structured data, including state machine tests, but lacks
coverage-guided feedback and mutations. Note that with
[`MakeFuzz`](https://pkg.go.dev/pgregory.net/rapid#MakeFuzz), any rapid test
can be used as a fuzz target for the standard fuzzer.

Compared to [gopter](https://pkg.go.dev/github.com/leanovate/gopter), rapid
provides a much simpler API (queue test in [rapid](./example_statemachine_test.go) vs
[gopter](https://github.com/leanovate/gopter/blob/90cc76d7f1b21637b4b912a7c19dea3efe145bb2/commands/example_circularqueue_test.go)),
is much smarter about data generation and is able to minimize failing test cases
fully automatically, without any user code.

As for [testing/quick](https://pkg.go.dev/testing/quick), it lacks both
convenient data generation facilities and any form of test case minimization, which
are two main things to look for in a property-based testing library.

## FAQ

### What is property-based testing?

Suppose we've written arithmetic functions `add`, `subtract` and `multiply`
and want to test them. Traditional testing approach is example-based —
we come up with example inputs and outputs, and verify that the system behavior
matches the examples:

```go
func TestArithmetic_Example(t *testing.T) {
	t.Run("add", func(t *testing.T) {
		examples := [][3]int{
			{0, 0, 0},
			{0, 1, 1},
			{2, 2, 4},
			// ...
		}
		for _, e := range examples {
			if add(e[0], e[1]) != e[2] {
				t.Fatalf("add(%v, %v) != %v", e[0], e[1], e[2])
			}
		}
	})
	t.Run("subtract", func(t *testing.T) { /* ... */ })
	t.Run("multiply", func(t *testing.T) { /* ... */ })
}
```

In comparison, with property-based testing we define higher-level properties
that should hold for arbitrary input. Each time we run a property-based test,
properties are checked on a new set of pseudo-random data:

```go
func TestArithmetic_Property(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		var (
			a = rapid.Int().Draw(t, "a")
			b = rapid.Int().Draw(t, "b")
			c = rapid.Int().Draw(t, "c")
		)
		if add(a, 0) != a {
			t.Fatalf("add() does not have 0 as identity")
		}
		if add(a, b) != add(b, a) {
			t.Fatalf("add() is not commutative")
		}
		if add(a, add(b, c)) != add(add(a, b), c) {
			t.Fatalf("add() is not associative")
		}
		if multiply(a, add(b, c)) != add(multiply(a, b), multiply(a, c)) {
			t.Fatalf("multiply() is not distributive over add()")
		}
		// ...
	})
}
```

Property-based tests are more powerful and concise than example-based ones —
and are also much more fun to write. As an additional benefit, coming up with
general properties of the system often improves the design of the system itself.

### What properties should I test?

As you've seen from the examples above, it depends on the system you are testing.
Usually a good place to start is to put yourself in the shoes of your user
and ask what are the properties the user will rely on (often unknowingly or
implicitly) when building on top of your system. That said, here are some
broadly applicable and often encountered properties to keep in mind:

- function does not panic on valid input data
- behavior of two algorithms or data structures is identical
- all variants of the  `decode(encode(x)) == x` roundtrip

### How does rapid work?

At its core, rapid does a fairly simple thing: generates pseudo-random data
based on the specification you provide, and check properties that you define
on the generated data.

Checking is easy: you simply write `if` statements and call something like
`t.Fatalf` when things look wrong.

Generating is a bit more involved. When you construct a `Generator`, nothing
happens: `Generator` is just a specification of how to `Draw` the data you
want. When you call `Draw`, rapid will take some bytes from its internal
random bitstream, use them to construct the value based on the `Generator`
specification, and track how the random bytes used correspond to the value
(and its subparts). This knowledge about the structure of the values being
generated, as well as their relationship with the parts of the bitstream
allows rapid to intelligently and automatically minify any failure found.

### What about fuzzing?

Property-based testing focuses on quick feedback loop: checking the properties
on a small but diverse set of pseudo-random inputs in a fractions of a second.

In comparison, fuzzing focuses on slow, often multi-day, brute force input
generation that maximizes the coverage.

Both approaches are useful. Property-based tests are used alongside regular
example-based tests during development, and fuzzing is used to search for edge
cases and security vulnerabilities. With
[`MakeFuzz`](https://pkg.go.dev/pgregory.net/rapid#MakeFuzz), any rapid test
can be used as a fuzz target.

## Usage

Just run `go test` as usual, it will pick up also all `rapid` tests.

There are a number of optional flags to influence rapid behavior, run
`go test -args -h` and look at the flags with the `-rapid.` prefix. You can
then pass such flags as usual. For example:

```sh
go test -rapid.checks=10_000
```

## Status

Rapid is stable: tests using rapid should continue to work with all future
rapid releases with the same major version. Possible exceptions to this rule
are API changes that replace the concrete type of parameter with an interface
type, or other similar mostly non-breaking changes.

## License

Rapid is licensed under the [Mozilla Public License Version 2.0](./LICENSE).

[godev-img]: https://pkg.go.dev/badge/pgregory.net/rapid
[godev]: https://pkg.go.dev/pgregory.net/rapid
[ci-img]: https://github.com/flyingmutant/rapid/workflows/CI/badge.svg
[ci]: https://github.com/flyingmutant/rapid/actions
