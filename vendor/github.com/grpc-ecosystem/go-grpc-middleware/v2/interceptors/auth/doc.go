// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

/*
Package auth is a middleware that authenticates incoming gRPC requests.

`auth` a generic server-side auth middleware for gRPC.

# Server Side Auth Middleware

It allows for easy assertion of `:authorization` headers in gRPC calls, be it HTTP Basic auth, or
OAuth2 Bearer tokens.

The middleware takes a user-customizable `AuthFunc`, which can be customized to verify and extract
auth information from the request. The extracted information can be put in the `context.Context` of
handlers downstream for retrieval.

It also allows for per-service implementation overrides of `AuthFunc`. See `ServiceAuthFuncOverride`.

Please see examples for simple examples of use.
*/
package auth
