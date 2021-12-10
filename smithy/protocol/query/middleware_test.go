package query

import (
	"bytes"
	"context"
	"testing"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

func TestAsGetRequestMiddleware(t *testing.T) {
	cases := map[string]struct {
		Request *smithyhttp.Request
		Expect  *smithyhttp.Request
	}{
		"post": {
			Request: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "POST"
				req, _ = req.SetStream(bytes.NewReader([]byte("some=field")))

				return req
			}(),
			Expect: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "GET"
				req.URL.RawQuery = "some=field"

				return req
			}(),
		},
		"get": {
			Request: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "GET"
				req.URL.RawQuery = "existing=query"

				return req
			}(),
			Expect: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "GET"
				req.URL.RawQuery = "existing=query"

				return req
			}(),
		},

		"get with stream": {
			Request: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "GET"
				req.URL.RawQuery = "existing=query"
				req, _ = req.SetStream(bytes.NewReader([]byte("some=field")))

				return req
			}(),
			Expect: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "GET"
				req.URL.RawQuery = "existing=query&some=field"

				return req
			}(),
		},

		"with query": {
			Request: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "POST"
				req.URL.RawQuery = "existing=query"
				req, _ = req.SetStream(bytes.NewReader([]byte("some=field")))

				return req
			}(),
			Expect: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "GET"
				req.URL.RawQuery = "existing=query&some=field"

				return req
			}(),
		},

		"no body": {
			Request: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "POST"

				return req
			}(),
			Expect: func() *smithyhttp.Request {
				req := smithyhttp.NewStackRequest().(*smithyhttp.Request)
				req.Method = "GET"

				return req
			}(),
		},
	}

	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			m := &asGetRequest{}

			_, _, err := m.HandleSerialize(context.Background(), middleware.SerializeInput{
				Parameters: struct{}{},
				Request:    c.Request,
			}, middleware.SerializeHandlerFunc(func(
				ctx context.Context, input middleware.SerializeInput,
			) (
				out middleware.SerializeOutput, metadata middleware.Metadata, err error,
			) {
				req, ok := input.Request.(*smithyhttp.Request)
				if !ok {
					t.Fatalf("expect smithy HTTP request, got %T", input.Request)
				}

				if e, a := c.Expect.URL.RawQuery, req.URL.RawQuery; e != a {
					t.Errorf("expect %s query, got %s", e, a)
				}

				if v := req.GetStream(); v != nil {
					t.Errorf("expect no request body, got %v", v)
				}

				return out, metadata, err
			}))
			if err != nil {
				t.Fatalf("expect no error, got %v", err)
			}
		})
	}
}
