package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/url"

	"github.com/aws/smithy-go"
	smithymiddleware "github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

type buildEndpoint struct {
	Endpoint string
}

func (b *buildEndpoint) ID() string {
	return "BuildEndpoint"
}

func (b *buildEndpoint) HandleBuild(ctx context.Context, in smithymiddleware.BuildInput, next smithymiddleware.BuildHandler) (
	out smithymiddleware.BuildOutput, metadata smithymiddleware.Metadata, err error,
) {
	request, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport, %T", in.Request)
	}

	if len(b.Endpoint) == 0 {
		return out, metadata, fmt.Errorf("endpoint not provided")
	}

	parsed, err := url.Parse(b.Endpoint)
	if err != nil {
		return out, metadata, fmt.Errorf("failed to parse endpoint, %w", err)
	}

	request.URL = parsed

	return next.HandleBuild(ctx, in)
}

type serializeOpGetCredential struct{}

func (s *serializeOpGetCredential) ID() string {
	return "OperationSerializer"
}

func (s *serializeOpGetCredential) HandleSerialize(ctx context.Context, in smithymiddleware.SerializeInput, next smithymiddleware.SerializeHandler) (
	out smithymiddleware.SerializeOutput, metadata smithymiddleware.Metadata, err error,
) {
	request, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type, %T", in.Request)
	}

	params, ok := in.Parameters.(*GetCredentialsInput)
	if !ok {
		return out, metadata, fmt.Errorf("unknown input parameters, %T", in.Parameters)
	}

	const acceptHeader = "Accept"
	request.Header[acceptHeader] = append(request.Header[acceptHeader][:0], "application/json")

	if len(params.AuthorizationToken) > 0 {
		const authHeader = "Authorization"
		request.Header[authHeader] = append(request.Header[authHeader][:0], params.AuthorizationToken)
	}

	return next.HandleSerialize(ctx, in)
}

type deserializeOpGetCredential struct{}

func (d *deserializeOpGetCredential) ID() string {
	return "OperationDeserializer"
}

func (d *deserializeOpGetCredential) HandleDeserialize(ctx context.Context, in smithymiddleware.DeserializeInput, next smithymiddleware.DeserializeHandler) (
	out smithymiddleware.DeserializeOutput, metadata smithymiddleware.Metadata, err error,
) {
	out, metadata, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		return out, metadata, err
	}

	response, ok := out.RawResponse.(*smithyhttp.Response)
	if !ok {
		return out, metadata, &smithy.DeserializationError{Err: fmt.Errorf("unknown transport type %T", out.RawResponse)}
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return out, metadata, deserializeError(response)
	}

	var shape *GetCredentialsOutput
	if err = json.NewDecoder(response.Body).Decode(&shape); err != nil {
		return out, metadata, &smithy.DeserializationError{Err: fmt.Errorf("failed to deserialize json response, %w", err)}
	}

	out.Result = shape
	return out, metadata, err
}

func deserializeError(response *smithyhttp.Response) error {
	// we could be talking to anything, json isn't guaranteed
	// see https://github.com/aws/aws-sdk-go-v2/issues/2316
	if response.Header.Get("Content-Type") == "application/json" {
		return deserializeJSONError(response)
	}

	msg, err := io.ReadAll(response.Body)
	if err != nil {
		return &smithy.DeserializationError{
			Err: fmt.Errorf("read response, %w", err),
		}
	}

	return &EndpointError{
		// no sensible value for Code
		Message:    string(msg),
		Fault:      stof(response.StatusCode),
		statusCode: response.StatusCode,
	}
}

func deserializeJSONError(response *smithyhttp.Response) error {
	var errShape *EndpointError
	if err := json.NewDecoder(response.Body).Decode(&errShape); err != nil {
		return &smithy.DeserializationError{
			Err: fmt.Errorf("failed to decode error message, %w", err),
		}
	}

	errShape.Fault = stof(response.StatusCode)
	errShape.statusCode = response.StatusCode
	return errShape
}

// maps HTTP status code to smithy ErrorFault
func stof(code int) smithy.ErrorFault {
	if code >= 500 {
		return smithy.FaultServer
	}
	return smithy.FaultClient
}

func addProtocolFinalizerMiddlewares(stack *smithymiddleware.Stack, options Options, operation string) error {
	if err := stack.Finalize.Add(&resolveAuthSchemeMiddleware{operation: operation, options: options}, smithymiddleware.Before); err != nil {
		return fmt.Errorf("add ResolveAuthScheme: %w", err)
	}
	if err := stack.Finalize.Insert(&getIdentityMiddleware{options: options}, "ResolveAuthScheme", smithymiddleware.After); err != nil {
		return fmt.Errorf("add GetIdentity: %w", err)
	}
	if err := stack.Finalize.Insert(&resolveEndpointV2Middleware{options: options}, "GetIdentity", smithymiddleware.After); err != nil {
		return fmt.Errorf("add ResolveEndpointV2: %w", err)
	}
	if err := stack.Finalize.Insert(&signRequestMiddleware{}, "ResolveEndpointV2", smithymiddleware.After); err != nil {
		return fmt.Errorf("add Signing: %w", err)
	}
	return nil
}
