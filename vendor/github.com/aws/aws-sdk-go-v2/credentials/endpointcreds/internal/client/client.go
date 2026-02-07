package client

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/smithy-go"
	smithymiddleware "github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// ServiceID is the client identifer
const ServiceID = "endpoint-credentials"

// HTTPClient is a client for sending HTTP requests
type HTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

// Options is the endpoint client configurable options
type Options struct {
	// The endpoint to retrieve credentials from
	Endpoint string

	// The HTTP client to invoke API calls with. Defaults to client's default HTTP
	// implementation if nil.
	HTTPClient HTTPClient

	// Retryer guides how HTTP requests should be retried in case of recoverable
	// failures. When nil the API client will use a default retryer.
	Retryer aws.Retryer

	// Set of options to modify how the credentials operation is invoked.
	APIOptions []func(*smithymiddleware.Stack) error
}

// Copy creates a copy of the API options.
func (o Options) Copy() Options {
	to := o
	to.APIOptions = make([]func(*smithymiddleware.Stack) error, len(o.APIOptions))
	copy(to.APIOptions, o.APIOptions)
	return to
}

// Client is an client for retrieving AWS credentials from an endpoint
type Client struct {
	options Options
}

// New constructs a new Client from the given options
func New(options Options, optFns ...func(*Options)) *Client {
	options = options.Copy()

	if options.HTTPClient == nil {
		options.HTTPClient = awshttp.NewBuildableClient()
	}

	if options.Retryer == nil {
		// Amazon-owned implementations of this endpoint are known to sometimes
		// return plaintext responses (i.e. no Code) like normal, add a few
		// additional status codes
		options.Retryer = retry.NewStandard(func(o *retry.StandardOptions) {
			o.Retryables = append(o.Retryables, retry.RetryableHTTPStatusCode{
				Codes: map[int]struct{}{
					http.StatusTooManyRequests: {},
				},
			})
		})
	}

	for _, fn := range optFns {
		fn(&options)
	}

	client := &Client{
		options: options,
	}

	return client
}

// GetCredentialsInput is the input to send with the endpoint service to receive credentials.
type GetCredentialsInput struct {
	AuthorizationToken string
}

// GetCredentials retrieves credentials from credential endpoint
func (c *Client) GetCredentials(ctx context.Context, params *GetCredentialsInput, optFns ...func(*Options)) (*GetCredentialsOutput, error) {
	stack := smithymiddleware.NewStack("GetCredentials", smithyhttp.NewStackRequest)
	options := c.options.Copy()
	for _, fn := range optFns {
		fn(&options)
	}

	stack.Serialize.Add(&serializeOpGetCredential{}, smithymiddleware.After)
	stack.Build.Add(&buildEndpoint{Endpoint: options.Endpoint}, smithymiddleware.After)
	stack.Deserialize.Add(&deserializeOpGetCredential{}, smithymiddleware.After)
	addProtocolFinalizerMiddlewares(stack, options, "GetCredentials")
	retry.AddRetryMiddlewares(stack, retry.AddRetryMiddlewaresOptions{Retryer: options.Retryer})
	middleware.AddSDKAgentKey(middleware.FeatureMetadata, ServiceID)
	smithyhttp.AddErrorCloseResponseBodyMiddleware(stack)
	smithyhttp.AddCloseResponseBodyMiddleware(stack)

	for _, fn := range options.APIOptions {
		if err := fn(stack); err != nil {
			return nil, err
		}
	}

	handler := smithymiddleware.DecorateHandler(smithyhttp.NewClientHandler(options.HTTPClient), stack)
	result, _, err := handler.Handle(ctx, params)
	if err != nil {
		return nil, err
	}

	return result.(*GetCredentialsOutput), err
}

// GetCredentialsOutput is the response from the credential endpoint
type GetCredentialsOutput struct {
	Expiration      *time.Time
	AccessKeyID     string
	SecretAccessKey string
	Token           string
	AccountID       string
}

// EndpointError is an error returned from the endpoint service
type EndpointError struct {
	Code       string            `json:"code"`
	Message    string            `json:"message"`
	Fault      smithy.ErrorFault `json:"-"`
	statusCode int               `json:"-"`
}

// Error is the error mesage string
func (e *EndpointError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// ErrorCode is the error code returned by the endpoint
func (e *EndpointError) ErrorCode() string {
	return e.Code
}

// ErrorMessage is the error message returned by the endpoint
func (e *EndpointError) ErrorMessage() string {
	return e.Message
}

// ErrorFault indicates error fault classification
func (e *EndpointError) ErrorFault() smithy.ErrorFault {
	return e.Fault
}

// HTTPStatusCode implements retry.HTTPStatusCode.
func (e *EndpointError) HTTPStatusCode() int {
	return e.statusCode
}
