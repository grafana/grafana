package v4

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	v4Internal "github.com/aws/aws-sdk-go-v2/aws/signer/internal/v4"
	internalauth "github.com/aws/aws-sdk-go-v2/internal/auth"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/smithy-go/middleware"
	"github.com/aws/smithy-go/tracing"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

const computePayloadHashMiddlewareID = "ComputePayloadHash"

// HashComputationError indicates an error occurred while computing the signing hash
type HashComputationError struct {
	Err error
}

// Error is the error message
func (e *HashComputationError) Error() string {
	return fmt.Sprintf("failed to compute payload hash: %v", e.Err)
}

// Unwrap returns the underlying error if one is set
func (e *HashComputationError) Unwrap() error {
	return e.Err
}

// SigningError indicates an error condition occurred while performing SigV4 signing
type SigningError struct {
	Err error
}

func (e *SigningError) Error() string {
	return fmt.Sprintf("failed to sign request: %v", e.Err)
}

// Unwrap returns the underlying error cause
func (e *SigningError) Unwrap() error {
	return e.Err
}

// UseDynamicPayloadSigningMiddleware swaps the compute payload sha256 middleware with a resolver middleware that
// switches between unsigned and signed payload based on TLS state for request.
// This middleware should not be used for AWS APIs that do not support unsigned payload signing auth.
// By default, SDK uses this middleware for known AWS APIs that support such TLS based auth selection .
//
// Usage example -
// S3 PutObject API allows unsigned payload signing auth usage when TLS is enabled, and uses this middleware to
// dynamically switch between unsigned and signed payload based on TLS state for request.
func UseDynamicPayloadSigningMiddleware(stack *middleware.Stack) error {
	_, err := stack.Finalize.Swap(computePayloadHashMiddlewareID, &dynamicPayloadSigningMiddleware{})
	return err
}

// dynamicPayloadSigningMiddleware dynamically resolves the middleware that computes and set payload sha256 middleware.
type dynamicPayloadSigningMiddleware struct {
}

// ID returns the resolver identifier
func (m *dynamicPayloadSigningMiddleware) ID() string {
	return computePayloadHashMiddlewareID
}

// HandleFinalize delegates SHA256 computation according to whether the request
// is TLS-enabled.
func (m *dynamicPayloadSigningMiddleware) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type %T", in.Request)
	}

	if req.IsHTTPS() {
		return (&UnsignedPayload{}).HandleFinalize(ctx, in, next)
	}
	return (&ComputePayloadSHA256{}).HandleFinalize(ctx, in, next)
}

// UnsignedPayload sets the SigV4 request payload hash to unsigned.
//
// Will not set the Unsigned Payload magic SHA value, if a SHA has already been
// stored in the context. (e.g. application pre-computed SHA256 before making
// API call).
//
// This middleware does not check the X-Amz-Content-Sha256 header, if that
// header is serialized a middleware must translate it into the context.
type UnsignedPayload struct{}

// AddUnsignedPayloadMiddleware adds unsignedPayload to the operation
// middleware stack
func AddUnsignedPayloadMiddleware(stack *middleware.Stack) error {
	return stack.Finalize.Insert(&UnsignedPayload{}, "ResolveEndpointV2", middleware.After)
}

// ID returns the unsignedPayload identifier
func (m *UnsignedPayload) ID() string {
	return computePayloadHashMiddlewareID
}

// HandleFinalize sets the payload hash magic value to the unsigned sentinel.
func (m *UnsignedPayload) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	if GetPayloadHash(ctx) == "" {
		ctx = SetPayloadHash(ctx, v4Internal.UnsignedPayload)
	}
	return next.HandleFinalize(ctx, in)
}

// ComputePayloadSHA256 computes SHA256 payload hash to sign.
//
// Will not set the Unsigned Payload magic SHA value, if a SHA has already been
// stored in the context. (e.g. application pre-computed SHA256 before making
// API call).
//
// This middleware does not check the X-Amz-Content-Sha256 header, if that
// header is serialized a middleware must translate it into the context.
type ComputePayloadSHA256 struct{}

// AddComputePayloadSHA256Middleware adds computePayloadSHA256 to the
// operation middleware stack
func AddComputePayloadSHA256Middleware(stack *middleware.Stack) error {
	return stack.Finalize.Insert(&ComputePayloadSHA256{}, "ResolveEndpointV2", middleware.After)
}

// RemoveComputePayloadSHA256Middleware removes computePayloadSHA256 from the
// operation middleware stack
func RemoveComputePayloadSHA256Middleware(stack *middleware.Stack) error {
	_, err := stack.Finalize.Remove(computePayloadHashMiddlewareID)
	return err
}

// ID is the middleware name
func (m *ComputePayloadSHA256) ID() string {
	return computePayloadHashMiddlewareID
}

// HandleFinalize computes the payload hash for the request, storing it to the
// context. This is a no-op if a caller has previously set that value.
func (m *ComputePayloadSHA256) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	if GetPayloadHash(ctx) != "" {
		return next.HandleFinalize(ctx, in)
	}

	_, span := tracing.StartSpan(ctx, "ComputePayloadSHA256")
	defer span.End()

	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, &HashComputationError{
			Err: fmt.Errorf("unexpected request middleware type %T", in.Request),
		}
	}

	hash := sha256.New()
	if stream := req.GetStream(); stream != nil {
		_, err = io.Copy(hash, stream)
		if err != nil {
			return out, metadata, &HashComputationError{
				Err: fmt.Errorf("failed to compute payload hash, %w", err),
			}
		}

		if err := req.RewindStream(); err != nil {
			return out, metadata, &HashComputationError{
				Err: fmt.Errorf("failed to seek body to start, %w", err),
			}
		}
	}

	ctx = SetPayloadHash(ctx, hex.EncodeToString(hash.Sum(nil)))

	span.End()
	return next.HandleFinalize(ctx, in)
}

// SwapComputePayloadSHA256ForUnsignedPayloadMiddleware replaces the
// ComputePayloadSHA256 middleware with the UnsignedPayload middleware.
//
// Use this to disable computing the Payload SHA256 checksum and instead use
// UNSIGNED-PAYLOAD for the SHA256 value.
func SwapComputePayloadSHA256ForUnsignedPayloadMiddleware(stack *middleware.Stack) error {
	_, err := stack.Finalize.Swap(computePayloadHashMiddlewareID, &UnsignedPayload{})
	return err
}

// ContentSHA256Header sets the X-Amz-Content-Sha256 header value to
// the Payload hash stored in the context.
type ContentSHA256Header struct{}

// AddContentSHA256HeaderMiddleware adds ContentSHA256Header to the
// operation middleware stack
func AddContentSHA256HeaderMiddleware(stack *middleware.Stack) error {
	return stack.Finalize.Insert(&ContentSHA256Header{}, computePayloadHashMiddlewareID, middleware.After)
}

// RemoveContentSHA256HeaderMiddleware removes contentSHA256Header middleware
// from the operation middleware stack
func RemoveContentSHA256HeaderMiddleware(stack *middleware.Stack) error {
	_, err := stack.Finalize.Remove((*ContentSHA256Header)(nil).ID())
	return err
}

// ID returns the ContentSHA256HeaderMiddleware identifier
func (m *ContentSHA256Header) ID() string {
	return "SigV4ContentSHA256Header"
}

// HandleFinalize sets the X-Amz-Content-Sha256 header value to the Payload hash
// stored in the context.
func (m *ContentSHA256Header) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, &HashComputationError{Err: fmt.Errorf("unexpected request middleware type %T", in.Request)}
	}

	req.Header.Set(v4Internal.ContentSHAKey, GetPayloadHash(ctx))
	return next.HandleFinalize(ctx, in)
}

// SignHTTPRequestMiddlewareOptions is the configuration options for
// [SignHTTPRequestMiddleware].
//
// Deprecated: [SignHTTPRequestMiddleware] is deprecated.
type SignHTTPRequestMiddlewareOptions struct {
	CredentialsProvider aws.CredentialsProvider
	Signer              HTTPSigner
	LogSigning          bool
}

// SignHTTPRequestMiddleware is a `FinalizeMiddleware` implementation for SigV4
// HTTP Signing.
//
// Deprecated: AWS service clients no longer use this middleware. Signing as an
// SDK operation is now performed through an internal per-service middleware
// which opaquely selects and uses the signer from the resolved auth scheme.
type SignHTTPRequestMiddleware struct {
	credentialsProvider aws.CredentialsProvider
	signer              HTTPSigner
	logSigning          bool
}

// NewSignHTTPRequestMiddleware constructs a [SignHTTPRequestMiddleware] using
// the given [Signer] for signing requests.
//
// Deprecated: SignHTTPRequestMiddleware is deprecated.
func NewSignHTTPRequestMiddleware(options SignHTTPRequestMiddlewareOptions) *SignHTTPRequestMiddleware {
	return &SignHTTPRequestMiddleware{
		credentialsProvider: options.CredentialsProvider,
		signer:              options.Signer,
		logSigning:          options.LogSigning,
	}
}

// ID is the SignHTTPRequestMiddleware identifier.
//
// Deprecated: SignHTTPRequestMiddleware is deprecated.
func (s *SignHTTPRequestMiddleware) ID() string {
	return "Signing"
}

// HandleFinalize will take the provided input and sign the request using the
// SigV4 authentication scheme.
//
// Deprecated: SignHTTPRequestMiddleware is deprecated.
func (s *SignHTTPRequestMiddleware) HandleFinalize(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	if !haveCredentialProvider(s.credentialsProvider) {
		return next.HandleFinalize(ctx, in)
	}

	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, &SigningError{Err: fmt.Errorf("unexpected request middleware type %T", in.Request)}
	}

	signingName, signingRegion := awsmiddleware.GetSigningName(ctx), awsmiddleware.GetSigningRegion(ctx)
	payloadHash := GetPayloadHash(ctx)
	if len(payloadHash) == 0 {
		return out, metadata, &SigningError{Err: fmt.Errorf("computed payload hash missing from context")}
	}

	credentials, err := s.credentialsProvider.Retrieve(ctx)
	if err != nil {
		return out, metadata, &SigningError{Err: fmt.Errorf("failed to retrieve credentials: %w", err)}
	}

	signerOptions := []func(o *SignerOptions){
		func(o *SignerOptions) {
			o.Logger = middleware.GetLogger(ctx)
			o.LogSigning = s.logSigning
		},
	}

	// existing DisableURIPathEscaping is equivalent in purpose
	// to authentication scheme property DisableDoubleEncoding
	disableDoubleEncoding, overridden := internalauth.GetDisableDoubleEncoding(ctx)
	if overridden {
		signerOptions = append(signerOptions, func(o *SignerOptions) {
			o.DisableURIPathEscaping = disableDoubleEncoding
		})
	}

	err = s.signer.SignHTTP(ctx, credentials, req.Request, payloadHash, signingName, signingRegion, sdk.NowTime(), signerOptions...)
	if err != nil {
		return out, metadata, &SigningError{Err: fmt.Errorf("failed to sign http request, %w", err)}
	}

	ctx = awsmiddleware.SetSigningCredentials(ctx, credentials)

	return next.HandleFinalize(ctx, in)
}

// StreamingEventsPayload signs input event stream messages.
type StreamingEventsPayload struct{}

// AddStreamingEventsPayload adds the streamingEventsPayload middleware to the stack.
func AddStreamingEventsPayload(stack *middleware.Stack) error {
	return stack.Finalize.Add(&StreamingEventsPayload{}, middleware.Before)
}

// ID identifies the middleware.
func (s *StreamingEventsPayload) ID() string {
	return computePayloadHashMiddlewareID
}

// HandleFinalize marks the input stream to be signed with SigV4.
func (s *StreamingEventsPayload) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	contentSHA := GetPayloadHash(ctx)
	if len(contentSHA) == 0 {
		contentSHA = v4Internal.StreamingEventsPayload
	}

	ctx = SetPayloadHash(ctx, contentSHA)

	return next.HandleFinalize(ctx, in)
}

// GetSignedRequestSignature attempts to extract the signature of the request.
// Returning an error if the request is unsigned, or unable to extract the
// signature.
func GetSignedRequestSignature(r *http.Request) ([]byte, error) {
	const authHeaderSignatureElem = "Signature="

	if auth := r.Header.Get(authorizationHeader); len(auth) != 0 {
		ps := strings.Split(auth, ",")
		for _, p := range ps {
			p = strings.TrimSpace(p)
			if idx := strings.Index(p, authHeaderSignatureElem); idx >= 0 {
				sig := p[len(authHeaderSignatureElem):]
				if len(sig) == 0 {
					return nil, fmt.Errorf("invalid request signature authorization header")
				}
				return hex.DecodeString(sig)
			}
		}
	}

	if sig := r.URL.Query().Get("X-Amz-Signature"); len(sig) != 0 {
		return hex.DecodeString(sig)
	}

	return nil, fmt.Errorf("request not signed")
}

func haveCredentialProvider(p aws.CredentialsProvider) bool {
	if p == nil {
		return false
	}

	return !aws.IsCredentialsProvider(p, (*aws.AnonymousCredentials)(nil))
}

type payloadHashKey struct{}

// GetPayloadHash retrieves the payload hash to use for signing
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func GetPayloadHash(ctx context.Context) (v string) {
	v, _ = middleware.GetStackValue(ctx, payloadHashKey{}).(string)
	return v
}

// SetPayloadHash sets the payload hash to be used for signing the request
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func SetPayloadHash(ctx context.Context, hash string) context.Context {
	return middleware.WithStackValue(ctx, payloadHashKey{}, hash)
}
