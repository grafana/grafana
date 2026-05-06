package middleware

import (
	"context"
)

// BuildInput provides the input parameters for the BuildMiddleware to consume.
// BuildMiddleware may modify the Request value before forwarding the input
// along to the next BuildHandler.
type BuildInput struct {
	Request interface{}
}

// BuildOutput provides the result returned by the next BuildHandler.
type BuildOutput struct {
	Result interface{}
}

// BuildHandler provides the interface for the next handler the
// BuildMiddleware will call in the middleware chain.
type BuildHandler interface {
	HandleBuild(ctx context.Context, in BuildInput) (
		out BuildOutput, metadata Metadata, err error,
	)
}

// BuildMiddleware provides the interface for middleware specific to the
// serialize step. Delegates to the next BuildHandler for further
// processing.
type BuildMiddleware interface {
	// Unique ID for the middleware in theBuildStep. The step does not allow
	// duplicate IDs.
	ID() string

	// Invokes the middleware behavior which must delegate to the next handler
	// for the middleware chain to continue. The method must return a result or
	// error to its caller.
	HandleBuild(ctx context.Context, in BuildInput, next BuildHandler) (
		out BuildOutput, metadata Metadata, err error,
	)
}

// BuildMiddlewareFunc returns a BuildMiddleware with the unique ID provided,
// and the func to be invoked.
func BuildMiddlewareFunc(id string, fn func(context.Context, BuildInput, BuildHandler) (BuildOutput, Metadata, error)) BuildMiddleware {
	return buildMiddlewareFunc{
		id: id,
		fn: fn,
	}
}

type buildMiddlewareFunc struct {
	// Unique ID for the middleware.
	id string

	// Middleware function to be called.
	fn func(context.Context, BuildInput, BuildHandler) (BuildOutput, Metadata, error)
}

// ID returns the unique ID for the middleware.
func (s buildMiddlewareFunc) ID() string { return s.id }

// HandleBuild invokes the middleware Fn.
func (s buildMiddlewareFunc) HandleBuild(ctx context.Context, in BuildInput, next BuildHandler) (
	out BuildOutput, metadata Metadata, err error,
) {
	return s.fn(ctx, in, next)
}

var _ BuildMiddleware = (buildMiddlewareFunc{})

// BuildStep provides the ordered grouping of BuildMiddleware to be invoked on
// a handler.
type BuildStep struct {
	ids *orderedIDs
}

// NewBuildStep returns a BuildStep ready to have middleware for
// initialization added to it.
func NewBuildStep() *BuildStep {
	return &BuildStep{
		ids: newOrderedIDs(),
	}
}

var _ Middleware = (*BuildStep)(nil)

// ID returns the unique name of the step as a middleware.
func (s *BuildStep) ID() string {
	return "Build stack step"
}

// HandleMiddleware invokes the middleware by decorating the next handler
// provided. Returns the result of the middleware and handler being invoked.
//
// Implements Middleware interface.
func (s *BuildStep) HandleMiddleware(ctx context.Context, in interface{}, next Handler) (
	out interface{}, metadata Metadata, err error,
) {
	order := s.ids.GetOrder()

	var h BuildHandler = buildWrapHandler{Next: next}
	for i := len(order) - 1; i >= 0; i-- {
		h = decoratedBuildHandler{
			Next: h,
			With: order[i].(BuildMiddleware),
		}
	}

	sIn := BuildInput{
		Request: in,
	}

	res, metadata, err := h.HandleBuild(ctx, sIn)
	return res.Result, metadata, err
}

// Get retrieves the middleware identified by id. If the middleware is not present, returns false.
func (s *BuildStep) Get(id string) (BuildMiddleware, bool) {
	get, ok := s.ids.Get(id)
	if !ok {
		return nil, false
	}
	return get.(BuildMiddleware), ok
}

// Add injects the middleware to the relative position of the middleware group.
// Returns an error if the middleware already exists.
func (s *BuildStep) Add(m BuildMiddleware, pos RelativePosition) error {
	return s.ids.Add(m, pos)
}

// Insert injects the middleware relative to an existing middleware id.
// Returns an error if the original middleware does not exist, or the middleware
// being added already exists.
func (s *BuildStep) Insert(m BuildMiddleware, relativeTo string, pos RelativePosition) error {
	return s.ids.Insert(m, relativeTo, pos)
}

// Swap removes the middleware by id, replacing it with the new middleware.
// Returns the middleware removed, or an error if the middleware to be removed
// doesn't exist.
func (s *BuildStep) Swap(id string, m BuildMiddleware) (BuildMiddleware, error) {
	removed, err := s.ids.Swap(id, m)
	if err != nil {
		return nil, err
	}

	return removed.(BuildMiddleware), nil
}

// Remove removes the middleware by id. Returns error if the middleware
// doesn't exist.
func (s *BuildStep) Remove(id string) (BuildMiddleware, error) {
	removed, err := s.ids.Remove(id)
	if err != nil {
		return nil, err
	}

	return removed.(BuildMiddleware), nil
}

// List returns a list of the middleware in the step.
func (s *BuildStep) List() []string {
	return s.ids.List()
}

// Clear removes all middleware in the step.
func (s *BuildStep) Clear() {
	s.ids.Clear()
}

type buildWrapHandler struct {
	Next Handler
}

var _ BuildHandler = (*buildWrapHandler)(nil)

// Implements BuildHandler, converts types and delegates to underlying
// generic handler.
func (w buildWrapHandler) HandleBuild(ctx context.Context, in BuildInput) (
	out BuildOutput, metadata Metadata, err error,
) {
	res, metadata, err := w.Next.Handle(ctx, in.Request)
	return BuildOutput{
		Result: res,
	}, metadata, err
}

type decoratedBuildHandler struct {
	Next BuildHandler
	With BuildMiddleware
}

var _ BuildHandler = (*decoratedBuildHandler)(nil)

func (h decoratedBuildHandler) HandleBuild(ctx context.Context, in BuildInput) (
	out BuildOutput, metadata Metadata, err error,
) {
	return h.With.HandleBuild(ctx, in, h.Next)
}

// BuildHandlerFunc provides a wrapper around a function to be used as a build middleware handler.
type BuildHandlerFunc func(context.Context, BuildInput) (BuildOutput, Metadata, error)

// HandleBuild invokes the wrapped function with the provided arguments.
func (b BuildHandlerFunc) HandleBuild(ctx context.Context, in BuildInput) (BuildOutput, Metadata, error) {
	return b(ctx, in)
}

var _ BuildHandler = BuildHandlerFunc(nil)
