// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

/*
Package `metadata` provides convenience functions for dealing with gRPC metadata.MD objects inside
Context handlers.

While the upstream grpc-go package contains decent functionality (see https://github.com/grpc/grpc-go/blob/master/Documentation/grpc-metadata.md)
they are hard to use.

The majority of functions center around the MD, which is a convenience wrapper around metadata.MD. For example
the following code allows you to easily extract incoming metadata (server handler) and put it into a new client context
metadata.

  md := metadata.ExtractIncoming(serverCtx).Clone(":authorization", ":custom")
  clientCtx := md.Set("x-client-header", "2").Set("x-another", "3").ToOutgoing(ctx)
*/

package metadata
