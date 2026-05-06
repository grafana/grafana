package middleware

import "context"

// FinalizeInput provides the input parameters for the FinalizeMiddleware to
// consume. FinalizeMiddleware may modify the Request value before forwarding
// the FinalizeInput along to the next next FinalizeHandler.
type FinalizeInput struct {
	Request interface{}
}

// FinalizeOutput provides the result returned by the next FinalizeHandler.
type FinalizeOutput struct {
	Result interface{}
}

// FinalizeHandler provides the interface for the next handler the
// FinalizeMiddleware will call in the middleware chain.
type FinalizeHandler interface {
	HandleFinalize(ctx context.Context, in FinalizeInput) (
		out FinalizeOutput, metadata Metadata, err error,
	)
}

// FinalizeMiddleware provides the interface for middleware specific to the
// serialize step. Delegates to the next FinalizeHandler for further
// processing.
type FinalizeMiddleware interface {
	// ID returns a unique ID for the middleware in the FinalizeStep. The step does not
	// allow duplicate IDs.
	ID() string

	// HandleFinalize invokes the middleware behavior which must delegate to the next handler
	// for the middleware chain to continue. The method must return a result or
	// error to its caller.
	HandleFinalize(ctx context.Context, in FinalizeInput, next FinalizeHandler) (
		out FinalizeOutput, metadata Metadata, err error,
	)
}

// FinalizeMiddlewareFunc returns a FinalizeMiddleware with the unique ID
// provided, and the func to be invoked.
func FinalizeMiddlewareFunc(id string, fn func(context.Context, FinalizeInput, FinalizeHandler) (FinalizeOutput, Metadata, error)) FinalizeMiddleware {
	return finalizeMiddlewareFunc{
		id: id,
		fn: fn,
	}
}

type finalizeMiddlewareFunc struct {
	// Unique ID for the middleware.
	id string

	// Middleware function to be called.
	fn func(context.Context, FinalizeInput, FinalizeHandler) (
		FinalizeOutput, Metadata, error,
	)
}

// ID returns the unique ID for the middleware.
func (s finalizeMiddlewareFunc) ID() string { return s.id }

// HandleFinalize invokes the middleware Fn.
func (s finalizeMiddlewareFunc) HandleFinalize(ctx context.Context, in FinalizeInput, next FinalizeHandler) (
	out FinalizeOutput, metadata Metadata, err error,
) {
	return s.fn(ctx, in, next)
}

var _ FinalizeMiddleware = (finalizeMiddlewareFunc{})

// FinalizeStep provides the ordered grouping of FinalizeMiddleware to be
// invoked on a handler.
type FinalizeStep struct {
	ids *orderedIDs
}

// NewFinalizeStep returns a FinalizeStep ready to have middleware for
// initialization added to it.
func NewFinalizeStep() *FinalizeStep {
	return &FinalizeStep{
		ids: newOrderedIDs(),
	}
}

var _ Middleware = (*FinalizeStep)(nil)

// ID returns the unique id of the step as a middleware.
func (s *FinalizeStep) ID() string {
	return "Finalize stack step"
}

// HandleMiddleware invokes the middleware by decorating the next handler
// provided. Returns the result of the middleware and handler being invoked.
//
// Implements Middleware interface.
func (s *FinalizeStep) HandleMiddleware(ctx context.Context, in interface{}, next Handler) (
	out interface{}, metadata Metadata, err error,
) {
	order := s.ids.GetOrder()

	var h FinalizeHandler = finalizeWrapHandler{Next: next}
	for i := len(order) - 1; i >= 0; i-- {
		h = decoratedFinalizeHandler{
			Next: h,
			With: order[i].(FinalizeMiddleware),
		}
	}

	sIn := FinalizeInput{
		Request: in,
	}

	res, metadata, err := h.HandleFinalize(ctx, sIn)
	return res.Result, metadata, err
}

// Get retrieves the middleware identified by id. If the middleware is not present, returns false.
func (s *FinalizeStep) Get(id string) (FinalizeMiddleware, bool) {
	get, ok := s.ids.Get(id)
	if !ok {
		return nil, false
	}
	return get.(FinalizeMiddleware), ok
}

// Add injects the middleware to the relative position of the middleware group.
// Returns an error if the middleware already exists.
func (s *FinalizeStep) Add(m FinalizeMiddleware, pos RelativePosition) error {
	return s.ids.Add(m, pos)
}

// Insert injects the middleware relative to an existing middleware ID.
// Returns error if the original middleware does not exist, or the middleware
// being added already exists.
func (s *FinalizeStep) Insert(m FinalizeMiddleware, relativeTo string, pos RelativePosition) error {
	return s.ids.Insert(m, relativeTo, pos)
}

// Swap removes the middleware by id, replacing it with the new middleware.
// Returns the middleware removed, or error if the middleware to be removed
// doesn't exist.
func (s *FinalizeStep) Swap(id string, m FinalizeMiddleware) (FinalizeMiddleware, error) {
	removed, err := s.ids.Swap(id, m)
	if err != nil {
		return nil, err
	}

	return removed.(FinalizeMiddleware), nil
}

// Remove removes the middleware by id. Returns error if the middleware
// doesn't exist.
func (s *FinalizeStep) Remove(id string) (FinalizeMiddleware, error) {
	removed, err := s.ids.Remove(id)
	if err != nil {
		return nil, err
	}

	return removed.(FinalizeMiddleware), nil
}

// List returns a list of the middleware in the step.
func (s *FinalizeStep) List() []string {
	return s.ids.List()
}

// Clear removes all middleware in the step.
func (s *FinalizeStep) Clear() {
	s.ids.Clear()
}

type finalizeWrapHandler struct {
	Next Handler
}

var _ FinalizeHandler = (*finalizeWrapHandler)(nil)

// HandleFinalize implements FinalizeHandler, converts types and delegates to underlying
// generic handler.
func (w finalizeWrapHandler) HandleFinalize(ctx context.Context, in FinalizeInput) (
	out FinalizeOutput, metadata Metadata, err error,
) {
	res, metadata, err := w.Next.Handle(ctx, in.Request)
	return FinalizeOutput{
		Result: res,
	}, metadata, err
}

type decoratedFinalizeHandler struct {
	Next FinalizeHandler
	With FinalizeMiddleware
}

var _ FinalizeHandler = (*decoratedFinalizeHandler)(nil)

func (h decoratedFinalizeHandler) HandleFinalize(ctx context.Context, in FinalizeInput) (
	out FinalizeOutput, metadata Metadata, err error,
) {
	return h.With.HandleFinalize(ctx, in, h.Next)
}

// FinalizeHandlerFunc provides a wrapper around a function to be used as a finalize middleware handler.
type FinalizeHandlerFunc func(context.Context, FinalizeInput) (FinalizeOutput, Metadata, error)

// HandleFinalize invokes the wrapped function with the given arguments.
func (f FinalizeHandlerFunc) HandleFinalize(ctx context.Context, in FinalizeInput) (FinalizeOutput, Metadata, error) {
	return f(ctx, in)
}

var _ FinalizeHandler = FinalizeHandlerFunc(nil)
