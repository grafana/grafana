package query

import (
	"context"
	"fmt"
	"io/ioutil"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// AddAsGetRequestMiddleware adds a middleware to the Serialize stack after the
// operation serializer that will convert the query request body to a GET
// operation with the query message in the HTTP request querystring.
func AddAsGetRequestMiddleware(stack *middleware.Stack) error {
	return stack.Serialize.Insert(&asGetRequest{}, "OperationSerializer", middleware.After)
}

type asGetRequest struct{}

func (*asGetRequest) ID() string { return "Query:AsGetRequest" }

func (m *asGetRequest) HandleSerialize(
	ctx context.Context, input middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	req, ok := input.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("expect smithy HTTP Request, got %T", input.Request)
	}

	req.Method = "GET"

	// If the stream is not set, nothing else to do.
	stream := req.GetStream()
	if stream == nil {
		return next.HandleSerialize(ctx, input)
	}

	// Clear the stream since there will not be any body.
	req.Header.Del("Content-Type")
	req, err = req.SetStream(nil)
	if err != nil {
		return out, metadata, fmt.Errorf("unable update request body %w", err)
	}
	input.Request = req

	// Update request query with the body's query string value.
	delim := ""
	if len(req.URL.RawQuery) != 0 {
		delim = "&"
	}

	b, err := ioutil.ReadAll(stream)
	if err != nil {
		return out, metadata, fmt.Errorf("unable to get request body %w", err)
	}
	req.URL.RawQuery += delim + string(b)

	return next.HandleSerialize(ctx, input)
}
