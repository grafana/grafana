# OpenAPI v2 object model [![Build Status](https://github.com/go-openapi/spec/actions/workflows/go-test.yml/badge.svg)](https://github.com/go-openapi/spec/actions?query=workflow%3A"go+test") [![codecov](https://codecov.io/gh/go-openapi/spec/branch/master/graph/badge.svg)](https://codecov.io/gh/go-openapi/spec)

[![Slack Status](https://slackin.goswagger.io/badge.svg)](https://slackin.goswagger.io)
[![license](http://img.shields.io/badge/license-Apache%20v2-orange.svg)](https://raw.githubusercontent.com/go-openapi/spec/master/LICENSE)
[![Go Reference](https://pkg.go.dev/badge/github.com/go-openapi/spec.svg)](https://pkg.go.dev/github.com/go-openapi/spec)
[![Go Report Card](https://goreportcard.com/badge/github.com/go-openapi/spec)](https://goreportcard.com/report/github.com/go-openapi/spec)

The object model for OpenAPI specification documents.

### FAQ

* What does this do?

> 1. This package knows how to marshal and unmarshal Swagger API specifications into a golang object model
> 2. It knows how to resolve $ref and expand them to make a single root document

* How does it play with the rest of the go-openapi packages ?

> 1. This package is at the core of the go-openapi suite of packages and [code generator](https://github.com/go-swagger/go-swagger)
> 2. There is a [spec loading package](https://github.com/go-openapi/loads) to fetch specs as JSON or YAML from local or remote locations
> 3. There is a [spec validation package](https://github.com/go-openapi/validate) built on top of it
> 4. There is a [spec analysis package](https://github.com/go-openapi/analysis) built on top of it, to analyze, flatten, fix and merge spec documents

* Does this library support OpenAPI 3?

> No.
> This package currently only supports OpenAPI 2.0 (aka Swagger 2.0).
> There is no plan to make it evolve toward supporting OpenAPI 3.x.
> This [discussion thread](https://github.com/go-openapi/spec/issues/21) relates the full story.
>
> An early attempt to support Swagger 3 may be found at: https://github.com/go-openapi/spec3

* Does the unmarshaling support YAML?

> Not directly. The exposed types know only how to unmarshal from JSON.
>
> In order to load a YAML document as a Swagger spec, you need to use the loaders provided by
> github.com/go-openapi/loads
>
> Take a look at the example there: https://pkg.go.dev/github.com/go-openapi/loads#example-Spec
>
> See also https://github.com/go-openapi/spec/issues/164

* How can I validate a spec?

> Validation is provided by [the validate package](http://github.com/go-openapi/validate)

* Why do we have an `ID` field for `Schema` which is not part of the swagger spec?

> We found jsonschema compatibility more important: since `id` in jsonschema influences
> how `$ref` are resolved.
> This `id` does not conflict with any property named `id`.
>
> See also https://github.com/go-openapi/spec/issues/23
