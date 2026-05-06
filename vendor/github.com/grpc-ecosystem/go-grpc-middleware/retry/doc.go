// Copyright 2016 Michal Witkowski. All Rights Reserved.
// See LICENSE for licensing terms.

/*
`grpc_retry` provides client-side request retry logic for gRPC.

Client-Side Request Retry Interceptor

It allows for automatic retry, inside the generated gRPC code of requests based on the gRPC status
of the reply. It supports unary (1:1), and server stream (1:n) requests.

By default the interceptors *are disabled*, preventing accidental use of retries. You can easily
override the number of retries (setting them to more than 0) with a `grpc.ClientOption`, e.g.:

 myclient.Ping(ctx, goodPing, grpc_retry.WithMax(5))

Other default options are: retry on `ResourceExhausted` and `Unavailable` gRPC codes, use a 50ms
linear backoff with 10% jitter.

For chained interceptors, the retry interceptor will call every interceptor that follows it
whenever a retry happens.

Please see examples for more advanced use.
*/
package grpc_retry
