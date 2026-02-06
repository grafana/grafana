# OpenTracing support for gRPC in Go

[![CI](https://github.com/opentracing-contrib/go-grpc/actions/workflows/ci.yml/badge.svg)](https://github.com/opentracing-contrib/go-grpc/actions/workflows/ci.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/opentracing-contrib/go-grpc)](https://goreportcard.com/report/github.com/opentracing-contrib/go-grpc)
![GitHub go.mod Go version](https://img.shields.io/github/go-mod/go-version/opentracing-contrib/go-grpc)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/opentracing-contrib/go-grpc?logo=github&sort=semver)](https://github.com/opentracing-contrib/go-grpc/releases/latest)

The `otgrpc` package makes it easy to add OpenTracing support to gRPC-based
systems in Go.

## Installation

```shell
go get github.com/opentracing-contrib/go-grpc
```

## Documentation

See the basic usage examples below and the [package documentation on
godoc.org](https://godoc.org/github.com/opentracing-contrib/go-grpc).

## Client-side usage example

Wherever you call `grpc.Dial`:

```go
// You must have some sort of OpenTracing Tracer instance on hand.
var tracer opentracing.Tracer = ...
...

// Set up a connection to the server peer.
conn, err := grpc.Dial(
    address,
    ... // other options
    grpc.WithUnaryInterceptor(
        otgrpc.OpenTracingClientInterceptor(tracer)),
    grpc.WithStreamInterceptor(
        otgrpc.OpenTracingStreamClientInterceptor(tracer)))

// All future RPC activity involving `conn` will be automatically traced.
```

## Server-side usage example

Wherever you call `grpc.NewServer`:

```go
// You must have some sort of OpenTracing Tracer instance on hand.
var tracer opentracing.Tracer = ...
...

// Initialize the gRPC server.
s := grpc.NewServer(
    ... // other options
    grpc.UnaryInterceptor(
        otgrpc.OpenTracingServerInterceptor(tracer)),
    grpc.StreamInterceptor(
        otgrpc.OpenTracingStreamServerInterceptor(tracer)))

// All future RPC activity involving `s` will be automatically traced.
```
