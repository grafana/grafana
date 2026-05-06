package middleware

import "context"

// InitializeInput wraps the input parameters for the InitializeMiddlewares to
// consume. InitializeMiddleware may modify the parameter value before
// forwarding it along to the next InitializeHandler.
type InitializeInput struct {
	Parameters interface{}
}

// InitializeOutput provides the result returned by the next InitializeHandler.
type InitializeOutput struct {
	Result interface{}
}

// InitializeHandler provides the interface for the next handler the
// InitializeMiddleware will call in the middleware chain.
type InitializeHandler interface {
	HandleInitialize(ctx context.Context, in InitializeInput) (
		out InitializeOutput, metadata Metadata, err error,
	)
}

// InitializeMiddleware provides the interface for middleware specific to the
// initialize step. Delegates to the next InitializeHandler for further
// processing.
type InitializeMiddleware interface {
	// ID returns a unique ID for the middleware in the InitializeStep. The step does not
	// allow duplicate IDs.
	ID() string

	// HandleInitialize invokes the middleware behavior which must delegate to the next handler
	// for the middleware chain to continue. The method must return a result or
	// error to its caller.
	HandleInitialize(ctx context.Context, in InitializeInput, next InitializeHandler) (
		out InitializeOutput, metadata Metadata, err error,
	)
}

// InitializeMiddlewareFunc returns a InitializeMiddleware with the unique ID provided,
// and the func to be invoked.
func InitializeMiddlewareFunc(id string, fn func(context.Context, InitializeInput, InitializeHandler) (InitializeOutput, Metadata, error)) InitializeMiddleware {
	return initializeMiddlewareFunc{
		id: id,
		fn: fn,
	}
}

type initializeMiddlewareFunc struct {
	// Unique ID for the middleware.
	id string

	// Middleware function to be called.
	fn func(context.Context, InitializeInput, InitializeHandler) (
		InitializeOutput, Metadata, error,
	)
}

// ID returns the unique ID for the middleware.
func (s initializeMiddlewareFunc) ID() string { return s.id }

// HandleInitialize invokes the middleware Fn.
func (s initializeMiddlewareFunc) HandleInitialize(ctx context.Context, in InitializeInput, next InitializeHandler) (
	out InitializeOutput, metadata Metadata, err error,
) {
	return s.fn(ctx, in, next)
}

var _ InitializeMiddleware = (initializeMiddlewareFunc{})

// InitializeStep provides the ordered grouping of InitializeMiddleware to be
// invoked on a handler.
type InitializeStep struct {
	ids *orderedIDs
}

// NewInitializeStep returns an InitializeStep ready to have middleware for
// initialization added to it.
func NewInitializeStep() *InitializeStep {
	return &InitializeStep{
		ids: newOrderedIDs(),
	}
}

var _ Middleware = (*InitializeStep)(nil)

// ID returns the unique ID of the step as a middleware.
func (s *InitializeStep) ID() string {
	return "Initialize stack step"
}

// HandleMiddleware invokes the middleware by decorating the next handler
// provided. Returns the result of the middleware and handler being invoked.
//
// Implements Middleware interface.
func (s *InitializeStep) HandleMiddleware(ctx context.Context, in interface{}, next Handler) (
	out interface{}, metadata Metadata, err error,
) {
	order := s.ids.GetOrder()

	var h InitializeHandler = initializeWrapHandler{Next: next}
	for i := len(order) - 1; i >= 0; i-- {
		h = decoratedInitializeHandler{
			Next: h,
			With: order[i].(InitializeMiddleware),
		}
	}

	sIn := InitializeInput{
		Parameters: in,
	}

	res, metadata, err := h.HandleInitialize(ctx, sIn)
	return res.Result, metadata, err
}

// Get retrieves the middleware identified by id. If the middleware is not present, returns false.
func (s *InitializeStep) Get(id string) (InitializeMiddleware, bool) {
	get, ok := s.ids.Get(id)
	if !ok {
		return nil, false
	}
	return get.(InitializeMiddleware), ok
}

// Add injects the middleware to the relative position of the middleware group.
// Returns an error if the middleware already exists.
func (s *InitializeStep) Add(m InitializeMiddleware, pos RelativePosition) error {
	return s.ids.Add(m, pos)
}

// Insert injects the middleware relative to an existing middleware ID.
// Returns error if the original middleware does not exist, or the middleware
// being added already exists.
func (s *InitializeStep) Insert(m InitializeMiddleware, relativeTo string, pos RelativePosition) error {
	return s.ids.Insert(m, relativeTo, pos)
}

// Swap removes the middleware by id, replacing it with the new middleware.
// Returns the middleware removed, or error if the middleware to be removed
// doesn't exist.
func (s *InitializeStep) Swap(id string, m InitializeMiddleware) (InitializeMiddleware, error) {
	removed, err := s.ids.Swap(id, m)
	if err != nil {
		return nil, err
	}

	return removed.(InitializeMiddleware), nil
}

// Remove removes the middleware by id. Returns error if the middleware
// doesn't exist.
func (s *InitializeStep) Remove(id string) (InitializeMiddleware, error) {
	removed, err := s.ids.Remove(id)
	if err != nil {
		return nil, err
	}

	return removed.(InitializeMiddleware), nil
}

// List returns a list of the middleware in the step.
func (s *InitializeStep) List() []string {
	return s.ids.List()
}

// Clear removes all middleware in the step.
func (s *InitializeStep) Clear() {
	s.ids.Clear()
}

type initializeWrapHandler struct {
	Next Handler
}

var _ InitializeHandler = (*initializeWrapHandler)(nil)

// HandleInitialize implements InitializeHandler, converts types and delegates to underlying
// generic handler.
func (w initializeWrapHandler) HandleInitialize(ctx context.Context, in InitializeInput) (
	out InitializeOutput, metadata Metadata, err error,
) {
	res, metadata, err := w.Next.Handle(ctx, in.Parameters)
	return InitializeOutput{
		Result: res,
	}, metadata, err
}

type decoratedInitializeHandler struct {
	Next InitializeHandler
	With InitializeMiddleware
}

var _ InitializeHandler = (*decoratedInitializeHandler)(nil)

func (h decoratedInitializeHandler) HandleInitialize(ctx context.Context, in InitializeInput) (
	out InitializeOutput, metadata Metadata, err error,
) {
	return h.With.HandleInitialize(ctx, in, h.Next)
}

// InitializeHandlerFunc provides a wrapper around a function to be used as an initialize middleware handler.
type InitializeHandlerFunc func(context.Context, InitializeInput) (InitializeOutput, Metadata, error)

// HandleInitialize calls the wrapped function with the provided arguments.
func (i InitializeHandlerFunc) HandleInitialize(ctx context.Context, in InitializeInput) (InitializeOutput, Metadata, error) {
	return i(ctx, in)
}

var _ InitializeHandler = InitializeHandlerFunc(nil)
