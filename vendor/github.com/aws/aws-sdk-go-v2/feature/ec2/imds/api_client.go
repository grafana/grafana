package imds

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	internalconfig "github.com/aws/aws-sdk-go-v2/feature/ec2/imds/internal/config"
	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/logging"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// ServiceID provides the unique name of this API client
const ServiceID = "ec2imds"

// Client provides the API client for interacting with the Amazon EC2 Instance
// Metadata Service API.
type Client struct {
	options Options
}

// ClientEnableState provides an enumeration if the client is enabled,
// disabled, or default behavior.
type ClientEnableState = internalconfig.ClientEnableState

// Enumeration values for ClientEnableState
const (
	ClientDefaultEnableState ClientEnableState = internalconfig.ClientDefaultEnableState // default behavior
	ClientDisabled           ClientEnableState = internalconfig.ClientDisabled           // client disabled
	ClientEnabled            ClientEnableState = internalconfig.ClientEnabled            // client enabled
)

// EndpointModeState is an enum configuration variable describing the client endpoint mode.
// Not configurable directly, but used when using the NewFromConfig.
type EndpointModeState = internalconfig.EndpointModeState

// Enumeration values for EndpointModeState
const (
	EndpointModeStateUnset EndpointModeState = internalconfig.EndpointModeStateUnset
	EndpointModeStateIPv4  EndpointModeState = internalconfig.EndpointModeStateIPv4
	EndpointModeStateIPv6  EndpointModeState = internalconfig.EndpointModeStateIPv6
)

const (
	disableClientEnvVar = "AWS_EC2_METADATA_DISABLED"

	// Client endpoint options
	endpointEnvVar = "AWS_EC2_METADATA_SERVICE_ENDPOINT"

	defaultIPv4Endpoint = "http://169.254.169.254"
	defaultIPv6Endpoint = "http://[fd00:ec2::254]"
)

// New returns an initialized Client based on the functional options. Provide
// additional functional options to further configure the behavior of the client,
// such as changing the client's endpoint or adding custom middleware behavior.
func New(options Options, optFns ...func(*Options)) *Client {
	options = options.Copy()

	for _, fn := range optFns {
		fn(&options)
	}

	options.HTTPClient = resolveHTTPClient(options.HTTPClient)

	if options.Retryer == nil {
		options.Retryer = retry.NewStandard()
	}
	if !options.DisableDefaultMaxBackoff {
		options.Retryer = retry.AddWithMaxBackoffDelay(options.Retryer, 1*time.Second)
	}

	if options.ClientEnableState == ClientDefaultEnableState {
		if v := os.Getenv(disableClientEnvVar); strings.EqualFold(v, "true") {
			options.ClientEnableState = ClientDisabled
		}
	}

	if len(options.Endpoint) == 0 {
		if v := os.Getenv(endpointEnvVar); len(v) != 0 {
			options.Endpoint = v
		}
	}

	client := &Client{
		options: options,
	}

	if client.options.tokenProvider == nil && !client.options.disableAPIToken {
		client.options.tokenProvider = newTokenProvider(client, defaultTokenTTL)
	}

	return client
}

// NewFromConfig returns an initialized Client based the AWS SDK config, and
// functional options. Provide additional functional options to further
// configure the behavior of the client, such as changing the client's endpoint
// or adding custom middleware behavior.
func NewFromConfig(cfg aws.Config, optFns ...func(*Options)) *Client {
	opts := Options{
		APIOptions:    append([]func(*middleware.Stack) error{}, cfg.APIOptions...),
		HTTPClient:    cfg.HTTPClient,
		ClientLogMode: cfg.ClientLogMode,
		Logger:        cfg.Logger,
	}

	if cfg.Retryer != nil {
		opts.Retryer = cfg.Retryer()
	}

	resolveClientEnableState(cfg, &opts)
	resolveEndpointConfig(cfg, &opts)
	resolveEndpointModeConfig(cfg, &opts)
	resolveEnableFallback(cfg, &opts)

	return New(opts, optFns...)
}

// Options provides the fields for configuring the API client's behavior.
type Options struct {
	// Set of options to modify how an operation is invoked. These apply to all
	// operations invoked for this client. Use functional options on operation
	// call to modify this list for per operation behavior.
	APIOptions []func(*middleware.Stack) error

	// The endpoint the client will use to retrieve EC2 instance metadata.
	//
	// Specifies the EC2 Instance Metadata Service endpoint to use. If specified it overrides EndpointMode.
	//
	// If unset, and the environment variable AWS_EC2_METADATA_SERVICE_ENDPOINT
	// has a value the client will use the value of the environment variable as
	// the endpoint for operation calls.
	//
	//    AWS_EC2_METADATA_SERVICE_ENDPOINT=http://[::1]
	Endpoint string

	// The endpoint selection mode the client will use if no explicit endpoint is provided using the Endpoint field.
	//
	// Setting EndpointMode to EndpointModeStateIPv4 will configure the client to use the default EC2 IPv4 endpoint.
	// Setting EndpointMode to EndpointModeStateIPv6 will configure the client to use the default EC2 IPv6 endpoint.
	//
	// By default if EndpointMode is not set (EndpointModeStateUnset) than the default endpoint selection mode EndpointModeStateIPv4.
	EndpointMode EndpointModeState

	// The HTTP client to invoke API calls with. Defaults to client's default
	// HTTP implementation if nil.
	HTTPClient HTTPClient

	// Retryer guides how HTTP requests should be retried in case of recoverable
	// failures. When nil the API client will use a default retryer.
	Retryer aws.Retryer

	// Changes if the EC2 Instance Metadata client is enabled or not. Client
	// will default to enabled if not set to ClientDisabled. When the client is
	// disabled it will return an error for all operation calls.
	//
	// If ClientEnableState value is ClientDefaultEnableState (default value),
	// and the environment variable "AWS_EC2_METADATA_DISABLED" is set to
	// "true", the client will be disabled.
	//
	//    AWS_EC2_METADATA_DISABLED=true
	ClientEnableState ClientEnableState

	// Configures the events that will be sent to the configured logger.
	ClientLogMode aws.ClientLogMode

	// The logger writer interface to write logging messages to.
	Logger logging.Logger

	// Configure IMDSv1 fallback behavior. By default, the client will attempt
	// to fall back to IMDSv1 as needed for backwards compatibility. When set to [aws.FalseTernary]
	// the client will return any errors encountered from attempting to fetch a token
	// instead of silently using the insecure data flow of IMDSv1.
	//
	// See [configuring IMDS] for more information.
	//
	// [configuring IMDS]: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html
	EnableFallback aws.Ternary

	// By default, all IMDS client operations enforce a 5-second timeout. You
	// can disable that behavior with this setting.
	DisableDefaultTimeout bool

	// By default all IMDS client operations enforce a 1-second retry delay at maximum.
	// You can disable that behavior with this setting.
	DisableDefaultMaxBackoff bool

	// provides the caching of API tokens used for operation calls. If unset,
	// the API token will not be retrieved for the operation.
	tokenProvider *tokenProvider

	// option to disable the API token provider for testing.
	disableAPIToken bool
}

// HTTPClient provides the interface for a client making HTTP requests with the
// API.
type HTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

// Copy creates a copy of the API options.
func (o Options) Copy() Options {
	to := o
	to.APIOptions = append([]func(*middleware.Stack) error{}, o.APIOptions...)
	return to
}

// WithAPIOptions wraps the API middleware functions, as a functional option
// for the API Client Options. Use this helper to add additional functional
// options to the API client, or operation calls.
func WithAPIOptions(optFns ...func(*middleware.Stack) error) func(*Options) {
	return func(o *Options) {
		o.APIOptions = append(o.APIOptions, optFns...)
	}
}

func (c *Client) invokeOperation(
	ctx context.Context, opID string, params interface{}, optFns []func(*Options),
	stackFns ...func(*middleware.Stack, Options) error,
) (
	result interface{}, metadata middleware.Metadata, err error,
) {
	stack := middleware.NewStack(opID, smithyhttp.NewStackRequest)
	options := c.options.Copy()
	for _, fn := range optFns {
		fn(&options)
	}

	if options.ClientEnableState == ClientDisabled {
		return nil, metadata, &smithy.OperationError{
			ServiceID:     ServiceID,
			OperationName: opID,
			Err: fmt.Errorf(
				"access disabled to EC2 IMDS via client option, or %q environment variable",
				disableClientEnvVar),
		}
	}

	for _, fn := range stackFns {
		if err := fn(stack, options); err != nil {
			return nil, metadata, err
		}
	}

	for _, fn := range options.APIOptions {
		if err := fn(stack); err != nil {
			return nil, metadata, err
		}
	}

	handler := middleware.DecorateHandler(smithyhttp.NewClientHandler(options.HTTPClient), stack)
	result, metadata, err = handler.Handle(ctx, params)
	if err != nil {
		return nil, metadata, &smithy.OperationError{
			ServiceID:     ServiceID,
			OperationName: opID,
			Err:           err,
		}
	}

	return result, metadata, err
}

const (
	// HTTP client constants
	defaultDialerTimeout         = 250 * time.Millisecond
	defaultResponseHeaderTimeout = 500 * time.Millisecond
)

func resolveHTTPClient(client HTTPClient) HTTPClient {
	if client == nil {
		client = awshttp.NewBuildableClient()
	}

	if c, ok := client.(*awshttp.BuildableClient); ok {
		client = c.
			WithDialerOptions(func(d *net.Dialer) {
				// Use a custom Dial timeout for the EC2 Metadata service to account
				// for the possibility the application might not be running in an
				// environment with the service present. The client should fail fast in
				// this case.
				d.Timeout = defaultDialerTimeout
			}).
			WithTransportOptions(func(tr *http.Transport) {
				// Use a custom Transport timeout for the EC2 Metadata service to
				// account for the possibility that the application might be running in
				// a container, and EC2Metadata service drops the connection after a
				// single IP Hop. The client should fail fast in this case.
				tr.ResponseHeaderTimeout = defaultResponseHeaderTimeout
			})
	}

	return client
}

func resolveClientEnableState(cfg aws.Config, options *Options) error {
	if options.ClientEnableState != ClientDefaultEnableState {
		return nil
	}
	value, found, err := internalconfig.ResolveClientEnableState(cfg.ConfigSources)
	if err != nil || !found {
		return err
	}
	options.ClientEnableState = value
	return nil
}

func resolveEndpointModeConfig(cfg aws.Config, options *Options) error {
	if options.EndpointMode != EndpointModeStateUnset {
		return nil
	}
	value, found, err := internalconfig.ResolveEndpointModeConfig(cfg.ConfigSources)
	if err != nil || !found {
		return err
	}
	options.EndpointMode = value
	return nil
}

func resolveEndpointConfig(cfg aws.Config, options *Options) error {
	if len(options.Endpoint) != 0 {
		return nil
	}
	value, found, err := internalconfig.ResolveEndpointConfig(cfg.ConfigSources)
	if err != nil || !found {
		return err
	}
	options.Endpoint = value
	return nil
}

func resolveEnableFallback(cfg aws.Config, options *Options) {
	if options.EnableFallback != aws.UnknownTernary {
		return
	}

	disabled, ok := internalconfig.ResolveV1FallbackDisabled(cfg.ConfigSources)
	if !ok {
		return
	}

	if disabled {
		options.EnableFallback = aws.FalseTernary
	} else {
		options.EnableFallback = aws.TrueTernary
	}
}
