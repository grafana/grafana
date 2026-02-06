# spec

<!-- Badges: status  -->
[![Tests][test-badge]][test-url] [![Coverage][cov-badge]][cov-url] [![CI vuln scan][vuln-scan-badge]][vuln-scan-url] [![CodeQL][codeql-badge]][codeql-url]
<!-- Badges: release & docker images  -->
<!-- Badges: code quality  -->
<!-- Badges: license & compliance -->
[![Release][release-badge]][release-url] [![Go Report Card][gocard-badge]][gocard-url] [![CodeFactor Grade][codefactor-badge]][codefactor-url] [![License][license-badge]][license-url]
<!-- Badges: documentation & support -->
<!-- Badges: others & stats -->
[![GoDoc][godoc-badge]][godoc-url] [![Discord Channel][discord-badge]][discord-url] [![go version][goversion-badge]][goversion-url] ![Top language][top-badge] ![Commits since latest release][commits-badge]

---

The object model for OpenAPI v2 specification documents.

## Announcements

* **2025-12-19** : new community chat on discord
  * a new discord community channel is available to be notified of changes and support users
  * our venerable Slack channel remains open, and will be eventually discontinued on **2026-03-31**

You may join the discord community by clicking the invite link on the discord badge (also above). [![Discord Channel][discord-badge]][discord-url]

Or join our Slack channel: [![Slack Channel][slack-logo]![slack-badge]][slack-url]

## Status

API is stable.

## Import this library in your project

```cmd
go get github.com/go-openapi/spec
```

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

## Change log

See <https://github.com/go-openapi/spec/releases>

## References

<https://github.com/OAI/OpenAPI-Specification/blob/main/versions/2.0.md>

## Licensing

This library ships under the [SPDX-License-Identifier: Apache-2.0](./LICENSE).

## Other documentation

* [All-time contributors](./CONTRIBUTORS.md)
* [Contributing guidelines](.github/CONTRIBUTING.md)
* [Maintainers documentation](docs/MAINTAINERS.md)
* [Code style](docs/STYLE.md)

## Cutting a new release

Maintainers can cut a new release by either:

* running [this workflow](https://github.com/go-openapi/spec/actions/workflows/bump-release.yml)
* or pushing a semver tag
  * signed tags are preferred
  * The tag message is prepended to release notes

<!-- Badges: status  -->
[test-badge]: https://github.com/go-openapi/spec/actions/workflows/go-test.yml/badge.svg
[test-url]: https://github.com/go-openapi/spec/actions/workflows/go-test.yml
[cov-badge]: https://codecov.io/gh/go-openapi/spec/branch/master/graph/badge.svg
[cov-url]: https://codecov.io/gh/go-openapi/spec
[vuln-scan-badge]: https://github.com/go-openapi/spec/actions/workflows/scanner.yml/badge.svg
[vuln-scan-url]: https://github.com/go-openapi/spec/actions/workflows/scanner.yml
[codeql-badge]: https://github.com/go-openapi/spec/actions/workflows/codeql.yml/badge.svg
[codeql-url]: https://github.com/go-openapi/spec/actions/workflows/codeql.yml
<!-- Badges: release & docker images  -->
[release-badge]: https://badge.fury.io/gh/go-openapi%2Fspec.svg
[release-url]: https://badge.fury.io/gh/go-openapi%2Fspec
[gomod-badge]: https://badge.fury.io/go/github.com%2Fgo-openapi%2Fspec.svg
[gomod-url]: https://badge.fury.io/go/github.com%2Fgo-openapi%2Fspec
<!-- Badges: code quality  -->
[gocard-badge]: https://goreportcard.com/badge/github.com/go-openapi/spec
[gocard-url]: https://goreportcard.com/report/github.com/go-openapi/spec
[codefactor-badge]: https://img.shields.io/codefactor/grade/github/go-openapi/spec
[codefactor-url]: https://www.codefactor.io/repository/github/go-openapi/spec
<!-- Badges: documentation & support -->
[doc-badge]: https://img.shields.io/badge/doc-site-blue?link=https%3A%2F%2Fgoswagger.io%2Fgo-openapi%2F
[doc-url]: https://goswagger.io/go-openapi
[godoc-badge]: https://pkg.go.dev/badge/github.com/go-openapi/spec
[godoc-url]: http://pkg.go.dev/github.com/go-openapi/spec
[slack-logo]: https://a.slack-edge.com/e6a93c1/img/icons/favicon-32.png
[slack-badge]: https://img.shields.io/badge/slack-blue?link=https%3A%2F%2Fgoswagger.slack.com%2Farchives%2FC04R30YM
[slack-url]: https://goswagger.slack.com/archives/C04R30YMU
[discord-badge]: https://img.shields.io/discord/1446918742398341256?logo=discord&label=discord&color=blue
[discord-url]: https://discord.gg/DrafRmZx

<!-- Badges: license & compliance -->
[license-badge]: http://img.shields.io/badge/license-Apache%20v2-orange.svg
[license-url]: https://github.com/go-openapi/spec/?tab=Apache-2.0-1-ov-file#readme
<!-- Badges: others & stats -->
[goversion-badge]: https://img.shields.io/github/go-mod/go-version/go-openapi/spec
[goversion-url]: https://github.com/go-openapi/spec/blob/master/go.mod
[top-badge]: https://img.shields.io/github/languages/top/go-openapi/spec
[commits-badge]: https://img.shields.io/github/commits-since/go-openapi/spec/latest
