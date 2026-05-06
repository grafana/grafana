package v4a

import (
	"context"
	"fmt"
	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	internalauth "github.com/aws/aws-sdk-go-v2/internal/auth"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"net/http"
	"time"
)

// HTTPSigner is SigV4a HTTP signer implementation
type HTTPSigner interface {
	SignHTTP(ctx context.Context, credentials Credentials, r *http.Request, payloadHash string, service string, regionSet []string, signingTime time.Time, optfns ...func(*SignerOptions)) error
}

// SignHTTPRequestMiddlewareOptions is the middleware options for constructing a SignHTTPRequestMiddleware.
type SignHTTPRequestMiddlewareOptions struct {
	Credentials CredentialsProvider
	Signer      HTTPSigner
	LogSigning  bool
}

// SignHTTPRequestMiddleware is a middleware for signing an HTTP request using SigV4a.
type SignHTTPRequestMiddleware struct {
	credentials CredentialsProvider
	signer      HTTPSigner
	logSigning  bool
}

// NewSignHTTPRequestMiddleware constructs a SignHTTPRequestMiddleware using the given SignHTTPRequestMiddlewareOptions.
func NewSignHTTPRequestMiddleware(options SignHTTPRequestMiddlewareOptions) *SignHTTPRequestMiddleware {
	return &SignHTTPRequestMiddleware{
		credentials: options.Credentials,
		signer:      options.Signer,
		logSigning:  options.LogSigning,
	}
}

// ID the middleware identifier.
func (s *SignHTTPRequestMiddleware) ID() string {
	return "Signing"
}

// HandleFinalize signs an HTTP request using SigV4a.
func (s *SignHTTPRequestMiddleware) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	if !hasCredentialProvider(s.credentials) {
		return next.HandleFinalize(ctx, in)
	}

	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unexpected request middleware type %T", in.Request)
	}

	signingName, signingRegion := awsmiddleware.GetSigningName(ctx), awsmiddleware.GetSigningRegion(ctx)
	payloadHash := v4.GetPayloadHash(ctx)
	if len(payloadHash) == 0 {
		return out, metadata, &SigningError{Err: fmt.Errorf("computed payload hash missing from context")}
	}

	credentials, err := s.credentials.RetrievePrivateKey(ctx)
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

	err = s.signer.SignHTTP(ctx, credentials, req.Request, payloadHash, signingName, []string{signingRegion}, time.Now().UTC(), signerOptions...)
	if err != nil {
		return out, metadata, &SigningError{Err: fmt.Errorf("failed to sign http request, %w", err)}
	}

	return next.HandleFinalize(ctx, in)
}

func hasCredentialProvider(p CredentialsProvider) bool {
	if p == nil {
		return false
	}

	return true
}

// RegisterSigningMiddleware registers the SigV4a signing middleware to the stack. If a signing middleware is already
// present, this provided middleware will be swapped. Otherwise the middleware will be added at the tail of the
// finalize step.
func RegisterSigningMiddleware(stack *middleware.Stack, signingMiddleware *SignHTTPRequestMiddleware) (err error) {
	const signedID = "Signing"
	_, present := stack.Finalize.Get(signedID)
	if present {
		_, err = stack.Finalize.Swap(signedID, signingMiddleware)
	} else {
		err = stack.Finalize.Add(signingMiddleware, middleware.After)
	}
	return err
}
