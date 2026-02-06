# OpenAPI analysis [![Build Status](https://github.com/go-openapi/analysis/actions/workflows/go-test.yml/badge.svg)](https://github.com/go-openapi/analysis/actions?query=workflow%3A"go+test") [![codecov](https://codecov.io/gh/go-openapi/analysis/branch/master/graph/badge.svg)](https://codecov.io/gh/go-openapi/analysis)

[![Slack Status](https://slackin.goswagger.io/badge.svg)](https://slackin.goswagger.io)
[![license](http://img.shields.io/badge/license-Apache%20v2-orange.svg)](https://raw.githubusercontent.com/go-openapi/analysis/master/LICENSE)
[![Go Reference](https://pkg.go.dev/badge/github.com/go-openapi/analysis.svg)](https://pkg.go.dev/github.com/go-openapi/analysis)
[![Go Report Card](https://goreportcard.com/badge/github.com/go-openapi/analysis)](https://goreportcard.com/report/github.com/go-openapi/analysis)


A foundational library to analyze an OAI specification document for easier reasoning about the content.

## What's inside?

* An analyzer providing methods to walk the functional content of a specification
* A spec flattener producing a self-contained document bundle, while preserving `$ref`s
* A spec merger ("mixin") to merge several spec documents into a primary spec
* A spec "fixer" ensuring that response descriptions are non empty

[Documentation](https://pkg.go.dev/github.com/go-openapi/analysis)

## FAQ

* Does this library support OpenAPI 3?

> No.
> This package currently only supports OpenAPI 2.0 (aka Swagger 2.0).
> There is no plan to make it evolve toward supporting OpenAPI 3.x.
> This [discussion thread](https://github.com/go-openapi/spec/issues/21) relates the full story.
