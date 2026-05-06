package customizations

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"io/ioutil"
	"strings"

	"github.com/aws/smithy-go"
	smithyxml "github.com/aws/smithy-go/encoding/xml"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// HandleResponseErrorWith200Status check for S3 200 error response.
// If an s3 200 error is found, status code for the response is modified temporarily to
// 5xx response status code.
func HandleResponseErrorWith200Status(stack *middleware.Stack) error {
	return stack.Deserialize.Insert(&processResponseFor200ErrorMiddleware{}, "OperationDeserializer", middleware.After)
}

// middleware to process raw response and look for error response with 200 status code
type processResponseFor200ErrorMiddleware struct{}

// ID returns the middleware ID.
func (*processResponseFor200ErrorMiddleware) ID() string {
	return "S3:ProcessResponseFor200Error"
}

func (m *processResponseFor200ErrorMiddleware) HandleDeserialize(
	ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	out, metadata, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		return out, metadata, err
	}

	response, ok := out.RawResponse.(*smithyhttp.Response)
	if !ok {
		return out, metadata, &smithy.DeserializationError{Err: fmt.Errorf("unknown transport type %T", out.RawResponse)}
	}

	// check if response status code is 2xx.
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return
	}

	var readBuff bytes.Buffer
	body := io.TeeReader(response.Body, &readBuff)

	rootDecoder := xml.NewDecoder(body)
	t, err := smithyxml.FetchRootElement(rootDecoder)
	if err == io.EOF {
		return out, metadata, &smithy.DeserializationError{
			Err: fmt.Errorf("received empty response payload"),
		}
	}

	// rewind response body
	response.Body = ioutil.NopCloser(io.MultiReader(&readBuff, response.Body))

	// if start tag is "Error", the response is consider error response.
	if strings.EqualFold(t.Name.Local, "Error") {
		// according to https://aws.amazon.com/premiumsupport/knowledge-center/s3-resolve-200-internalerror/
		// 200 error responses are similar to 5xx errors.
		response.StatusCode = 500
	}

	return out, metadata, err
}
