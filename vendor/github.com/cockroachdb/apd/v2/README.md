# apd

apd is an arbitrary-precision decimal package for Go.

`apd` implements much of the decimal specification from the [General Decimal Arithmetic](http://speleotrove.com/decimal/) description. This is the same specification implemented by [python’s decimal module](https://docs.python.org/2/library/decimal.html) and GCC’s decimal extension.

## Features

- **Panic-free operation**. The `math/big` types don’t return errors, and instead panic under some conditions that are documented. This requires users to validate the inputs before using them. Meanwhile, we’d like our decimal operations to have more failure modes and more input requirements than the `math/big` types, so using that API would be difficult. `apd` instead returns errors when needed.
- **Support for standard functions**. `sqrt`, `ln`, `pow`, etc.
- **Accurate and configurable precision**. Operations will use enough internal precision to produce a correct result at the requested precision. Precision is set by a "context" structure that accompanies the function arguments, as discussed in the next section.
- **Good performance**. Operations will either be fast enough or will produce an error if they will be slow. This prevents edge-case operations from consuming lots of CPU or memory.
- **Condition flags and traps**. All operations will report whether their result is exact, is rounded, is over- or under-flowed, is [subnormal](https://en.wikipedia.org/wiki/Denormal_number), or is some other condition. `apd` supports traps which will trigger an error on any of these conditions. This makes it possible to guarantee exactness in computations, if needed.

`apd` has two main types. The first is [`Decimal`](https://godoc.org/github.com/cockroachdb/apd#Decimal) which holds the values of decimals. It is simple and uses a `big.Int` with an exponent to describe values. Most operations on `Decimal`s can’t produce errors as they work directly on the underlying `big.Int`. Notably, however, there are no arithmetic operations on `Decimal`s.

The second main type is [`Context`](https://godoc.org/github.com/cockroachdb/apd#Context), which is where all arithmetic operations are defined. A `Context` describes the precision, range, and some other restrictions during operations. These operations can all produce failures, and so return errors.

`Context` operations, in addition to errors, return a [`Condition`](https://godoc.org/github.com/cockroachdb/apd#Condition), which is a bitfield of flags that occurred during an operation. These include overflow, underflow, inexact, rounded, and others. The `Traps` field of a `Context` can be set which will produce an error if the corresponding flag occurs. An example of this is given below.

See the [examples](https://godoc.org/github.com/cockroachdb/apd#pkg-examples) for some operations that were previously difficult to perform in Go.

## Documentation

https://godoc.org/github.com/cockroachdb/apd