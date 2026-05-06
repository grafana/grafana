# Smithy Go

[![Go Build Status](https://github.com/aws/smithy-go/actions/workflows/go.yml/badge.svg?branch=main)](https://github.com/aws/smithy-go/actions/workflows/go.yml)[![Codegen Build Status](https://github.com/aws/smithy-go/actions/workflows/codegen.yml/badge.svg?branch=main)](https://github.com/aws/smithy-go/actions/workflows/codegen.yml)

[Smithy](https://smithy.io/) code generators for Go and the accompanying smithy-go runtime.

The smithy-go runtime requires a minimum version of Go 1.20.

**WARNING: All interfaces are subject to change.**

## Can I use the code generators?

In order to generate a usable smithy client you must provide a [protocol definition](https://github.com/aws/smithy-go/blob/main/codegen/smithy-go-codegen/src/main/java/software/amazon/smithy/go/codegen/integration/ProtocolGenerator.java),
such as [AWS restJson1](https://smithy.io/2.0/aws/protocols/aws-restjson1-protocol.html),
in order to generate transport mechanisms and serialization/deserialization
code ("serde") accordingly.

The code generator does not currently support any protocols out of the box other than the new `smithy.protocols#rpcv2Cbor`,
therefore the useability of this project on its own is currently limited.
Support for all [AWS protocols](https://smithy.io/2.0/aws/protocols/index.html)
exists in [aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2). We are
tracking the movement of those out of the SDK into smithy-go in
[#458](https://github.com/aws/smithy-go/issues/458), but there's currently no
timeline for doing so.

## Plugins

This repository implements the following Smithy build plugins:

| ID | GAV prefix | Description |
|----|------------|-------------|
| `go-codegen`        | `software.amazon.smithy.go:smithy-go-codegen` | Implements Go client code generation for Smithy models. |
| `go-server-codegen` | `software.amazon.smithy.go:smithy-go-codegen` | Implements Go server code generation for Smithy models. |

**NOTE: Build plugins are not currently published to mavenCentral. You must publish to mavenLocal to make the build plugins visible to the Smithy CLI. The artifact version is currently fixed at 0.1.0.**

## `go-codegen`

### Configuration

[`GoSettings`](codegen/smithy-go-codegen/src/main/java/software/amazon/smithy/go/codegen/GoSettings.java)
contains all of the settings enabled from `smithy-build.json` and helper
methods and types. The up-to-date list of top-level properties enabled for
`go-client-codegen` can be found in `GoSettings::from()`.

| Setting         | Type    | Required | Description                                                                                                                 |
|-----------------|---------|----------|-----------------------------------------------------------------------------------------------------------------------------|
| `service`       | string  | yes      | The Shape ID of the service for which to generate the client.                                                               |
| `module`        | string  | yes      | Name of the module in `generated.json` (and `go.mod` if `generateGoMod` is enabled) and `doc.go`.                           |
| `generateGoMod` | boolean |          | Whether to generate a default `go.mod` file. The default value is `false`.                                                  |
| `goDirective`   | string  |          | [Go directive](https://go.dev/ref/mod#go-mod-file-go) of the module. The default value is the minimum supported Go version. |

### Supported protocols

| Protocol | Notes |
|----------|-------|
| [`smithy.protocols#rpcv2Cbor`](https://smithy.io/2.0/additional-specs/protocols/smithy-rpc-v2.html) | Event streaming not yet implemented. |

### Example

This example applies the `go-codegen` build plugin to the Smithy quickstart
example created from `smithy init`:

```json
{
  "version": "1.0",
  "sources": [
    "models"
  ],
  "maven": {
    "dependencies": [
      "software.amazon.smithy.go:smithy-go-codegen:0.1.0"
    ]
  },
  "plugins": {
    "go-codegen": {
      "service": "example.weather#Weather",
      "module": "github.com/example/weather",
      "generateGoMod": true,
      "goDirective": "1.20"
    }
  }
}
```

## `go-server-codegen`

This plugin is a work-in-progress and is currently undocumented.

## License

This project is licensed under the Apache-2.0 License.

