//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package policy

import (
	"context"
	"net/http"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/cloud"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/tracing"
)

// Policy represents an extensibility point for the Pipeline that can mutate the specified
// Request and react to the received Response.
type Policy = exported.Policy

// Transporter represents an HTTP pipeline transport used to send HTTP requests and receive responses.
type Transporter = exported.Transporter

// Request is an abstraction over the creation of an HTTP request as it passes through the pipeline.
// Don't use this type directly, use runtime.NewRequest() instead.
type Request = exported.Request

// ClientOptions contains optional settings for a client's pipeline.
// Instances can be shared across calls to SDK client constructors when uniform configuration is desired.
// Zero-value fields will have their specified default values applied during use.
type ClientOptions struct {
	// APIVersion overrides the default version requested of the service.
	// Set with caution as this package version has not been tested with arbitrary service versions.
	APIVersion string

	// Cloud specifies a cloud for the client. The default is Azure Public Cloud.
	Cloud cloud.Configuration

	// InsecureAllowCredentialWithHTTP enables authenticated requests over HTTP.
	// By default, authenticated requests to an HTTP endpoint are rejected by the client.
	// WARNING: setting this to true will allow sending the credential in clear text. Use with caution.
	InsecureAllowCredentialWithHTTP bool

	// Logging configures the built-in logging policy.
	Logging LogOptions

	// Retry configures the built-in retry policy.
	Retry RetryOptions

	// Telemetry configures the built-in telemetry policy.
	Telemetry TelemetryOptions

	// TracingProvider configures the tracing provider.
	// It defaults to a no-op tracer.
	TracingProvider tracing.Provider

	// Transport sets the transport for HTTP requests.
	Transport Transporter

	// PerCallPolicies contains custom policies to inject into the pipeline.
	// Each policy is executed once per request.
	PerCallPolicies []Policy

	// PerRetryPolicies contains custom policies to inject into the pipeline.
	// Each policy is executed once per request, and for each retry of that request.
	PerRetryPolicies []Policy
}

// LogOptions configures the logging policy's behavior.
type LogOptions struct {
	// IncludeBody indicates if request and response bodies should be included in logging.
	// The default value is false.
	// NOTE: enabling this can lead to disclosure of sensitive information, use with care.
	IncludeBody bool

	// AllowedHeaders is the slice of headers to log with their values intact.
	// All headers not in the slice will have their values REDACTED.
	// Applies to request and response headers.
	AllowedHeaders []string

	// AllowedQueryParams is the slice of query parameters to log with their values intact.
	// All query parameters not in the slice will have their values REDACTED.
	AllowedQueryParams []string
}

// RetryOptions configures the retry policy's behavior.
// Zero-value fields will have their specified default values applied during use.
// This allows for modification of a subset of fields.
type RetryOptions struct {
	// MaxRetries specifies the maximum number of attempts a failed operation will be retried
	// before producing an error.
	// The default value is three.  A value less than zero means one try and no retries.
	MaxRetries int32

	// TryTimeout indicates the maximum time allowed for any single try of an HTTP request.
	// This is disabled by default.  Specify a value greater than zero to enable.
	// NOTE: Setting this to a small value might cause premature HTTP request time-outs.
	TryTimeout time.Duration

	// RetryDelay specifies the initial amount of delay to use before retrying an operation.
	// The value is used only if the HTTP response does not contain a Retry-After header.
	// The delay increases exponentially with each retry up to the maximum specified by MaxRetryDelay.
	// The default value is 800 milliseconds.  A value less than zero means no delay between retries.
	RetryDelay time.Duration

	// MaxRetryDelay specifies the maximum delay allowed before retrying an operation.
	// Typically the value is greater than or equal to the value specified in RetryDelay.
	// The default Value is 60 seconds.  A value less than zero means there is no cap.
	MaxRetryDelay time.Duration

	// StatusCodes specifies the HTTP status codes that indicate the operation should be retried.
	// A nil slice will use the following values.
	//   http.StatusRequestTimeout      408
	//   http.StatusTooManyRequests     429
	//   http.StatusInternalServerError 500
	//   http.StatusBadGateway          502
	//   http.StatusServiceUnavailable  503
	//   http.StatusGatewayTimeout      504
	// Specifying values will replace the default values.
	// Specifying an empty slice will disable retries for HTTP status codes.
	StatusCodes []int

	// ShouldRetry evaluates if the retry policy should retry the request.
	// When specified, the function overrides comparison against the list of
	// HTTP status codes and error checking within the retry policy. Context
	// and NonRetriable errors remain evaluated before calling ShouldRetry.
	// The *http.Response and error parameters are mutually exclusive, i.e.
	// if one is nil, the other is not nil.
	// A return value of true means the retry policy should retry.
	ShouldRetry func(*http.Response, error) bool
}

// TelemetryOptions configures the telemetry policy's behavior.
type TelemetryOptions struct {
	// ApplicationID is an application-specific identification string to add to the User-Agent.
	// It has a maximum length of 24 characters and must not contain any spaces.
	ApplicationID string

	// Disabled will prevent the addition of any telemetry data to the User-Agent.
	Disabled bool
}

// TokenRequestOptions contain specific parameter that may be used by credentials types when attempting to get a token.
type TokenRequestOptions = exported.TokenRequestOptions

// BearerTokenOptions configures the bearer token policy's behavior.
type BearerTokenOptions struct {
	// AuthorizationHandler allows SDK developers to run client-specific logic when BearerTokenPolicy must authorize a request.
	// When this field isn't set, the policy follows its default behavior of authorizing every request with a bearer token from
	// its given credential.
	AuthorizationHandler AuthorizationHandler

	// InsecureAllowCredentialWithHTTP enables authenticated requests over HTTP.
	// By default, authenticated requests to an HTTP endpoint are rejected by the client.
	// WARNING: setting this to true will allow sending the bearer token in clear text. Use with caution.
	InsecureAllowCredentialWithHTTP bool
}

// AuthorizationHandler allows SDK developers to insert custom logic that runs when BearerTokenPolicy must authorize a request.
type AuthorizationHandler struct {
	// OnRequest provides TokenRequestOptions the policy can use to acquire a token for a request. The policy calls OnRequest
	// whenever it needs a token and may call it multiple times for the same request. Its func parameter authorizes the request
	// with a token from the policy's credential. Implementations that need to perform I/O should use the Request's context,
	// available from Request.Raw().Context(). When OnRequest returns an error, the policy propagates that error and doesn't send
	// the request. When OnRequest is nil, the policy follows its default behavior, which is to authorize the request with a token
	// from its credential according to its configuration.
	OnRequest func(*Request, func(TokenRequestOptions) error) error

	// OnChallenge allows clients to implement custom HTTP authentication challenge handling. BearerTokenPolicy calls it upon
	// receiving a 401 response containing multiple Bearer challenges or a challenge BearerTokenPolicy itself can't handle.
	// OnChallenge is responsible for parsing challenge(s) (the Response's WWW-Authenticate header) and reauthorizing the
	// Request accordingly. Its func argument authorizes the Request with a token from the policy's credential using the given
	// TokenRequestOptions. OnChallenge should honor the Request's context, available from Request.Raw().Context(). When
	// OnChallenge returns nil, the policy will send the Request again.
	OnChallenge func(*Request, *http.Response, func(TokenRequestOptions) error) error
}

// WithCaptureResponse applies the HTTP response retrieval annotation to the parent context.
// The resp parameter will contain the HTTP response after the request has completed.
func WithCaptureResponse(parent context.Context, resp **http.Response) context.Context {
	return context.WithValue(parent, shared.CtxWithCaptureResponse{}, resp)
}

// WithHTTPHeader adds the specified http.Header to the parent context.
// Use this to specify custom HTTP headers at the API-call level.
// Any overlapping headers will have their values replaced with the values specified here.
func WithHTTPHeader(parent context.Context, header http.Header) context.Context {
	return context.WithValue(parent, shared.CtxWithHTTPHeaderKey{}, header)
}

// WithRetryOptions adds the specified RetryOptions to the parent context.
// Use this to specify custom RetryOptions at the API-call level.
func WithRetryOptions(parent context.Context, options RetryOptions) context.Context {
	return context.WithValue(parent, shared.CtxWithRetryOptionsKey{}, options)
}
