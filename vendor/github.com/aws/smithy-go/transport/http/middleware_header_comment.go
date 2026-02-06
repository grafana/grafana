package http

import (
	"context"
	"fmt"
	"net/http"

	"github.com/aws/smithy-go/middleware"
)

// WithHeaderComment instruments a middleware stack to append an HTTP field
// comment to the given header as specified in RFC 9110
// (https://www.rfc-editor.org/rfc/rfc9110#name-comments).
//
// The header is case-insensitive. If the provided header exists when the
// middleware runs, the content will be inserted as-is enclosed in parentheses.
//
// Note that per the HTTP specification, comments are only allowed in fields
// containing "comment" as part of their field value definition, but this API
// will NOT verify whether the provided header is one of them.
//
// WithHeaderComment MAY be applied more than once to a middleware stack and/or
// more than once per header.
func WithHeaderComment(header, content string) func(*middleware.Stack) error {
	return func(s *middleware.Stack) error {
		m, err := getOrAddHeaderComment(s)
		if err != nil {
			return fmt.Errorf("get or add header comment: %v", err)
		}

		m.values.Add(header, content)
		return nil
	}
}

type headerCommentMiddleware struct {
	values http.Header // hijack case-insensitive access APIs
}

func (*headerCommentMiddleware) ID() string {
	return "headerComment"
}

func (m *headerCommentMiddleware) HandleBuild(ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler) (
	out middleware.BuildOutput, metadata middleware.Metadata, err error,
) {
	r, ok := in.Request.(*Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type %T", in.Request)
	}

	for h, contents := range m.values {
		for _, c := range contents {
			if existing := r.Header.Get(h); existing != "" {
				r.Header.Set(h, fmt.Sprintf("%s (%s)", existing, c))
			}
		}
	}

	return next.HandleBuild(ctx, in)
}

func getOrAddHeaderComment(s *middleware.Stack) (*headerCommentMiddleware, error) {
	id := (*headerCommentMiddleware)(nil).ID()
	m, ok := s.Build.Get(id)
	if !ok {
		m := &headerCommentMiddleware{values: http.Header{}}
		if err := s.Build.Add(m, middleware.After); err != nil {
			return nil, fmt.Errorf("add build: %v", err)
		}

		return m, nil
	}

	hc, ok := m.(*headerCommentMiddleware)
	if !ok {
		return nil, fmt.Errorf("existing middleware w/ id %s is not *headerCommentMiddleware", id)
	}

	return hc, nil
}
