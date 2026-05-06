// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

// Copyright 2017 David Ackroyd. All Rights Reserved.
// See LICENSE for licensing terms.

/*
Package recovery is a middleware that recovers from panics and logs the panic message.

`recovery` are interceptors that recover from gRPC handler panics.

# Server Side Recovery Middleware

By default a panic will be converted into a gRPC error with `code.Internal`.

Handling can be customised by providing an alternate recovery function.

Please see examples for simple examples of use.
*/
package recovery
