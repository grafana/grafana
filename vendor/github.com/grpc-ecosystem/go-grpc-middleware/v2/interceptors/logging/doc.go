// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

/*
Package logging is a "parent" package for gRPC logging middlewares.

The gRPC logging middleware populates request-scoped data to `logging.Fields` that relate to the current gRPC call
(e.g. service and method names). You can extract/inject data in the propagated context using `logging.ExtractFields` and `logging.InjectFields`.

Once the gRPC logging middleware has added the gRPC specific Fields to the ctx they will then be written with the log lines.

All logging middleware will emit a final log statement. It is based on the error returned by the handler function,
the gRPC status code, an error (if any) and it emits at a level controlled via `WithLevels`. You can control this behavior
using `WithDecider`.

# This parent package

This particular package is intended for use by other middleware, logging or otherwise. It contains interfaces that other
logging middlewares *could* share. This allows code to be shared between different implementations.

# Field names

All field names of loggers follow the OpenTracing semantics definitions, with `grpc.` prefix if needed:
https://github.com/opentracing/specification/blob/master/semantic_conventions.md

Implementations:

* providers/kit
* providers/logr
* providers/logrus
* providers/phuslog
* providers/slog
* providers/zap
* providers/zerolog
*/
package logging
