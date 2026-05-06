package middleware

import "context"

// SerializeInput provides the input parameters for the SerializeMiddleware to
// consume. SerializeMiddleware may modify the Request value before forwarding
// SerializeInput along to the next SerializeHandler. The Parameters member
// should not be modified by SerializeMiddleware, InitializeMiddleware should
// be responsible for modifying the provided Parameter value.
type SerializeInput struct {
	Parameters interface{}
	Request    interface{}
}

// SerializeOutput provides the result returned by the next SerializeHandler.
type SerializeOutput struct {
	Result interface{}
}

// SerializeHandler provides the interface for the next handler the
// SerializeMiddleware will call in the middleware chain.
type SerializeHandler interface {
	HandleSerialize(ctx context.Context, in SerializeInput) (
		out SerializeOutput, metadata Metadata, err error,
	)
}

// SerializeMiddleware provides the interface for middleware specific to the
// serialize step. Delegates to the next SerializeHandler for further
// processing.
type SerializeMiddleware interface {
	// ID returns a unique ID for the middleware in the SerializeStep. The step does not
	// allow duplicate IDs.
	ID() string

	// HandleSerialize invokes the middleware behavior which must delegate to the next handler
	// for the middleware chain to continue. The method must return a result or
	// error to its caller.
	HandleSerialize(ctx context.Context, in SerializeInput, next SerializeHandler) (
		out SerializeOutput, metadata Metadata, err error,
	)
}

// SerializeMiddlewareFunc returns a SerializeMiddleware with the unique ID
// provided, and the func to be invoked.
func SerializeMiddlewareFunc(id string, fn func(context.Context, SerializeInput, SerializeHandler) (SerializeOutput, Metadata, error)) SerializeMiddleware {
	return serializeMiddlewareFunc{
		id: id,
		fn: fn,
	}
}

type serializeMiddlewareFunc struct {
	// Unique ID for the middleware.
	id string

	// Middleware function to be called.
	fn func(context.Context, SerializeInput, SerializeHandler) (
		SerializeOutput, Metadata, error,
	)
}

// ID returns the unique ID for the middleware.
func (s serializeMiddlewareFunc) ID() string { return s.id }

// HandleSerialize invokes the middleware Fn.
func (s serializeMiddlewareFunc) HandleSerialize(ctx context.Context, in SerializeInput, next SerializeHandler) (
	out SerializeOutput, metadata Metadata, err error,
) {
	return s.fn(ctx, in, next)
}

var _ SerializeMiddleware = (serializeMiddlewareFunc{})

// SerializeStep provides the ordered grouping of SerializeMiddleware to be
// invoked on a handler.
type SerializeStep struct {
	newRequest func() interface{}
	ids        *orderedIDs
}

// NewSerializeStep returns a SerializeStep ready to have middleware for
// initialization added to it. The newRequest func parameter is used to
// initialize the transport specific request for the stack SerializeStep to
// serialize the input parameters into.
func NewSerializeStep(newRequest func() interface{}) *SerializeStep {
	return &SerializeStep{
		ids:        newOrderedIDs(),
		newRequest: newRequest,
	}
}

var _ Middleware = (*SerializeStep)(nil)

// ID returns the unique ID of the step as a middleware.
func (s *SerializeStep) ID() string {
	return "Serialize stack step"
}

// HandleMiddleware invokes the middleware by decorating the next handler
// provided. Returns the result of the middleware and handler being invoked.
//
// Implements Middleware interface.
func (s *SerializeStep) HandleMiddleware(ctx context.Context, in interface{}, next Handler) (
	out interface{}, metadata Metadata, err error,
) {
	order := s.ids.GetOrder()

	var h SerializeHandler = serializeWrapHandler{Next: next}
	for i := len(order) - 1; i >= 0; i-- {
		h = decoratedSerializeHandler{
			Next: h,
			With: order[i].(SerializeMiddleware),
		}
	}

	sIn := SerializeInput{
		Parameters: in,
		Request:    s.newRequest(),
	}

	res, metadata, err := h.HandleSerialize(ctx, sIn)
	return res.Result, metadata, err
}

// Get retrieves the middleware identified by id. If the middleware is not present, returns false.
func (s *SerializeStep) Get(id string) (SerializeMiddleware, bool) {
	get, ok := s.ids.Get(id)
	if !ok {
		return nil, false
	}
	return get.(SerializeMiddleware), ok
}

// Add injects the middleware to the relative position of the middleware group.
// Returns an error if the middleware already exists.
func (s *SerializeStep) Add(m SerializeMiddleware, pos RelativePosition) error {
	return s.ids.Add(m, pos)
}

// Insert injects the middleware relative to an existing middleware ID.
// Returns error if the original middleware does not exist, or the middleware
// being added already exists.
func (s *SerializeStep) Insert(m SerializeMiddleware, relativeTo string, pos RelativePosition) error {
	return s.ids.Insert(m, relativeTo, pos)
}

// Swap removes the middleware by id, replacing it with the new middleware.
// Returns the middleware removed, or error if the middleware to be removed
// doesn't exist.
func (s *SerializeStep) Swap(id string, m SerializeMiddleware) (SerializeMiddleware, error) {
	removed, err := s.ids.Swap(id, m)
	if err != nil {
		return nil, err
	}

	return removed.(SerializeMiddleware), nil
}

// Remove removes the middleware by id. Returns error if the middleware
// doesn't exist.
func (s *SerializeStep) Remove(id string) (SerializeMiddleware, error) {
	removed, err := s.ids.Remove(id)
	if err != nil {
		return nil, err
	}

	return removed.(SerializeMiddleware), nil
}

// List returns a list of the middleware in the step.
func (s *SerializeStep) List() []string {
	return s.ids.List()
}

// Clear removes all middleware in the step.
func (s *SerializeStep) Clear() {
	s.ids.Clear()
}

type serializeWrapHandler struct {
	Next Handler
}

var _ SerializeHandler = (*serializeWrapHandler)(nil)

// Implements SerializeHandler, converts types and delegates to underlying
// generic handler.
func (w serializeWrapHandler) HandleSerialize(ctx context.Context, in SerializeInput) (
	out SerializeOutput, metadata Metadata, err error,
) {
	res, metadata, err := w.Next.Handle(ctx, in.Request)
	return SerializeOutput{
		Result: res,
	}, metadata, err
}

type decoratedSerializeHandler struct {
	Next SerializeHandler
	With SerializeMiddleware
}

var _ SerializeHandler = (*decoratedSerializeHandler)(nil)

func (h decoratedSerializeHandler) HandleSerialize(ctx context.Context, in SerializeInput) (
	out SerializeOutput, metadata Metadata, err error,
) {
	return h.With.HandleSerialize(ctx, in, h.Next)
}

// SerializeHandlerFunc provides a wrapper around a function to be used as a serialize middleware handler.
type SerializeHandlerFunc func(context.Context, SerializeInput) (SerializeOutput, Metadata, error)

// HandleSerialize calls the wrapped function with the provided arguments.
func (s SerializeHandlerFunc) HandleSerialize(ctx context.Context, in SerializeInput) (SerializeOutput, Metadata, error) {
	return s(ctx, in)
}

var _ SerializeHandler = SerializeHandlerFunc(nil)
