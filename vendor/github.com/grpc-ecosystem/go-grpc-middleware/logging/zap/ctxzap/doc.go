/*
`ctxzap` is a ctxlogger that is backed by Zap

It accepts a user-configured `zap.Logger` that will be used for logging. The same `zap.Logger` will
be populated into the `context.Context` passed into gRPC handler code.

You can use `ctxzap.Extract` to log into a request-scoped `zap.Logger` instance in your handler code.

As `ctxzap.Extract` will iterate all tags on from `grpc_ctxtags` it is therefore expensive so it is advised that you
extract once at the start of the function from the context and reuse it for the remainder of the function (see examples).

Please see examples and tests for examples of use.
*/
package ctxzap
