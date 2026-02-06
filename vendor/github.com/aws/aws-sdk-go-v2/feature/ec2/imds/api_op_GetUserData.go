package imds

import (
	"context"
	"io"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

const getUserDataPath = "/latest/user-data"

// GetUserData uses the path provided to request information from the EC2
// instance metadata service for dynamic data. The content will be returned
// as a string, or error if the request failed.
func (c *Client) GetUserData(ctx context.Context, params *GetUserDataInput, optFns ...func(*Options)) (*GetUserDataOutput, error) {
	if params == nil {
		params = &GetUserDataInput{}
	}

	result, metadata, err := c.invokeOperation(ctx, "GetUserData", params, optFns,
		addGetUserDataMiddleware,
	)
	if err != nil {
		return nil, err
	}

	out := result.(*GetUserDataOutput)
	out.ResultMetadata = metadata
	return out, nil
}

// GetUserDataInput provides the input parameters for the GetUserData
// operation.
type GetUserDataInput struct{}

// GetUserDataOutput provides the output parameters for the GetUserData
// operation.
type GetUserDataOutput struct {
	Content io.ReadCloser

	ResultMetadata middleware.Metadata
}

func addGetUserDataMiddleware(stack *middleware.Stack, options Options) error {
	return addAPIRequestMiddleware(stack,
		options,
		"GetUserData",
		buildGetUserDataPath,
		buildGetUserDataOutput)
}

func buildGetUserDataPath(params interface{}) (string, error) {
	return getUserDataPath, nil
}

func buildGetUserDataOutput(resp *smithyhttp.Response) (interface{}, error) {
	return &GetUserDataOutput{
		Content: resp.Body,
	}, nil
}
