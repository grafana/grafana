/*
`grpc_ctxtags` adds a Tag object to the context that can be used by other middleware to add context about a request.

Request Context Tags

Tags describe information about the request, and can be set and used by other middleware, or handlers. Tags are used
for logging and tracing of requests. Tags are populated both upwards, *and* downwards in the interceptor-handler stack.

You can automatically extract tags (in `grpc.request.<field_name>`) from request payloads.

For unary and server-streaming methods, pass in the `WithFieldExtractor` option. For client-streams and bidirectional-streams, you can
use `WithFieldExtractorForInitialReq` which will extract the tags from the first message passed from client to server.
Note the tags will not be modified for subsequent requests, so this option only makes sense when the initial message
establishes the meta-data for the stream.

If a user doesn't use the interceptors that initialize the `Tags` object, all operations following from an `Extract(ctx)`
will be no-ops. This is to ensure that code doesn't panic if the interceptors weren't used.

Tags fields are typed, and shallow and should follow the OpenTracing semantics convention:
https://github.com/opentracing/specification/blob/master/semantic_conventions.md
*/
package grpc_ctxtags
