package imds

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"net/url"
	"path"
	"time"

	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

func addAPIRequestMiddleware(stack *middleware.Stack,
	options Options,
	operation string,
	getPath func(interface{}) (string, error),
	getOutput func(*smithyhttp.Response) (interface{}, error),
) (err error) {
	err = addRequestMiddleware(stack, options, "GET", operation, getPath, getOutput)
	if err != nil {
		return err
	}

	// Token Serializer build and state management.
	if !options.disableAPIToken {
		err = stack.Finalize.Insert(options.tokenProvider, (*retry.Attempt)(nil).ID(), middleware.After)
		if err != nil {
			return err
		}

		err = stack.Deserialize.Insert(options.tokenProvider, "OperationDeserializer", middleware.Before)
		if err != nil {
			return err
		}
	}

	return nil
}

func addRequestMiddleware(stack *middleware.Stack,
	options Options,
	method string,
	operation string,
	getPath func(interface{}) (string, error),
	getOutput func(*smithyhttp.Response) (interface{}, error),
) (err error) {
	err = awsmiddleware.AddSDKAgentKey(awsmiddleware.FeatureMetadata, "ec2-imds")(stack)
	if err != nil {
		return err
	}

	// Operation timeout
	err = stack.Initialize.Add(&operationTimeout{
		Disabled:       options.DisableDefaultTimeout,
		DefaultTimeout: defaultOperationTimeout,
	}, middleware.Before)
	if err != nil {
		return err
	}

	// Operation Serializer
	err = stack.Serialize.Add(&serializeRequest{
		GetPath: getPath,
		Method:  method,
	}, middleware.After)
	if err != nil {
		return err
	}

	// Operation endpoint resolver
	err = stack.Serialize.Insert(&resolveEndpoint{
		Endpoint:     options.Endpoint,
		EndpointMode: options.EndpointMode,
	}, "OperationSerializer", middleware.Before)
	if err != nil {
		return err
	}

	// Operation Deserializer
	err = stack.Deserialize.Add(&deserializeResponse{
		GetOutput: getOutput,
	}, middleware.After)
	if err != nil {
		return err
	}

	err = stack.Deserialize.Add(&smithyhttp.RequestResponseLogger{
		LogRequest:          options.ClientLogMode.IsRequest(),
		LogRequestWithBody:  options.ClientLogMode.IsRequestWithBody(),
		LogResponse:         options.ClientLogMode.IsResponse(),
		LogResponseWithBody: options.ClientLogMode.IsResponseWithBody(),
	}, middleware.After)
	if err != nil {
		return err
	}

	err = addSetLoggerMiddleware(stack, options)
	if err != nil {
		return err
	}

	if err := addProtocolFinalizerMiddlewares(stack, options, operation); err != nil {
		return fmt.Errorf("add protocol finalizers: %w", err)
	}

	// Retry support
	return retry.AddRetryMiddlewares(stack, retry.AddRetryMiddlewaresOptions{
		Retryer:          options.Retryer,
		LogRetryAttempts: options.ClientLogMode.IsRetries(),
	})
}

func addSetLoggerMiddleware(stack *middleware.Stack, o Options) error {
	return middleware.AddSetLoggerMiddleware(stack, o.Logger)
}

type serializeRequest struct {
	GetPath func(interface{}) (string, error)
	Method  string
}

func (*serializeRequest) ID() string {
	return "OperationSerializer"
}

func (m *serializeRequest) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	request, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type %T", in.Request)
	}

	reqPath, err := m.GetPath(in.Parameters)
	if err != nil {
		return out, metadata, fmt.Errorf("unable to get request URL path, %w", err)
	}

	request.Request.URL.Path = reqPath
	request.Request.Method = m.Method

	return next.HandleSerialize(ctx, in)
}

type deserializeResponse struct {
	GetOutput func(*smithyhttp.Response) (interface{}, error)
}

func (*deserializeResponse) ID() string {
	return "OperationDeserializer"
}

func (m *deserializeResponse) HandleDeserialize(
	ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler,
) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	out, metadata, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		return out, metadata, err
	}

	resp, ok := out.RawResponse.(*smithyhttp.Response)
	if !ok {
		return out, metadata, fmt.Errorf(
			"unexpected transport response type, %T, want %T", out.RawResponse, resp)
	}
	defer resp.Body.Close()

	// read the full body so that any operation timeouts cleanup will not race
	// the body being read.
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return out, metadata, fmt.Errorf("read response body failed, %w", err)
	}
	resp.Body = ioutil.NopCloser(bytes.NewReader(body))

	// Anything that's not 200 |< 300 is error
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return out, metadata, &smithyhttp.ResponseError{
			Response: resp,
			Err:      fmt.Errorf("request to EC2 IMDS failed"),
		}
	}

	result, err := m.GetOutput(resp)
	if err != nil {
		return out, metadata, fmt.Errorf(
			"unable to get deserialized result for response, %w", err,
		)
	}
	out.Result = result

	return out, metadata, err
}

type resolveEndpoint struct {
	Endpoint     string
	EndpointMode EndpointModeState
}

func (*resolveEndpoint) ID() string {
	return "ResolveEndpoint"
}

func (m *resolveEndpoint) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {

	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type %T", in.Request)
	}

	var endpoint string
	if len(m.Endpoint) > 0 {
		endpoint = m.Endpoint
	} else {
		switch m.EndpointMode {
		case EndpointModeStateIPv6:
			endpoint = defaultIPv6Endpoint
		case EndpointModeStateIPv4:
			fallthrough
		case EndpointModeStateUnset:
			endpoint = defaultIPv4Endpoint
		default:
			return out, metadata, fmt.Errorf("unsupported IMDS endpoint mode")
		}
	}

	req.URL, err = url.Parse(endpoint)
	if err != nil {
		return out, metadata, fmt.Errorf("failed to parse endpoint URL: %w", err)
	}

	return next.HandleSerialize(ctx, in)
}

const (
	defaultOperationTimeout = 5 * time.Second
)

// operationTimeout adds a timeout on the middleware stack if the Context the
// stack was called with does not have a deadline. The next middleware must
// complete before the timeout, or the context will be canceled.
//
// If DefaultTimeout is zero, no default timeout will be used if the Context
// does not have a timeout.
//
// The next middleware must also ensure that any resources that are also
// canceled by the stack's context are completely consumed before returning.
// Otherwise the timeout cleanup will race the resource being consumed
// upstream.
type operationTimeout struct {
	Disabled       bool
	DefaultTimeout time.Duration
}

func (*operationTimeout) ID() string { return "OperationTimeout" }

func (m *operationTimeout) HandleInitialize(
	ctx context.Context, input middleware.InitializeInput, next middleware.InitializeHandler,
) (
	output middleware.InitializeOutput, metadata middleware.Metadata, err error,
) {
	if m.Disabled {
		return next.HandleInitialize(ctx, input)
	}

	if _, ok := ctx.Deadline(); !ok && m.DefaultTimeout != 0 {
		var cancelFn func()
		ctx, cancelFn = context.WithTimeout(ctx, m.DefaultTimeout)
		defer cancelFn()
	}

	return next.HandleInitialize(ctx, input)
}

// appendURIPath joins a URI path component to the existing path with `/`
// separators between the path components. If the path being added ends with a
// trailing `/` that slash will be maintained.
func appendURIPath(base, add string) string {
	reqPath := path.Join(base, add)
	if len(add) != 0 && add[len(add)-1] == '/' {
		reqPath += "/"
	}
	return reqPath
}

func addProtocolFinalizerMiddlewares(stack *middleware.Stack, options Options, operation string) error {
	if err := stack.Finalize.Add(&resolveAuthSchemeMiddleware{operation: operation, options: options}, middleware.Before); err != nil {
		return fmt.Errorf("add ResolveAuthScheme: %w", err)
	}
	if err := stack.Finalize.Insert(&getIdentityMiddleware{options: options}, "ResolveAuthScheme", middleware.After); err != nil {
		return fmt.Errorf("add GetIdentity: %w", err)
	}
	if err := stack.Finalize.Insert(&resolveEndpointV2Middleware{options: options}, "GetIdentity", middleware.After); err != nil {
		return fmt.Errorf("add ResolveEndpointV2: %w", err)
	}
	if err := stack.Finalize.Insert(&signRequestMiddleware{}, "ResolveEndpointV2", middleware.After); err != nil {
		return fmt.Errorf("add Signing: %w", err)
	}
	return nil
}
