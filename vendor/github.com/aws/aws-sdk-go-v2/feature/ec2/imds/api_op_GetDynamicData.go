package imds

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

const getDynamicDataPath = "/latest/dynamic"

// GetDynamicData uses the path provided to request information from the EC2
// instance metadata service for dynamic data. The content will be returned
// as a string, or error if the request failed.
func (c *Client) GetDynamicData(ctx context.Context, params *GetDynamicDataInput, optFns ...func(*Options)) (*GetDynamicDataOutput, error) {
	if params == nil {
		params = &GetDynamicDataInput{}
	}

	result, metadata, err := c.invokeOperation(ctx, "GetDynamicData", params, optFns,
		addGetDynamicDataMiddleware,
	)
	if err != nil {
		return nil, err
	}

	out := result.(*GetDynamicDataOutput)
	out.ResultMetadata = metadata
	return out, nil
}

// GetDynamicDataInput provides the input parameters for the GetDynamicData
// operation.
type GetDynamicDataInput struct {
	// The relative dynamic data path to retrieve. Can be empty string to
	// retrieve a response containing a new line separated list of dynamic data
	// resources available.
	//
	// Must not include the dynamic data base path.
	//
	// May include leading slash. If Path includes trailing slash the trailing
	// slash will be included in the request for the resource.
	Path string
}

// GetDynamicDataOutput provides the output parameters for the GetDynamicData
// operation.
type GetDynamicDataOutput struct {
	Content io.ReadCloser

	ResultMetadata middleware.Metadata
}

func addGetDynamicDataMiddleware(stack *middleware.Stack, options Options) error {
	return addAPIRequestMiddleware(stack,
		options,
		"GetDynamicData",
		buildGetDynamicDataPath,
		buildGetDynamicDataOutput)
}

func buildGetDynamicDataPath(params interface{}) (string, error) {
	p, ok := params.(*GetDynamicDataInput)
	if !ok {
		return "", fmt.Errorf("unknown parameter type %T", params)
	}

	return appendURIPath(getDynamicDataPath, p.Path), nil
}

func buildGetDynamicDataOutput(resp *smithyhttp.Response) (interface{}, error) {
	return &GetDynamicDataOutput{
		Content: resp.Body,
	}, nil
}
