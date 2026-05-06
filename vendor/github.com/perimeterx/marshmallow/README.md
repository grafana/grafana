# Marshmallow

![Marshmallow Campfire](https://raw.githubusercontent.com/PerimeterX/marshmallow/assets/campfire.png)

[![CodeQL Status](https://img.shields.io/github/actions/workflow/status/perimeterx/marshmallow/codeql.yml?branch=main&logo=github&label=CodeQL)](https://github.com/PerimeterX/marshmallow/actions/workflows/codeql.yml?query=branch%3Amain++)
[![Run Tests](https://img.shields.io/github/actions/workflow/status/perimeterx/marshmallow/go.yml?branch=main&logo=github&label=Run%20Tests)](https://github.com/PerimeterX/marshmallow/actions/workflows/go.yml?query=branch%3Amain)
[![Dependency Review](https://img.shields.io/github/actions/workflow/status/perimeterx/marshmallow/dependency-review.yml?logo=github&label=Dependency%20Review)](https://github.com/PerimeterX/marshmallow/actions/workflows/dependency-review.yml?query=branch%3Amain)
[![Go Report Card](https://goreportcard.com/badge/github.com/perimeterx/marshmallow)](https://goreportcard.com/report/github.com/perimeterx/marshmallow)
![Manual Code Coverage](https://img.shields.io/badge/coverage-92.6%25-green)
[![Go Reference](https://pkg.go.dev/badge/github.com/perimeterx/marshmallow.svg)](https://pkg.go.dev/github.com/perimeterx/marshmallow)
[![Licence](https://img.shields.io/github/license/perimeterx/marshmallow)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/perimeterx/marshmallow)](https://github.com/PerimeterX/marshmallow/releases)
![Top Languages](https://img.shields.io/github/languages/top/perimeterx/marshmallow)
[![Issues](https://img.shields.io/github/issues-closed/perimeterx/marshmallow?color=%238250df&logo=github)](https://github.com/PerimeterX/marshmallow/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr-closed-raw/perimeterx/marshmallow?color=%238250df&label=merged%20pull%20requests&logo=github)](https://github.com/PerimeterX/marshmallow/pulls)
[![Commits](https://img.shields.io/github/last-commit/perimeterx/marshmallow)](https://github.com/PerimeterX/marshmallow/commits/main)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

<img align="right" width="200" alt="marshmallow-gopher" src="https://raw.githubusercontent.com/PerimeterX/marshmallow/assets/sticker7.png">

Marshmallow package provides a simple API to perform flexible and performant JSON unmarshalling in Go.

Marshmallow specializes in dealing with **unstructured struct** - when some fields are known and some aren't,
with zero performance overhead nor extra coding needed.
While unmarshalling, marshmallow allows fully retaining the original data and access
it via a typed struct and a dynamic map.

## Contents

- [Install](#install)
- [Usage](#usage)
- [Performance Benchmark And Alternatives](#performance-benchmark-and-alternatives)
- [When Should I Use Marshmallow](#when-should-i-use-marshmallow)
- [API](#api)

## Install

```sh
go get -u github.com/perimeterx/marshmallow
```

## Usage

```go
package main

import (
	"fmt"
	"github.com/perimeterx/marshmallow"
)

func main() {
	v := struct {
		Foo string `json:"foo"`
		Boo []int  `json:"boo"`
	}{}
	result, err := marshmallow.Unmarshal([]byte(`{"foo":"bar","boo":[1,2,3],"goo":12.6}`), &v)
	fmt.Printf("v=%+v, result=%+v, err=%v", v, result, err)
	// Output: v={Foo:bar Boo:[1 2 3]}, result=map[boo:[1 2 3] foo:bar goo:12.6], err=<nil>
}
```

**Examples can be found [here](example_test.go)**

## Performance Benchmark And Alternatives

Marshmallow performs best when dealing with mixed data - when some fields are known and some are unknown.
More info [below](#when-should-i-use-marshmallow).
Other solutions are available for this kind of use case, each solution is explained and documented in the link below.
The full benchmark test can be found
[here](https://github.com/PerimeterX/marshmallow/blob/8c5bba9e6dc0033f4324eca554737089a99f6e5e/benchmark_test.go).

|Benchmark|Iterations|Time/Iteration|Bytes Allocated|Allocations|
|--|--|--|--|--|
|[unmarshall twice](https://github.com/PerimeterX/marshmallow/blob/8c5bba9e6dc0033f4324eca554737089a99f6e5e/benchmark_test.go#L40)|228693|5164 ns/op|1640 B/op|51 allocs/op|
|[raw map](https://github.com/PerimeterX/marshmallow/blob/8c5bba9e6dc0033f4324eca554737089a99f6e5e/benchmark_test.go#L66)|232236|5116 ns/op|2296 B/op|53 allocs/op|
|[go codec](https://github.com/PerimeterX/marshmallow/blob/8c5bba9e6dc0033f4324eca554737089a99f6e5e/benchmark_test.go#L121)|388442|3077 ns/op|2512 B/op|37 allocs/op|
|[marshmallow](https://github.com/PerimeterX/marshmallow/blob/8c5bba9e6dc0033f4324eca554737089a99f6e5e/benchmark_test.go#L16)|626168|1853 ns/op|608 B/op|18 allocs/op|
|[marshmallow without populating struct](https://github.com/PerimeterX/marshmallow/blob/8c5bba9e6dc0033f4324eca554737089a99f6e5e/benchmark_test.go#L162)|678616|1751 ns/op|608 B/op|18 allocs/op|

![marshmallow performance comparison](https://raw.githubusercontent.com/PerimeterX/marshmallow/e45088ca20d4ea5be4143d418d12da63a68d6dfd/performance-chart.svg)

**Marshmallow provides the best performance (up to X3 faster) while not requiring any extra coding.**
In fact, marshmallow performs as fast as normal `json.Unmarshal` call, however, such a call causes loss of data for all
the fields that did not match the given struct. With marshmallow you never lose any data.

|Benchmark|Iterations|Time/Iteration|Bytes Allocated|Allocations|
|--|--|--|--|--|
|[marshmallow](https://github.com/PerimeterX/marshmallow/blob/8c5bba9e6dc0033f4324eca554737089a99f6e5e/benchmark_test.go#L16)|626168|1853 ns/op|608 B/op|18 allocs/op|
|[native library](https://github.com/PerimeterX/marshmallow/blob/8c5bba9e6dc0033f4324eca554737089a99f6e5e/benchmark_test.go#L143)|652106|1845 ns/op|304 B/op|11 allocs/op|
|[marshmallow without populating struct](https://github.com/PerimeterX/marshmallow/blob/8c5bba9e6dc0033f4324eca554737089a99f6e5e/benchmark_test.go#L162)|678616|1751 ns/op|608 B/op|18 allocs/op|

## When Should I Use Marshmallow

Marshmallow is best suited for use cases where you are interested in all the input data, but you have predetermined
information only about a subset of it. For instance, if you plan to reference two specific fields from the data, then
iterate all the data and apply some generic logic. How does it look with the native library:

```go
func isAllowedToDrive(data []byte) (bool, error) {
	result := make(map[string]interface{})
	err := json.Unmarshal(data, &result)
	if err != nil {
		return false, err
	}

	age, ok := result["age"]
	if !ok {
		return false, nil
	}
	a, ok := age.(float64)
	if !ok {
		return false, nil
	}
	if a < 17 {
		return false, nil
	}

	hasDriversLicense, ok := result["has_drivers_license"]
	if !ok {
		return false, nil
	}
	h, ok := hasDriversLicense.(bool)
	if !ok {
		return false, nil
	}
	if !h {
		return false, nil
	}

	for key := range result {
		if strings.Contains(key, "prior_conviction") {
			return false, nil
		}
	}

	return true, nil
}
```

And with marshmallow:

```go
func isAllowedToDrive(data []byte) (bool, error) {
	v := struct {
		Age               int  `json:"age"`
		HasDriversLicense bool `json:"has_drivers_license"`
	}{}
	result, err := marshmallow.Unmarshal(data, &v)
	if err != nil {
		return false, err
	}

	if v.Age < 17 || !v.HasDriversLicense {
		return false, nil
	}

	for key := range result {
		if strings.Contains(key, "prior_conviction") {
			return false, nil
		}
	}

	return true, nil
}
```

## API

Marshmallow exposes two main API functions -
[Unmarshal](https://github.com/PerimeterX/marshmallow/blob/0e0218ab860be8a4b5f57f5ff239f281c250c5da/unmarshal.go#L27)
and
[UnmarshalFromJSONMap](https://github.com/PerimeterX/marshmallow/blob/0e0218ab860be8a4b5f57f5ff239f281c250c5da/unmarshal_from_json_map.go#L37).
While unmarshalling, marshmallow supports the following optional options:

* Setting the mode for handling invalid data using the [WithMode](https://github.com/PerimeterX/marshmallow/blob/0e0218ab860be8a4b5f57f5ff239f281c250c5da/options.go#L30) function.
* Excluding known fields from the result map using the [WithExcludeKnownFieldsFromMap](https://github.com/PerimeterX/marshmallow/blob/457669ae9973895584f2636eabfc104140d3b700/options.go#L50) function. 
* Skipping struct population to boost performance using the [WithSkipPopulateStruct](https://github.com/PerimeterX/marshmallow/blob/0e0218ab860be8a4b5f57f5ff239f281c250c5da/options.go#L41) function.

In order to capture unknown nested fields, structs must implement [JSONDataErrorHandler](https://github.com/PerimeterX/marshmallow/blob/195c994aa6e3e0852601ad9cf65bcddef0dd7479/options.go#L76).
More info [here](https://github.com/PerimeterX/marshmallow/issues/15). 

Marshmallow also supports caching of refection information using 
[EnableCache](https://github.com/PerimeterX/marshmallow/blob/d3500aa5b0f330942b178b155da933c035dd3906/cache.go#L40)
and
[EnableCustomCache](https://github.com/PerimeterX/marshmallow/blob/d3500aa5b0f330942b178b155da933c035dd3906/cache.go#L35).

## Contact and Contribute

Reporting issues and requesting features may be done in our [GitHub issues page](https://github.com/PerimeterX/marshmallow/issues).
Discussions may be conducted in our [GitHub discussions page](https://github.com/PerimeterX/marshmallow/discussions).
For any further questions or comments you can reach us out at [open-source@humansecurity.com](mailto:open-source@humansecurity.com).

Any type of contribution is warmly welcome and appreciated ❤️
Please read our [contribution](CONTRIBUTING.md) guide for more info.

If you're looking for something to get started with, tou can always follow our [issues page](https://github.com/PerimeterX/marshmallow/issues) and look for
[good first issue](https://github.com/PerimeterX/marshmallow/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and
[help wanted](https://github.com/PerimeterX/marshmallow/issues?q=is%3Aissue+label%3A%22help+wanted%22+is%3Aopen) labels.

## Marshmallow Logo

Marshmallow logo and assets by [Adva Rom](https://www.linkedin.com/in/adva-rom-7a6738127/) are licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.<br />

![Marshmallow Logo](https://raw.githubusercontent.com/PerimeterX/marshmallow/assets/marshmallow.png)
