# Interpolate

[![Build Status](https://github.com/mfridman/interpolate/actions/workflows/ci.yaml/badge.svg)](https://github.com/mfridman/interpolate/actions/workflows/ci.yaml)
[![Go Reference](https://pkg.go.dev/badge/github.com/mfridman/interpolate.svg)](https://pkg.go.dev/github.com/mfridman/interpolate)
[![Go Report Card](https://goreportcard.com/badge/github.com/mfridman/interpolate)](https://goreportcard.com/report/github.com/mfridman/interpolate)

A Go library for parameter expansion (like `${NAME}` or `$NAME`) in strings from environment
variables. An implementation of [POSIX Parameter
Expansion](http://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_06_02),
plus some other basic operations that you'd expect in a shell scripting environment [like
bash](https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html).

## Installation

```
go get github.com/mfridman/interpolate@latest
```

## Usage

```go
package main

import (
  "github.com/mfridman/interpolate"
  "fmt"
)

func main() {
  env := interpolate.NewSliceEnv([]string{
    "NAME=James",
  })

  output, _ := interpolate.Interpolate(env, "Hello... ${NAME} welcome to the ${ANOTHER_VAR:-🏖}")

  fmt.Println(output)
  // Output: Hello... James welcome to the 🏖
}
```

## Supported Expansions

- `${parameter}` or `$parameter`

  - **Use value.** If parameter is set, then it shall be substituted; otherwise, it will be blank

- `${parameter:-[word]}`

  - **Use default values.** If parameter is unset or null, the expansion of word (or an empty string
    if word is omitted) shall be substituted; otherwise, the value of parameter shall be
    substituted.

- `${parameter-[word]}`

  - **Use default values when not set.** If parameter is unset, the expansion of word (or an empty
    string if word is omitted) shall be substituted; otherwise, the value of parameter shall be
    substituted.

- `${parameter:[offset]}`

  - **Use the substring of parameter after offset.** A negative offset must be separated from the
    colon with a space, and will select from the end of the string. If the value is out of bounds,
    an empty string will be substituted.

- `${parameter:[offset]:[length]}`

  - **Use the substring of parameter after offset of given length.** A negative offset must be
    separated from the colon with a space, and will select from the end of the string. If the offset
    is out of bounds, an empty string will be substituted. If the length is greater than the length
    then the entire string will be returned.

- `${parameter:?[word]}`
  - **Indicate Error if Null or Unset.** If parameter is unset or null, the expansion of word (or a
    message indicating it is unset if word is omitted) shall be returned as an error.

## Prior work

This repository is a fork of [buildkite/interpolate](https://github.com/buildkite/interpolate). I'd
like to thank the authors of that library for their work. I've forked it to make some changes that I
needed for my own use cases, and to make it easier to maintain. I've also added some tests and
documentation.

## License

Licensed under MIT license, in `LICENSE`.
