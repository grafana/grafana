# udecimal

[![build](https://github.com/quagmt/udecimal/actions/workflows/test.yaml/badge.svg)](https://github.com/quagmt/udecimal/actions/workflows/test.yaml)
[![Go Report Card](https://goreportcard.com/badge/github.com/quagmt/udecimal)](https://goreportcard.com/report/github.com/quagmt/udecimal)
[![codecov](https://codecov.io/gh/quagmt/udecimal/graph/badge.svg?token=662ET843EZ)](https://codecov.io/gh/quagmt/udecimal)
[![GoDoc](https://pkg.go.dev/badge/github.com/quagmt/udecimal)](https://pkg.go.dev/github.com/quagmt/udecimal)
[![Awesome Go](https://awesome.re/mentioned-badge.svg)](https://github.com/avelino/awesome-go#financial)

High performance, high precision, zero allocation fixed-point decimal number for financial applications.

## Installation

Supported version: Go >= 1.23

```sh
go get github.com/quagmt/udecimal
```

## Features

- **High Precision**: Supports up to 19 decimal places with no precision loss during arithmetic operations.
- **Zero Memory Allocation**: Designed for almost 99% zero memory allocation (see [How it works](#how-it-works)).
- **Optimized for Speed**: 5x~20x faster than [shopspring/decimal](https://github.com/shopspring/decimal) and [ericlagergren/decimal](https://github.com/ericlagergren/decimal) (see [Benchmark](benchmarks/README.md)).
- **Panic-Free**: All errors are returned as values, ensuring no unexpected panics.
- **Concurrent-Safe**: All arithmetic operations return a new `Decimal` value while keeping the original value unchanged, making it safe to be shared across goroutines.
- **Correctness**: All arithmetic operations are fuzz tested and cross-checked with `shopspring/decimal` library to ensure correctness.
- **Versatile Rounding Methods**: Includes HALF AWAY FROM ZERO, HALF TOWARD ZERO, AWAY FROM ZERO, and Banker's rounding.
  <br/>

**NOTE**: This library does not perform implicit rounding. If the result of an operation exceeds the maximum precision, extra digits are truncated. All rounding methods must be explicitly invoked. (see [Rounding Methods](#rounding-methods) for more details)

## Documentation

- Checkout [documentation](https://pkg.go.dev/github.com/quagmt/udecimal) for more information.

## Usage

```go
package main

import (
	"fmt"

	"github.com/quagmt/udecimal"
)

func main() {
	// Create a new decimal number
	a, _ := udecimal.NewFromInt64(123456, 3)              // a = 123.456
	b, _ := udecimal.NewFromInt64(-123456, 4)             // b = -12.3456
	c, _ := udecimal.NewFromFloat64(1.2345)               // c = 1.2345
	d, _ := udecimal.Parse("4123547.1234567890123456789") // d = 4123547.1234567890123456789

	// Basic arithmetic operations
	fmt.Println(a.Add(b)) // 123.456 - 12.3456 = 111.1104
	fmt.Println(a.Sub(b)) // 123.456 + 12.3456 = 135.8016
	fmt.Println(a.Mul(b)) // 123.456 * -12.3456 = -1524.1383936
	fmt.Println(a.Div(b)) // 123.456 / -12.3456 = -10
	fmt.Println(a.Div(d)) // 123.456 / 4123547.1234567890123456789 = 0.0000299392722585176

	// Rounding
	fmt.Println(c.RoundBank(3))         // banker's rounding: 1.2345 -> 1.234
	fmt.Println(c.RoundAwayFromZero(2)) // round away from zero: 1.2345 -> 1.24
	fmt.Println(c.RoundHAZ(3))          // half away from zero: 1.2345 -> 1.235
	fmt.Println(c.RoundHTZ(3))          // half towards zero: 1.2345 -> 1.234
	fmt.Println(c.Trunc(2))             // truncate: 1.2345 -> 1.23
	fmt.Println(c.Floor())              // floor: 1.2345 -> 1
	fmt.Println(c.Ceil())               // ceil: 1.2345 -> 2

	// Display
	fmt.Println(a.String())         // 123.456
	fmt.Println(a.StringFixed(10))  // 123.4560000000
	fmt.Println(a.InexactFloat64()) // 123.456
}
```

## Why another decimal library?

There are already a couple of decimal libraries available in Go, such as [shopspring/decimal](https://github.com/shopspring/decimal), [cockroachdb/apd](https://github.com/cockroachdb/apd), [govalues/decimal](https://github.com/govalues/decimal), etc. However, each of these libraries has its own limitations, for example:

- [shopspring/decimal](https://github.com/shopspring/decimal) is great for general-purpose decimal arithmetic because of arbitrary precision. However, it's slow and requires memory allocation for every arithmetic operation. Also in financial applications, arbitrary precision is not always necessary.
- [cockroachdb/apd](https://github.com/cockroachdb/apd) is faster but still requires memory allocation. Also the API is not very intuitive.
- [govalues/decimal](https://github.com/govalues/decimal) is fast, no memory allocation, easy to use but the data range is only limited to 19 digits (include both the integer and fractional parts). Some operations (especially Quo/QuoRem) usually overflow and fallback to use big.Int API, which hurts the performance. Another limitation is that it starts losing precision when the total number of digits exceeds 19.

This library is designed to address these limitations, providing both high performance and zero allocation while maintaining an acceptable range of precision, which is suitable for most financial applications.

## Rounding Methods

Rounding numbers can often be challenging and confusing due to the [variety of methods](https://www.mathsisfun.com/numbers/rounding-methods.html) available. Each method serves specific purposes, and it's common for developers to make mistakes or incorrect assumptions about how rounding should be performed. For example, the result of `round(1.45)` could be either 1.4 or 1.5, depending on the rounding method used.

This issue is particularly critical in financial applications, where even minor rounding errors can accumulate and lead to significant financial losses. To mitigate such errors, this library intentionally avoids implicit rounding. If the result of an operation exceeds the maximum precision specified by developers beforehand, **extra digits are truncated**. Developers need to explicitly choose the rounding method they want to use. The supported rounding methods are:

- [Banker's rounding](https://en.wikipedia.org/wiki/Rounding#Rounding_half_to_even) or round half to even
- [Round away from zero](https://en.wikipedia.org/wiki/Rounding#Rounding_away_from_zero)
- [Half away from zero](https://en.wikipedia.org/wiki/Rounding#Rounding_half_away_from_zero) (HAZ)
- [Half toward zero](https://en.wikipedia.org/wiki/Rounding#Rounding_half_toward_zero) (HTZ)

### Examples:

```go
package main

import (
	"fmt"

	"github.com/quagmt/udecimal"
)

func main() {
	// Create a new decimal number
	a, _ := udecimal.NewFromFloat64(1.345) // a = 1.345

	// Rounding
	fmt.Println(a.RoundBank(2))         // banker's rounding: 1.345 -> 1.34
	fmt.Println(a.RoundAwayFromZero(2)) // round away from zero: 1.345 -> 1.35
	fmt.Println(a.RoundHAZ(2))          // half away from zero: 1.345 -> 1.35
	fmt.Println(a.RoundHTZ(2))          // half towards zero: 1.345 -> 1.34
}
```

## How it works

As mentioned above, this library is not always memory allocation free. However, those cases where we need to allocate memory are incredibly rare. To understand why, let's take a look at how the `Decimal` type is implemented.

The `Decimal` type represents a fixed-point decimal number. It consists of three components: sign, coefficient, and prec. The number is represented as:

```go
// decimal value = (neg == true ? -1 : 1) * coef * 10^(-prec)
type Decimal struct {
	coef bint
	neg bool
	prec uint8 // 0 <= prec <= 19
}

// Example:
// 123.456 = 123456 * 10^-3
// -> neg = false, coef = 123456, prec = 3

// -123.456 = -123456 / 10^-3
// -> neg = true, coef = 123456, prec = 3
```

You can notice that `coef` data type is `bint`, which is a custom data type:

```go
type bint struct {
	// For coefficients exceeding u128
	bigInt *big.Int

	// For coefficients less than 2^128
	u128 u128
}
```

The `bint` type can store coefficients up to `2^128 - 1` using `u128`. Arithmetic operations with `u128` are fast and require no memory allocation. If result of an arithmetic operation exceeds u128 capacity, the whole operation will be performed using `big.Int` API. Such operations are slower and do involve memory allocation. However, those cases are rare in financial applications due to the extensive range provided by a 128-bit unsigned integer, for example:

- If precision is 0, the decimal range it can store is:
  `[-340282366920938463463374607431768211455, 340282366920938463463374607431768211455]`(approximately -340 to 340 undecillion)

- If precision is 19, the decimal range becomes:
  `[-34028236692093846346.3374607431768211455, 34028236692093846346.3374607431768211455]` (approximately -34 to 34 quintillion)

Therefore, in most cases you can expect high performance and no memory allocation when using this library.

## Credits

This library is inspired by these repositories:

- [govalues/decimal](https://github.com/govalues/decimal)
- [lukechampine/uint128](https://github.com/lukechampine/uint128)
- [ridiculousfish/libdivide](https://github.com/ridiculousfish/libdivide)
