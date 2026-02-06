package http

import (
	"context"
	"fmt"

	"github.com/aws/smithy-go/middleware"
)

type isContentTypeAutoSet struct{}

// SetIsContentTypeDefaultValue returns a Context specifying if the request's
// content-type header was set to a default value.
func SetIsContentTypeDefaultValue(ctx context.Context, isDefault bool) context.Context {
	return context.WithValue(ctx, isContentTypeAutoSet{}, isDefault)
}

// GetIsContentTypeDefaultValue returns if the content-type HTTP header on the
// request is a default value that was auto assigned by an operation
// serializer. Allows middleware post serialization to know if the content-type
// was auto set to a default value or not.
//
// Also returns false if the Context value was never updated to include if
// content-type was set to a default value.
func GetIsContentTypeDefaultValue(ctx context.Context) bool {
	v, _ := ctx.Value(isContentTypeAutoSet{}).(bool)
	return v
}

// AddNoPayloadDefaultContentTypeRemover Adds the DefaultContentTypeRemover
// middleware to the stack after the operation serializer. This middleware will
// remove the content-type header from the request if it was set as a default
// value, and no request payload is present.
//
// Returns error if unable to add the middleware.
func AddNoPayloadDefaultContentTypeRemover(stack *middleware.Stack) (err error) {
	err = stack.Serialize.Insert(removeDefaultContentType{},
		"OperationSerializer", middleware.After)
	if err != nil {
		return fmt.Errorf("failed to add %s serialize middleware, %w",
			removeDefaultContentType{}.ID(), err)
	}

	return nil
}

// RemoveNoPayloadDefaultContentTypeRemover removes the
// DefaultContentTypeRemover middleware from the stack. Returns an error if
// unable to remove the middleware.
func RemoveNoPayloadDefaultContentTypeRemover(stack *middleware.Stack) (err error) {
	_, err = stack.Serialize.Remove(removeDefaultContentType{}.ID())
	if err != nil {
		return fmt.Errorf("failed to remove %s serialize middleware, %w",
			removeDefaultContentType{}.ID(), err)

	}
	return nil
}

// removeDefaultContentType provides after serialization middleware that will
// remove the content-type header from an HTTP request if the header was set as
// a default value by the operation serializer, and there is no request payload.
type removeDefaultContentType struct{}

// ID returns the middleware ID
func (removeDefaultContentType) ID() string { return "RemoveDefaultContentType" }

// HandleSerialize implements the serialization middleware.
func (removeDefaultContentType) HandleSerialize(
	ctx context.Context, input middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, meta middleware.Metadata, err error,
) {
	req, ok := input.Request.(*Request)
	if !ok {
		return out, meta, fmt.Errorf(
			"unexpected request type %T for removeDefaultContentType middleware",
			input.Request)
	}

	if GetIsContentTypeDefaultValue(ctx) && req.GetStream() == nil {
		req.Header.Del("Content-Type")
		input.Request = req
	}

	return next.HandleSerialize(ctx, input)
}

type headerValue struct {
	header string
	value  string
	append bool
}

type headerValueHelper struct {
	headerValues []headerValue
}

func (h *headerValueHelper) addHeaderValue(value headerValue) {
	h.headerValues = append(h.headerValues, value)
}

func (h *headerValueHelper) ID() string {
	return "HTTPHeaderHelper"
}

func (h *headerValueHelper) HandleBuild(ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler) (out middleware.BuildOutput, metadata middleware.Metadata, err error) {
	req, ok := in.Request.(*Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type %T", in.Request)
	}

	for _, value := range h.headerValues {
		if value.append {
			req.Header.Add(value.header, value.value)
		} else {
			req.Header.Set(value.header, value.value)
		}
	}

	return next.HandleBuild(ctx, in)
}

func getOrAddHeaderValueHelper(stack *middleware.Stack) (*headerValueHelper, error) {
	id := (*headerValueHelper)(nil).ID()
	m, ok := stack.Build.Get(id)
	if !ok {
		m = &headerValueHelper{}
		err := stack.Build.Add(m, middleware.After)
		if err != nil {
			return nil, err
		}
	}

	requestUserAgent, ok := m.(*headerValueHelper)
	if !ok {
		return nil, fmt.Errorf("%T for %s middleware did not match expected type", m, id)
	}

	return requestUserAgent, nil
}

// AddHeaderValue returns a stack mutator that adds the header value pair to header.
// Appends to any existing values if present.
func AddHeaderValue(header string, value string) func(stack *middleware.Stack) error {
	return func(stack *middleware.Stack) error {
		helper, err := getOrAddHeaderValueHelper(stack)
		if err != nil {
			return err
		}
		helper.addHeaderValue(headerValue{header: header, value: value, append: true})
		return nil
	}
}

// SetHeaderValue returns a stack mutator that adds the header value pair to header.
// Replaces any existing values if present.
func SetHeaderValue(header string, value string) func(stack *middleware.Stack) error {
	return func(stack *middleware.Stack) error {
		helper, err := getOrAddHeaderValueHelper(stack)
		if err != nil {
			return err
		}
		helper.addHeaderValue(headerValue{header: header, value: value, append: false})
		return nil
	}
}
