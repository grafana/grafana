// Package endpointcreds provides support for retrieving credentials from an
// arbitrary HTTP endpoint.
//
// The credentials endpoint Provider can receive both static and refreshable
// credentials that will expire. Credentials are static when an "Expiration"
// value is not provided in the endpoint's response.
//
// Static credentials will never expire once they have been retrieved. The format
// of the static credentials response:
//
//	{
//	    "AccessKeyId" : "MUA...",
//	    "SecretAccessKey" : "/7PC5om....",
//	}
//
// Refreshable credentials will expire within the "ExpiryWindow" of the Expiration
// value in the response. The format of the refreshable credentials response:
//
//	{
//	    "AccessKeyId" : "MUA...",
//	    "SecretAccessKey" : "/7PC5om....",
//	    "Token" : "AQoDY....=",
//	    "Expiration" : "2016-02-25T06:03:31Z"
//	}
//
// Errors should be returned in the following format and only returned with 400
// or 500 HTTP status codes.
//
//	{
//	    "code": "ErrorCode",
//	    "message": "Helpful error message."
//	}
package endpointcreds

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials/endpointcreds/internal/client"
	"github.com/aws/smithy-go/middleware"
)

// ProviderName is the name of the credentials provider.
const ProviderName = `CredentialsEndpointProvider`

type getCredentialsAPIClient interface {
	GetCredentials(context.Context, *client.GetCredentialsInput, ...func(*client.Options)) (*client.GetCredentialsOutput, error)
}

// Provider satisfies the aws.CredentialsProvider interface, and is a client to
// retrieve credentials from an arbitrary endpoint.
type Provider struct {
	// The AWS Client to make HTTP requests to the endpoint with. The endpoint
	// the request will be made to is provided by the aws.Config's
	// EndpointResolver.
	client getCredentialsAPIClient

	options Options
}

// HTTPClient is a client for sending HTTP requests
type HTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

// Options is structure of configurable options for Provider
type Options struct {
	// Endpoint to retrieve credentials from. Required
	Endpoint string

	// HTTPClient to handle sending HTTP requests to the target endpoint.
	HTTPClient HTTPClient

	// Set of options to modify how the credentials operation is invoked.
	APIOptions []func(*middleware.Stack) error

	// The Retryer to be used for determining whether a failed requested should be retried
	Retryer aws.Retryer

	// Optional authorization token value if set will be used as the value of
	// the Authorization header of the endpoint credential request.
	//
	// When constructed from environment, the provider will use the value of
	// AWS_CONTAINER_AUTHORIZATION_TOKEN environment variable as the token
	//
	// Will be overridden if AuthorizationTokenProvider is configured
	AuthorizationToken string

	// Optional auth provider func to dynamically load the auth token from a file
	// everytime a credential is retrieved
	//
	// When constructed from environment, the provider will read and use the content
	// of the file pointed to by AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE environment variable
	// as the auth token everytime credentials are retrieved
	//
	// Will override AuthorizationToken if configured
	AuthorizationTokenProvider AuthTokenProvider

	// The chain of providers that was used to create this provider
	// These values are for reporting purposes and are not meant to be set up directly
	CredentialSources []aws.CredentialSource
}

// AuthTokenProvider defines an interface to dynamically load a value to be passed
// for the Authorization header of a credentials request.
type AuthTokenProvider interface {
	GetToken() (string, error)
}

// TokenProviderFunc is a func type implementing AuthTokenProvider interface
// and enables customizing token provider behavior
type TokenProviderFunc func() (string, error)

// GetToken func retrieves auth token according to TokenProviderFunc implementation
func (p TokenProviderFunc) GetToken() (string, error) {
	return p()
}

// New returns a credentials Provider for retrieving AWS credentials
// from arbitrary endpoint.
func New(endpoint string, optFns ...func(*Options)) *Provider {
	o := Options{
		Endpoint: endpoint,
	}

	for _, fn := range optFns {
		fn(&o)
	}

	p := &Provider{
		client: client.New(client.Options{
			HTTPClient: o.HTTPClient,
			Endpoint:   o.Endpoint,
			APIOptions: o.APIOptions,
			Retryer:    o.Retryer,
		}),
		options: o,
	}

	return p
}

// Retrieve will attempt to request the credentials from the endpoint the Provider
// was configured for. And error will be returned if the retrieval fails.
func (p *Provider) Retrieve(ctx context.Context) (aws.Credentials, error) {
	resp, err := p.getCredentials(ctx)
	if err != nil {
		return aws.Credentials{}, fmt.Errorf("failed to load credentials, %w", err)
	}

	creds := aws.Credentials{
		AccessKeyID:     resp.AccessKeyID,
		SecretAccessKey: resp.SecretAccessKey,
		SessionToken:    resp.Token,
		Source:          ProviderName,
		AccountID:       resp.AccountID,
	}

	if resp.Expiration != nil {
		creds.CanExpire = true
		creds.Expires = *resp.Expiration
	}

	return creds, nil
}

func (p *Provider) getCredentials(ctx context.Context) (*client.GetCredentialsOutput, error) {
	authToken, err := p.resolveAuthToken()
	if err != nil {
		return nil, fmt.Errorf("resolve auth token: %v", err)
	}

	return p.client.GetCredentials(ctx, &client.GetCredentialsInput{
		AuthorizationToken: authToken,
	})
}

func (p *Provider) resolveAuthToken() (string, error) {
	authToken := p.options.AuthorizationToken

	var err error
	if p.options.AuthorizationTokenProvider != nil {
		authToken, err = p.options.AuthorizationTokenProvider.GetToken()
		if err != nil {
			return "", err
		}
	}

	if strings.ContainsAny(authToken, "\r\n") {
		return "", fmt.Errorf("authorization token contains invalid newline sequence")
	}

	return authToken, nil
}

var _ aws.CredentialProviderSource = (*Provider)(nil)

// ProviderSources returns the credential chain that was used to construct this provider
func (p *Provider) ProviderSources() []aws.CredentialSource {
	if p.options.CredentialSources == nil {
		return []aws.CredentialSource{aws.CredentialSourceHTTP}
	}
	return p.options.CredentialSources
}
