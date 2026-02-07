# logfmt

[![Go Reference](https://pkg.go.dev/badge/github.com/go-logfmt/logfmt.svg)](https://pkg.go.dev/github.com/go-logfmt/logfmt)
[![Go Report Card](https://goreportcard.com/badge/go-logfmt/logfmt)](https://goreportcard.com/report/go-logfmt/logfmt)
[![Github Actions](https://github.com/go-logfmt/logfmt/actions/workflows/test.yml/badge.svg)](https://github.com/go-logfmt/logfmt/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/go-logfmt/logfmt/badge.svg?branch=master)](https://coveralls.io/github/go-logfmt/logfmt?branch=main)

Package logfmt implements utilities to marshal and unmarshal data in the [logfmt
format][fmt]. It provides an API similar to [encoding/json][json] and
[encoding/xml][xml].

[fmt]: https://brandur.org/logfmt
[json]: https://pkg.go.dev/encoding/json
[xml]: https://pkg.go.dev/encoding/xml

The logfmt format was first documented by Brandur Leach in [this
article][origin]. The format has not been formally standardized. The most
authoritative public specification to date has been the documentation of a Go
Language [package][parser] written by Blake Mizerany and Keith Rarick.

[origin]: https://brandur.org/logfmt
[parser]: https://pkg.go.dev/github.com/kr/logfmt

## Goals

This project attempts to conform as closely as possible to the prior art, while
also removing ambiguity where necessary to provide well behaved encoder and
decoder implementations.

## Non-goals

This project does not attempt to formally standardize the logfmt format. In the
event that logfmt is standardized this project would take conforming to the
standard as a goal.

## Versioning

This project publishes releases according to the Go language guidelines for
[developing and publishing modules][pub].

[pub]: https://go.dev/doc/modules/developing
