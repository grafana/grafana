// Package middleware provides transport agnostic middleware for decorating SDK
// handlers.
//
// The Smithy middleware stack provides ordered behavior to be invoked on an
// underlying handler. The stack is separated into steps that are invoked in a
// static order. A step is a collection of middleware that are injected into a
// ordered list defined by the user. The user may add, insert, swap, and remove a
// step's middleware. When the stack is invoked the step middleware become static,
// and their order cannot be modified.
//
// A stack and its step middleware are **not** safe to modify concurrently.
//
// A stack will use the ordered list of middleware to decorate a underlying
// handler. A handler could be something like an HTTP Client that round trips an
// API operation over HTTP.
//
// Smithy Middleware Stack
//
// A Stack is a collection of middleware that wrap a handler. The stack can be
// broken down into discreet steps. Each step may contain zero or more middleware
// specific to that stack's step.
//
// A Stack Step is a predefined set of middleware that are invoked in a static
// order by the Stack. These steps represent fixed points in the middleware stack
// for organizing specific behavior, such as serialize and build. A Stack Step is
// composed of zero or more middleware that are specific to that step. A step may
// define its own set of input/output parameters the generic input/output
// parameters are cast from. A step calls its middleware recursively, before
// calling the next step in the stack returning the result or error of the step
// middleware decorating the underlying handler.
//
// * Initialize: Prepares the input, and sets any default parameters as needed,
// (e.g. idempotency token, and presigned URLs).
//
// * Serialize: Serializes the prepared input into a data structure that can be
// consumed by the target transport's message, (e.g. REST-JSON serialization).
//
// * Build: Adds additional metadata to the serialized transport message, (e.g.
// HTTP's Content-Length header, or body checksum). Decorations and
// modifications to the message should be copied to all message attempts.
//
// * Finalize: Performs final preparations needed before sending the message. The
// message should already be complete by this stage, and is only alternated to
// meet the expectations of the recipient, (e.g. Retry and AWS SigV4 request
// signing).
//
// * Deserialize: Reacts to the handler's response returned by the recipient of
// the request message. Deserializes the response into a structured type or
// error above stacks can react to.
//
// Adding Middleware to a Stack Step
//
// Middleware can be added to a step front or back, or relative, by name, to an
// existing middleware in that stack. If a middleware does not have a name, a
// unique name will be generated at the middleware and be added to the step.
//
//     // Create middleware stack
//     stack := middleware.NewStack()
//
//     // Add middleware to stack steps
//     stack.Initialize.Add(paramValidationMiddleware, middleware.After)
//     stack.Serialize.Add(marshalOperationFoo, middleware.After)
//     stack.Deserialize.Add(unmarshalOperationFoo, middleware.After)
//
//     // Invoke middleware on handler.
//     resp, err := stack.HandleMiddleware(ctx, req.Input, clientHandler)
package middleware
